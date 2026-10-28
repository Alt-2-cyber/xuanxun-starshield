import pytest

from fire_edge.control import (
    ControlMode,
    LocalTaskPlanner,
    TaskPlan,
    TaskPlanner,
    TaskIntent,
    TaskSource,
    TaskPlannerError,
)
from fire_edge.safety_controller import (
    MAX_ANGULAR_SPEED,
    MAX_LINEAR_SPEED,
    SafetyArbiter,
)


def test_local_planner_turns_chinese_patrol_request_into_structured_task() -> None:
    plan = LocalTaskPlanner().plan("去 B 区巡检点")

    assert plan.intent == TaskIntent.GO_TO_PATROL_POINT
    assert plan.target == "B 区巡检点"
    assert plan.source == TaskSource.LOCAL
    assert plan.speed_limit_mps <= MAX_LINEAR_SPEED


def test_local_planner_handles_pause_and_return_without_llm() -> None:
    planner = LocalTaskPlanner()

    assert planner.plan("暂停巡检").intent == TaskIntent.PAUSE
    assert planner.plan("返回起点").intent == TaskIntent.RETURN_HOME


def test_ai_planner_rejects_estop_as_a_task() -> None:
    with pytest.raises(TaskPlannerError, match="急停"):
        LocalTaskPlanner().plan("龙虾，立即急停")


def test_safety_arbiter_clamps_manual_velocity_and_requires_manual_mode() -> None:
    arbiter = SafetyArbiter(ros_connected=True)
    arbiter.set_mode(ControlMode.MANUAL)

    command = arbiter.manual_velocity(linear_x=9.0, angular_z=-9.0, duration_ms=500)

    assert command.accepted is True
    assert command.linear_x == MAX_LINEAR_SPEED
    assert command.angular_z == -MAX_ANGULAR_SPEED


def test_safety_arbiter_stops_on_laser_obstacle_and_latches_estop() -> None:
    arbiter = SafetyArbiter(ros_connected=True)
    arbiter.set_mode(ControlMode.MANUAL)
    arbiter.update_obstacle_distance(0.25)

    blocked = arbiter.manual_velocity(linear_x=0.2, angular_z=0.0, duration_ms=500)
    assert blocked.accepted is False
    assert blocked.reason == "OBSTACLE_BLOCKED"
    assert blocked.linear_x == 0.0
    assert blocked.angular_z == 0.0

    arbiter.estop()
    assert arbiter.state().safety_state == "ESTOP_LATCHED"
    assert arbiter.set_mode(ControlMode.FIXED_PATROL).accepted is False


def test_lobster_task_is_high_level_and_never_contains_velocity_stream() -> None:
    arbiter = SafetyArbiter(ros_connected=True)
    arbiter.set_mode(ControlMode.LOBSTER_AI)
    plan = LocalTaskPlanner().plan("开始巡检")
    result = arbiter.accept_task(plan)

    assert result.accepted is True
    assert result.intent == TaskIntent.START_PATROL
    assert not hasattr(result, "velocity_stream")


def test_obstacle_telemetry_does_not_hide_pause_reason() -> None:
    arbiter = SafetyArbiter(ros_connected=True)
    arbiter.pause()
    arbiter.update_obstacle_distance(0.2)

    assert arbiter.state().last_reason == "PAUSED_BY_OPERATOR"


def test_ros_state_reconciliation_restores_safety_reason() -> None:
    arbiter = SafetyArbiter(ros_connected=True)
    arbiter.update_obstacle_distance(0.2)
    arbiter.reconcile_ros_state(mode=ControlMode.FIXED_PATROL, safety_state="PAUSED")

    assert arbiter.state().last_reason == "PAUSED_BY_OPERATOR"


def test_paused_robot_can_switch_to_lobster_mode_before_resume_task() -> None:
    arbiter = SafetyArbiter(ros_connected=True)
    arbiter.pause()

    result = arbiter.set_mode(ControlMode.LOBSTER_AI)

    assert result.accepted is True
    assert arbiter.state().mode == ControlMode.LOBSTER_AI
    assert arbiter.state().safety_state == "PAUSED"


def test_task_planner_reports_the_provider_used_for_last_plan() -> None:
    planner = TaskPlanner()
    planner.local.plan = lambda _text: TaskPlan(
        intent=TaskIntent.PAUSE,
        explanation="local",
        source=TaskSource.LOCAL,
    )

    planner.plan("保持原地")

    assert planner.last_provider == "local"
