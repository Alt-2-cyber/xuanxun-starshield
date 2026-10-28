from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from enum import StrEnum
from threading import Lock
from typing import Any

from pydantic import BaseModel, Field

from .control import ControlMode
from .models import PoseSnapshot


class RosCommandKind(StrEnum):
    SET_MODE = "SET_MODE"
    VELOCITY = "VELOCITY"
    TASK = "TASK"
    STOP = "STOP"


class RosCommand(BaseModel):
    sequence: int
    request_id: str
    kind: RosCommandKind
    mode: ControlMode | None = None
    linear_x: float = 0.0
    angular_z: float = 0.0
    duration_ms: int = 0
    task: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RosTelemetry(BaseModel):
    ros_connected: bool = False
    mode: ControlMode | None = None
    safety_state: str | None = None
    pose: PoseSnapshot | None = None
    obstacle_distance_m: float | None = None
    last_command_sequence: int = 0
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RosCommandQueue:
    def __init__(self, *, max_size: int = 256) -> None:
        if max_size < 1:
            raise ValueError("max_size must be positive")
        self.max_size = max_size
        self._items: deque[RosCommand] = deque(maxlen=max_size)
        self._next_sequence = 0
        self._lock = Lock()

    def enqueue(
        self,
        *,
        request_id: str,
        kind: RosCommandKind,
        mode: ControlMode | None = None,
        linear_x: float = 0.0,
        angular_z: float = 0.0,
        duration_ms: int = 0,
        task: dict[str, Any] | None = None,
    ) -> RosCommand:
        with self._lock:
            self._next_sequence += 1
            command = RosCommand(
                sequence=self._next_sequence,
                request_id=request_id,
                kind=kind,
                mode=mode,
                linear_x=linear_x,
                angular_z=angular_z,
                duration_ms=duration_ms,
                task=task,
            )
            self._items.append(command)
            return command

    def after(self, sequence: int) -> list[RosCommand]:
        with self._lock:
            return [item for item in self._items if item.sequence > sequence]

    @property
    def latest_sequence(self) -> int:
        with self._lock:
            return self._next_sequence


def reconcile_command_cursor(*, cursor: int, latest_sequence: int) -> int:
    """Reset a remote bridge cursor when the in-memory edge queue restarted."""
    return 0 if latest_sequence < cursor else cursor
