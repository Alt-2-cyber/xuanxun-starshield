from __future__ import annotations

from .control import (
    ControlMode,
    ControlSnapshot,
    TaskIntent,
    TaskPlan,
    TaskRecord,
)


MAX_LINEAR_SPEED = 0.25
MAX_ANGULAR_SPEED = 0.80
OBSTACLE_STOP_DISTANCE_M = 0.45


class ControlActionResult:
    def __init__(
        self,
        *,
        accepted: bool,
        reason: str,
        intent: TaskIntent | None = None,
        task_id: str | None = None,
        linear_x: float = 0.0,
        angular_z: float = 0.0,
        duration_ms: int = 0,
        spoken_response: str = "",
    ) -> None:
        self.accepted = accepted
        self.reason = reason
        self.intent = intent
        self.task_id = task_id
        self.linear_x = linear_x
        self.angular_z = angular_z
        self.duration_ms = duration_ms
        self.spoken_response = spoken_response


def _clamp(value: float, limit: float) -> float:
    return max(-limit, min(limit, value))


class SafetyArbiter:
    """Single safety gate for manual velocity and high-level task commands."""

    def __init__(self, *, ros_connected: bool = False) -> None:
        self._snapshot = ControlSnapshot(ros_connected=ros_connected)

    def state(self) -> ControlSnapshot:
        return self._snapshot.model_copy(deep=True)

    def set_ros_connected(self, connected: bool) -> None:
        self._snapshot.ros_connected = connected
        if not connected:
            self._snapshot.last_reason = "ROS_DISCONNECTED"

    def set_ros_command_sequence(self, sequence: int) -> None:
        self._snapshot.ros_last_command_sequence = max(0, sequence)

    def reconcile_ros_state(self, *, mode: ControlMode | None, safety_state: str | None) -> None:
        if mode is not None:
            self._snapshot.mode = mode
        if safety_state in {"PATROLLING", "PAUSED", "ESTOP_LATCHED", "READY", "FAULT"}:
            self._snapshot.safety_state = safety_state
            if safety_state == "PAUSED":
                self._snapshot.last_reason = "PAUSED_BY_OPERATOR"
            elif safety_state == "ESTOP_LATCHED":
                self._snapshot.last_reason = "ESTOP_LATCHED"

    def set_mode(self, mode: ControlMode) -> ControlActionResult:
        if self._snapshot.safety_state == "ESTOP_LATCHED":
            return self._reject("ESTOP_LATCHED")
        self._snapshot.mode = mode
        self._snapshot.last_command = f"MODE:{mode.value}"
        self._snapshot.last_reason = "MODE_ACCEPTED"
        self._snapshot.voice_feedback = self._mode_feedback(mode)
        self._snapshot.command_sequence += 1
        return ControlActionResult(accepted=True, reason="MODE_ACCEPTED", spoken_response=self._snapshot.voice_feedback)

    def pause(self) -> ControlActionResult:
        if self._snapshot.safety_state == "ESTOP_LATCHED":
            return self._reject("ESTOP_LATCHED")
        self._snapshot.safety_state = "PAUSED"
        self._snapshot.last_command = "PAUSE"
        self._snapshot.last_reason = "PAUSED_BY_OPERATOR"
        self._snapshot.voice_feedback = "已暂停巡检"
        self._snapshot.command_sequence += 1
        return ControlActionResult(accepted=True, reason="PAUSED_BY_OPERATOR", intent=TaskIntent.PAUSE, spoken_response="已暂停巡检")

    def estop(self) -> ControlActionResult:
        self._snapshot.safety_state = "ESTOP_LATCHED"
        self._snapshot.last_command = "ESTOP"
        self._snapshot.last_reason = "ESTOP_LATCHED"
        self._snapshot.voice_feedback = "急停已锁存，请执行现场授权解除流程"
        self._snapshot.command_sequence += 1
        return ControlActionResult(accepted=True, reason="ESTOP_LATCHED", spoken_response=self._snapshot.voice_feedback)

    def update_obstacle_distance(self, distance_m: float | None) -> None:
        self._snapshot.obstacle_distance_m = distance_m
        self._snapshot.obstacle_blocked = distance_m is not None and distance_m < OBSTACLE_STOP_DISTANCE_M
        if self._snapshot.obstacle_blocked and self._snapshot.safety_state == "PATROLLING":
            self._snapshot.last_reason = "OBSTACLE_BLOCKED"

    def manual_velocity(self, *, linear_x: float, angular_z: float, duration_ms: int) -> ControlActionResult:
        if self._snapshot.mode != ControlMode.MANUAL:
            return self._reject("MODE_NOT_MANUAL")
        if self._snapshot.safety_state != "PATROLLING":
            return self._reject(self._snapshot.safety_state)
        if not self._snapshot.ros_connected:
            return self._reject("ROS_DISCONNECTED")
        if self._snapshot.obstacle_blocked and linear_x > 0:
            return ControlActionResult(accepted=False, reason="OBSTACLE_BLOCKED", linear_x=0.0, angular_z=0.0)
        bounded_linear = _clamp(linear_x, MAX_LINEAR_SPEED)
        bounded_angular = _clamp(angular_z, MAX_ANGULAR_SPEED)
        self._snapshot.last_command = "MANUAL_VELOCITY"
        self._snapshot.last_reason = "MANUAL_ACCEPTED"
        self._snapshot.voice_feedback = ""
        self._snapshot.command_sequence += 1
        return ControlActionResult(
            accepted=True,
            reason="MANUAL_ACCEPTED",
            linear_x=bounded_linear,
            angular_z=bounded_angular,
            duration_ms=duration_ms,
        )

    def accept_task(self, plan: TaskPlan, *, task_id: str = "") -> ControlActionResult:
        if self._snapshot.safety_state == "ESTOP_LATCHED":
            return self._reject("ESTOP_LATCHED", intent=plan.intent)
        if plan.intent == TaskIntent.PAUSE:
            return self.pause()
        if plan.intent == TaskIntent.RESUME:
            if not self._snapshot.ros_connected:
                return self._reject("ROS_DISCONNECTED", intent=plan.intent)
            self._snapshot.safety_state = "PATROLLING"
            self._snapshot.last_command = "RESUME"
            self._snapshot.last_reason = "RESUMED_BY_OPERATOR"
            self._snapshot.voice_feedback = "已恢复巡检"
            self._snapshot.command_sequence += 1
            return ControlActionResult(accepted=True, reason="RESUMED_BY_OPERATOR", intent=plan.intent, task_id=task_id, spoken_response="已恢复巡检")
        if not self._snapshot.ros_connected:
            return self._reject("ROS_DISCONNECTED", intent=plan.intent)
        if plan.intent == TaskIntent.STOP:
            self._snapshot.safety_state = "PAUSED"
            self._snapshot.last_command = "STOP_TASK"
            self._snapshot.last_reason = "TASK_STOPPED"
            self._snapshot.voice_feedback = "当前任务已停止"
        else:
            self._snapshot.safety_state = "PATROLLING"
            self._snapshot.last_command = f"TASK:{plan.intent.value}"
            self._snapshot.last_reason = "TASK_ACCEPTED"
            self._snapshot.voice_feedback = self._task_feedback(plan)
        self._snapshot.command_sequence += 1
        self._snapshot.last_task = TaskRecord(
            task_id=task_id or f"task-{self._snapshot.command_sequence:04d}",
            transcript=plan.explanation,
            source=plan.source,
            plan=plan,
        )
        return ControlActionResult(
            accepted=True,
            reason=self._snapshot.last_reason,
            intent=plan.intent,
            task_id=self._snapshot.last_task.task_id,
            spoken_response=self._snapshot.voice_feedback,
        )

    def _reject(self, reason: str, *, intent: TaskIntent | None = None) -> ControlActionResult:
        self._snapshot.last_reason = reason
        self._snapshot.voice_feedback = self._reject_feedback(reason)
        return ControlActionResult(accepted=False, reason=reason, intent=intent, spoken_response=self._snapshot.voice_feedback)

    @staticmethod
    def _mode_feedback(mode: ControlMode) -> str:
        return {
            ControlMode.FIXED_PATROL: "已切换固定循迹避障模式",
            ControlMode.MANUAL: "已切换手动控制模式，速度已限幅",
            ControlMode.LOBSTER_AI: "已切换龙虾 AI 任务模式",
        }[mode]

    @staticmethod
    def _task_feedback(plan: TaskPlan) -> str:
        if plan.intent == TaskIntent.START_PATROL:
            return "固定巡检任务已下发"
        if plan.intent == TaskIntent.GO_TO_PATROL_POINT:
            return f"正在规划前往{plan.target or '目标点'}"
        if plan.intent == TaskIntent.RETURN_HOME:
            return "正在规划返回起点"
        return "任务已受理"

    @staticmethod
    def _reject_feedback(reason: str) -> str:
        return {
            "ESTOP_LATCHED": "急停已锁存，当前不接受运动指令",
            "ROS_DISCONNECTED": "ROS 2 未连接，已拒绝运动指令",
            "MODE_NOT_MANUAL": "请先切换到手动控制模式",
            "OBSTACLE_BLOCKED": "前方有障碍，已保持停车",
            "PAUSED_REQUIRES_RESUME_TASK": "当前已暂停，请先发送继续任务",
        }.get(reason, "当前安全状态不允许执行该指令")
