from fire_edge.transport_events import alert_event_from_payload


def test_alert_payload_preserves_identity_sensor_values_and_transport() -> None:
    event = alert_event_from_payload(
        {
            "protocol_version": 1,
            "event_id": "evt-42",
            "robot_id": "R01",
            "source_id": "R-SENSE",
            "message_type": "ALERT",
            "sequence": 9,
            "device_time_ms": 123456,
            "level": "P2",
            "sensor_values": {"temperature_c": 46.2, "smoke_ratio": 0.4, "gas_ratio": None},
            "trigger_bits": ["TEMP", "SMOKE"],
        },
        transport="SLE",
    )

    assert event is not None
    assert event.event_id == "evt-42"
    assert event.source_id == "R-SENSE"
    assert event.transport == "SLE"
    assert event.sequence == 9
    assert event.device_time_ms == 123456
    assert event.sensor_values.temperature_c == 46.2
    assert event.trigger_bits == ["TEMP", "SMOKE"]


def test_normal_telemetry_is_not_an_active_alert() -> None:
    event = alert_event_from_payload(
        {
            "protocol_version": 1,
            "event_id": "telemetry-1",
            "message_type": "TELEMETRY",
            "sequence": 1,
            "device_time_ms": 100,
            "level": "NORMAL",
            "sensor_values": {"temperature_c": 24.0},
            "trigger_bits": [],
        },
        transport="Wi-Fi",
    )

    assert event is None
