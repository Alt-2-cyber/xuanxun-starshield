from __future__ import annotations

from typing import Any

from .models import AlertEvent, AlertLevel, PoseSnapshot, SensorValues


def alert_event_from_payload(payload: dict[str, Any], *, transport: str) -> AlertEvent | None:
    """Convert one validated StarShield JSON payload into an alert event.

    Normal telemetry remains available to the transport/replay layer but is not
    promoted into the active-alert list unless a trigger is present.
    """
    if payload.get("protocol_version") != 1:
        return None
    event_id = str(payload.get("event_id", "")).strip()
    if not event_id:
        return None
    trigger_bits = [str(item) for item in payload.get("trigger_bits", [])]
    level_text = str(payload.get("level", "NORMAL"))
    if level_text == AlertLevel.NORMAL and not trigger_bits:
        return None
    try:
        level = AlertLevel(level_text)
    except ValueError:
        return None

    sensor_values = SensorValues.model_validate(payload.get("sensor_values") or {})
    pose = PoseSnapshot.model_validate(payload.get("pose") or {})
    return AlertEvent(
        event_id=event_id,
        robot_id=str(payload.get("robot_id", "R01")),
        source_id=str(payload.get("source_id", "R-SENSE")),
        message_type=str(payload.get("message_type", "ALERT")),
        sequence=int(payload.get("sequence", 0)),
        device_time_ms=int(payload.get("device_time_ms", 0)),
        level=level,
        trigger_bits=trigger_bits,
        sensor_values=sensor_values,
        pose=pose,
        transport=transport,
    )
