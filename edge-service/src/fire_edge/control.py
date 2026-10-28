from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class ControlMode(StrEnum):
    FIXED_PATROL = "FIXED_PATROL"
    MANUAL = "MANUAL"
    LOBSTER_AI = "LOBSTER_AI"


class TaskSource(StrEnum):
    LOCAL = "LOCAL"
    DEEPSEEK = "DEEPSEEK"
    WEB = "WEB"
    APP = "APP"
    VOICE = "VOICE"


class TaskIntent(StrEnum):
    START_PATROL = "START_PATROL"
    GO_TO_PATROL_POINT = "GO_TO_PATROL_POINT"
    RETURN_HOME = "RETURN_HOME"
    PAUSE = "PAUSE"
    RESUME = "RESUME"
    STOP = "STOP"


class TaskPlannerError(ValueError):
    """A user task is unsafe or cannot be converted into a known intent."""


class TaskPlan(BaseModel):
    intent: TaskIntent
    target: str | None = None
    explanation: str
    source: TaskSource = TaskSource.LOCAL
    speed_limit_mps: float = Field(default=0.20, ge=0.0, le=0.25)


class TaskRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    source: TaskSource = TaskSource.WEB
    client_id: str | None = Field(default=None, max_length=80)
    request_id: str = Field(default_factory=lambda: f"task-{uuid4().hex}", min_length=1, max_length=80)


class ModeRequest(BaseModel):
    mode: ControlMode
    request_id: str = Field(default_factory=lambda: f"mode-{uuid4().hex}", min_length=1, max_length=80)


class ManualVelocityRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: f"manual-{uuid4().hex}", min_length=1, max_length=80)
    linear_x: float = Field(default=0.0, ge=-1.0, le=1.0)
    angular_z: float = Field(default=0.0, ge=-4.0, le=4.0)
    duration_ms: int = Field(default=400, ge=50, le=1000)


class SafetyActionRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: f"safety-{uuid4().hex}", min_length=1, max_length=80)


class TaskRecord(BaseModel):
    task_id: str
    transcript: str
    source: TaskSource
    plan: TaskPlan
    status: str = "ACCEPTED"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ControlSnapshot(BaseModel):
    mode: ControlMode = ControlMode.FIXED_PATROL
    safety_state: str = "PATROLLING"
    ros_connected: bool = False
    obstacle_distance_m: float | None = None
    obstacle_blocked: bool = False
    last_task: TaskRecord | None = None
    last_command: str = "IDLE"
    last_reason: str = "READY"
    voice_feedback: str = ""
    command_sequence: int = 0
    ros_last_command_sequence: int = 0


class LocalTaskPlanner:
    """Deterministic Chinese command parser used before any cloud model."""

    def plan(self, text: str) -> TaskPlan:
        normalized = " ".join(text.strip().split())
        if not normalized:
            raise TaskPlannerError("任务内容为空")
        if "急停" in normalized:
            raise TaskPlannerError("急停必须使用红色急停锁存按钮")
        if "暂停" in normalized or "停一下" in normalized:
            return TaskPlan(intent=TaskIntent.PAUSE, explanation="已识别为普通暂停", source=TaskSource.LOCAL)
        if "继续" in normalized or "恢复巡检" in normalized:
            return TaskPlan(intent=TaskIntent.RESUME, explanation="已识别为恢复巡检", source=TaskSource.LOCAL)
        if "返回" in normalized or "返航" in normalized or "回到起点" in normalized:
            return TaskPlan(intent=TaskIntent.RETURN_HOME, target="HOME", explanation="已识别为返回起点", source=TaskSource.LOCAL)
        if "停止任务" in normalized or normalized in {"停止", "结束巡检"}:
            return TaskPlan(intent=TaskIntent.STOP, explanation="已识别为停止当前任务", source=TaskSource.LOCAL)
        if "开始巡检" in normalized or "开始巡逻" in normalized or "固定循迹" in normalized:
            return TaskPlan(intent=TaskIntent.START_PATROL, target="ROUTE_A", explanation="已识别为启动固定巡检路线", source=TaskSource.LOCAL)
        if any(keyword in normalized for keyword in ("去", "前往", "导航到", "到达")) and any(
            keyword in normalized for keyword in ("巡检点", "点位", "区域")
        ):
            target = self._extract_target(normalized)
            if target:
                return TaskPlan(
                    intent=TaskIntent.GO_TO_PATROL_POINT,
                    target=target,
                    explanation=f"已识别为前往{target}",
                    source=TaskSource.LOCAL,
                )
        raise TaskPlannerError("无法把这句话转换为受控巡检任务")

    @staticmethod
    def _extract_target(text: str) -> str | None:
        cleaned = re.sub(r"^(龙虾[，,、 ]*)", "", text).strip()
        for prefix in ("导航到", "前往", "到达", "去"):
            if cleaned.startswith(prefix):
                candidate = cleaned[len(prefix):].strip(" ：:，,。")
                return candidate or None
        marker = re.search(r"(?:巡检点|点位|区域)", cleaned)
        if marker:
            return cleaned[: marker.end()].strip(" ：:，,。")
        return None


class DeepSeekTaskPlanner:
    """Optional DeepSeek adapter. Credentials are read only from the process environment."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str | None = None,
        model: str | None = None,
        timeout_s: float = 8.0,
    ) -> None:
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY", "").strip()
        self.base_url = (base_url or os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")).rstrip("/")
        self.model = model or os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        self.timeout_s = timeout_s

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def plan(self, text: str) -> TaskPlan:
        if not self.enabled:
            raise TaskPlannerError("AI 任务解析未配置密钥，且本地规则无法识别该任务")
        request_body = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是地下巡检机器人的任务解析器。只能输出 JSON，intent 只能是 "
                        "START_PATROL、GO_TO_PATROL_POINT、RETURN_HOME、PAUSE、RESUME、STOP。"
                        "禁止输出速度、角速度、连续控制流或急停动作。字段为 intent、target、explanation。"
                    ),
                },
                {"role": "user", "content": text},
            ],
        }
        request = urllib.request.Request(
            f"{self.base_url}/chat/completions",
            data=json.dumps(request_body, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise TaskPlannerError(f"AI 任务解析失败：{type(exc).__name__}") from exc
        try:
            content = body["choices"][0]["message"]["content"]
            parsed = json.loads(content) if isinstance(content, str) else content
            return TaskPlan.model_validate({**parsed, "source": TaskSource.DEEPSEEK})
        except (KeyError, TypeError, ValueError) as exc:
            raise TaskPlannerError("AI 返回了不符合任务契约的内容") from exc


class TaskPlanner:
    def __init__(self, local: LocalTaskPlanner | None = None, cloud: DeepSeekTaskPlanner | None = None) -> None:
        self.local = local or LocalTaskPlanner()
        self.cloud = cloud or DeepSeekTaskPlanner()
        self.last_provider = "local"

    @property
    def provider(self) -> str:
        return "deepseek+local" if self.cloud.enabled else "local"

    def plan(self, text: str) -> TaskPlan:
        try:
            plan = self.local.plan(text)
            self.last_provider = "local"
            return plan
        except TaskPlannerError as local_error:
            if "急停" in str(local_error):
                raise
            plan = self.cloud.plan(text)
            self.last_provider = "deepseek"
            return plan
