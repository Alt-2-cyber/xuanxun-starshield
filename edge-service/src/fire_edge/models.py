from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AlertLevel(StrEnum):
    NORMAL = "NORMAL"
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    CLEARED = "CLEARED"


class SafetyState(StrEnum):
    READY = "READY"
    PATROLLING = "PATROLLING"
    PAUSED = "PAUSED"
    ESTOP_LATCHED = "ESTOP_LATCHED"
    FAULT = "FAULT"


class SensorValues(BaseModel):
    temperature_c: float | None = None
    smoke_ratio: float | None = None
    gas_ratio: float | None = None


class PoseSnapshot(BaseModel):
    frame_id: str = "map"
    x: float = 12.4
    y: float = 5.2
    yaw: float = 0.0
    quality: str = "GOOD"


class AlertEvent(BaseModel):
    event_id: str
    robot_id: str = "R01"
    source_id: str = "R-SENSE"
    message_type: str = "ALERT"
    sequence: int = 0
    device_time_ms: int = 0
    level: AlertLevel
    trigger_bits: list[str] = Field(default_factory=list)
    sensor_values: SensorValues = Field(default_factory=SensorValues)
    pose: PoseSnapshot = Field(default_factory=PoseSnapshot)
    transport: str = "SLE"
    acked: bool = False
    status: str = "ACTIVE"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VisionDetection(BaseModel):
    event_id: str | None = None
    frame_id: str
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    model_version: str = "external-onnx"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RiskZone(BaseModel):
    zone_id: str
    name: str
    level: str = "medium"
    x: float
    y: float
    radius_m: float = Field(default=2.0, gt=0.0)


class HeatPoint(BaseModel):
    x: float
    y: float
    intensity: float = Field(ge=0.0, le=1.0)
    radius_m: float = Field(default=1.5, gt=0.0)
    source_event_id: str | None = None
    label: str = "event"


class TransportSample(BaseModel):
    event_id: str
    transport: str
    t0_device_ms: int
    t2_receive_ns: int | None = None
    ack_time_ns: int | None = None
    retry_count: int = 0
    status: str = "RECEIVED"


class TransportIngestRequest(BaseModel):
    transport: str
    payload: dict[str, Any]
    raw_frame_hex: str | None = None
    retry_count: int = 0


class TwinSnapshot(BaseModel):
    map_version: str = "demo-map-v1"
    robot_pose: PoseSnapshot = Field(default_factory=PoseSnapshot)
    trail: list[PoseSnapshot] = Field(default_factory=list)
    risk_zones: list[RiskZone] = Field(default_factory=list)
    heat_points: list[HeatPoint] = Field(default_factory=list)
    active_alerts: list[AlertEvent] = Field(default_factory=list)
    link_status: list[LinkSnapshot] = Field(default_factory=list)


class ReplayFrame(BaseModel):
    event_id: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    pose: PoseSnapshot = Field(default_factory=PoseSnapshot)
    sensor_values: SensorValues = Field(default_factory=SensorValues)
    vision_detections: list[VisionDetection] = Field(default_factory=list)
    heat_points: list[HeatPoint] = Field(default_factory=list)
    transport_samples: list[TransportSample] = Field(default_factory=list)
    safety_state: SafetyState = SafetyState.PATROLLING


class VisionStatus(BaseModel):
    loaded: bool = False
    model_path: str | None = None
    model_version: str = "external-onnx"
    fault: str | None = None


class SafetySnapshot(BaseModel):
    state: SafetyState = SafetyState.PATROLLING
    patrol_name: str = "路线 A"
    patrol_progress: int = Field(default=62, ge=0, le=100)


class LinkSnapshot(BaseModel):
    name: str
    online: bool = True
    p95_ms: float
    loss_ratio: float
    retry_ratio: float


class SystemSnapshot(BaseModel):
    service: str = "xuanxun-fire-edge"
    version: str = "0.1.0"
    ros_connected: bool = False
    boards_online: int = Field(default=0, ge=0)
    safety: SafetySnapshot = Field(default_factory=SafetySnapshot)
    alert: AlertEvent | None = None
    links: list[LinkSnapshot] = Field(default_factory=list)
