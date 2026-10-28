from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import sqlite3

from fastapi.testclient import TestClient
import pytest

from fire_edge.models import AlertEvent, AlertLevel
from fire_edge.replay_store import ReplayStore
from fire_edge.serial_gateway import SerialGateway, encode_frame
from fire_edge.twin_state import TwinState


def ingest(client: TestClient, event_id: str = "sensor-fire-42", *, transport: str = "C-SF", level: str = "P2"):
    payload = {
        "protocol_version": 1,
        "event_id": event_id,
        "robot_id": "R01",
        "source_id": "R-SENSE",
        "message_type": "ALERT",
        "sequence": 42,
        "device_time_ms": 9001,
        "level": level,
        "trigger_bits": ["TEMP", "SMOKE"],
        "sensor_values": {"temperature_c": 46.2, "smoke_ratio": 0.4},
        "pose": {"x": 3.0, "y": 4.0},
    }
    raw = encode_frame(json.dumps(payload, separators=(",", ":")).encode()).hex()
    response = client.post(
        "/api/v1/transport/ingest",
        json={"transport": transport, "payload": payload, "raw_frame_hex": raw},
    )
    assert response.status_code == 200
    return response.json(), payload, raw


def test_empty_event_history_is_a_bare_array(edge_service) -> None:
    with TestClient(edge_service.app) as client:
        response = client.get("/api/v1/events?limit=200&offset=0")
    assert response.status_code == 200
    assert response.json() == []


def test_event_history_orders_creation_times_before_paginating(edge_service) -> None:
    for event_id, created_at in [
        ("newest", "2026-10-19T04:00:00.000009Z"),
        ("oldest", "2026-10-19T12:00:00+08:00"),
        ("middle", "2026-10-19T04:00:00.000005Z"),
    ]:
        edge_service.replay_store.record_event(AlertEvent(event_id=event_id, level=AlertLevel.P2, created_at=created_at))

    with TestClient(edge_service.app) as client:
        response = client.get("/api/v1/events")
        page = client.get("/api/v1/events?limit=1&offset=1")
        beyond_end = client.get("/api/v1/events?offset=999999999999999999999999999999")

    assert response.status_code == 200
    assert [event["event_id"] for event in response.json()] == ["newest", "middle", "oldest"]
    assert [event["event_id"] for event in page.json()] == ["middle"]
    assert beyond_end.status_code == 200
    assert beyond_end.json() == []


@pytest.mark.parametrize("query", ["limit=0", "limit=1001", "limit=-1", "limit=abc", "limit=1.5", "offset=-1", "offset=abc", "offset=1.5"])
def test_event_history_rejects_invalid_pagination(edge_service, query: str) -> None:
    with TestClient(edge_service.app) as client:
        response = client.get(f"/api/v1/events?{query}")
    assert response.status_code == 422


def test_event_history_defaults_to_200_and_accepts_maximum_limit(edge_service) -> None:
    created_at = datetime(2026, 10, 19, tzinfo=timezone.utc)
    for index in range(205):
        edge_service.replay_store.record_event(AlertEvent(
            event_id=f"event-{index}", level=AlertLevel.P1, created_at=created_at + timedelta(seconds=index),
        ))
    with TestClient(edge_service.app) as client:
        default = client.get("/api/v1/events")
        maximum = client.get("/api/v1/events?limit=1000")
        final = client.get("/api/v1/events?limit=200&offset=200")
    assert default.status_code == 200
    assert len(default.json()) == 200
    assert default.json()[0]["event_id"] == "event-204"
    assert len(maximum.json()) == 205
    assert [event["event_id"] for event in final.json()] == ["event-4", "event-3", "event-2", "event-1", "event-0"]


@pytest.mark.parametrize("safety_action,safety_state", [(None, "PATROLLING"), ("pause", "PAUSED"), ("estop", "ESTOP_LATCHED")])
def test_ack_preserves_risk_evidence_and_control_safety(edge_service, safety_action, safety_state: str) -> None:
    with TestClient(edge_service.app) as client:
        created, payload, raw = ingest(client)
        event_id = created["event_id"]
        if safety_action:
            assert client.post(f"/api/v1/safety/{safety_action}").status_code == 200
        control_before = client.get("/api/v1/control/state").json()
        commands_before = client.get("/api/v1/ros/commands").json()
        evidence_before = client.get(f"/api/v1/events/{event_id}/evidence").json()
        replay_before = client.get(f"/api/v1/events/{event_id}/replay").json()
        raw_before = edge_service.replay_store.jsonl_path.read_text(encoding="utf-8")
        at = datetime.fromisoformat(created["created_at"])
        heat_before = edge_service.twin.snapshot(at=at).heat_points

        ack = client.post(f"/api/v1/alerts/{event_id}/ack")
        assert ack.status_code == 200
        assert ack.json() == {**created, "acked": True}
        raw_after_ack = edge_service.replay_store.jsonl_path.read_text(encoding="utf-8")
        repeated = client.post(f"/api/v1/alerts/{event_id}/ack")
        assert repeated.status_code == 200
        assert repeated.json() == ack.json()
        assert edge_service.replay_store.jsonl_path.read_text(encoding="utf-8") == raw_after_ack
        assert raw_after_ack.startswith(raw_before)

        assert client.get("/api/v1/events").json() == [ack.json()]
        snapshot = client.get("/api/v1/system/snapshot").json()
        assert snapshot["alert"] == ack.json()
        assert snapshot["safety"]["state"] == safety_state
        assert client.get("/api/v1/digital-twin/snapshot").json()["active_alerts"] == [ack.json()]
        assert edge_service.twin.snapshot(at=at).heat_points == heat_before
        assert client.get("/api/v1/control/state").json() == control_before
        assert client.get("/api/v1/ros/commands").json() == commands_before
        assert client.get(f"/api/v1/events/{event_id}/replay").json() == replay_before
        evidence_after = client.get(f"/api/v1/events/{event_id}/evidence").json()
        assert evidence_after == {**evidence_before, "acked": True}
        assert evidence_after["transport_samples"][0]["payload"] == payload
        assert evidence_after["transport_samples"][0]["raw_frame_hex"] == raw


def test_ack_publishes_updated_event_and_twin_snapshot(edge_service) -> None:
    with TestClient(edge_service.app) as client:
        created, _, _ = ingest(client)
        with client.websocket_connect("/ws") as socket:
            assert socket.receive_json()["type"] == "system.snapshot"
            for _ in range(2):
                ack = client.post(f"/api/v1/alerts/{created['event_id']}/ack")
                assert ack.status_code == 200
                updated = socket.receive_json()
                twin = socket.receive_json()
                assert updated == {"type": "alert.updated", "data": ack.json()}
                assert twin["type"] == "twin.snapshot"
                assert twin["data"]["active_alerts"] == [ack.json()]


def test_unknown_ack_does_not_create_an_event(edge_service) -> None:
    with TestClient(edge_service.app) as client:
        response = client.post("/api/v1/alerts/unknown/ack")
        assert response.status_code == 404
        assert client.get("/api/v1/events").json() == []
        assert client.get("/api/v1/system/snapshot").json()["alert"] is None
        assert client.get("/api/v1/ros/commands").json()["commands"] == []


def test_ack_of_older_event_keeps_latest_system_alert(edge_service) -> None:
    with TestClient(edge_service.app) as client:
        older, _, _ = ingest(client, "older")
        newer, _, _ = ingest(client, "newer")
        ack = client.post(f"/api/v1/alerts/{older['event_id']}/ack")
        assert ack.status_code == 200
        assert client.get("/api/v1/system/snapshot").json()["alert"] == newer
        assert client.get("/api/v1/events").json() == [newer, ack.json()]
        active = {event["event_id"]: event for event in client.get("/api/v1/digital-twin/snapshot").json()["active_alerts"]}
        assert active["older"]["acked"] is True
        assert active["newer"]["acked"] is False


@pytest.mark.parametrize("demo_route", ["alert", "vision"])
def test_restart_restores_ack_and_duplicate_receipts_preserve_canonical_event(edge_service, demo_route: str) -> None:
    with TestClient(edge_service.app) as client:
        created, payload, raw = ingest(client)
        ack = client.post(f"/api/v1/alerts/{created['event_id']}/ack")
        assert ack.status_code == 200
        first_demo = client.post(f"/api/v1/demo/{demo_route}").json()
        original_frames = client.get(f"/api/v1/events/{created['event_id']}/replay").json()["frames"]
    database_path = edge_service.replay_store.database_path
    jsonl_path = edge_service.replay_store.jsonl_path
    edge_service.replay_store.close()
    edge_service.replay_store = ReplayStore(database_path, jsonl_path)
    edge_service.state = edge_service.EdgeState()
    edge_service.twin = TwinState()

    with TestClient(edge_service.app) as client:
        assert client.get("/api/v1/events").json() == [first_demo, ack.json()]
        restored = client.get("/api/v1/digital-twin/snapshot").json()["active_alerts"]
        assert {event["event_id"] for event in restored} == {created["event_id"], first_demo["event_id"]}
        assert next(event for event in restored if event["event_id"] == created["event_id"])["acked"] is True
        assert client.get("/api/v1/system/snapshot").json()["alert"] == first_demo
        assert client.get("/api/v1/ros/commands").json()["commands"] == []
        duplicate, duplicate_payload, duplicate_raw = ingest(client, transport="C-WIFI", level="P3")
        assert duplicate == ack.json()
        assert edge_service.twin.events[created["event_id"]].model_dump(mode="json") == ack.json()
        evidence = client.get(f"/api/v1/events/{created['event_id']}/evidence").json()
        assert [item["payload"] for item in evidence["transport_samples"]] == [payload, duplicate_payload]
        assert [item["raw_frame_hex"] for item in evidence["transport_samples"]] == [raw, duplicate_raw]
        assert client.get(f"/api/v1/events/{created['event_id']}/replay").json()["frames"][:len(original_frames)] == original_frames
        second_demo = client.post(f"/api/v1/demo/{demo_route}").json()
        assert second_demo["event_id"] != first_demo["event_id"]
        assert len(client.get("/api/v1/events").json()) == 3
        assert client.get(f"/api/v1/events/{first_demo['event_id']}/evidence").json()["event_id"] == first_demo["event_id"]


def test_ack_does_not_reactivate_a_cleared_historical_event(edge_service) -> None:
    event = AlertEvent(event_id="cleared", level=AlertLevel.CLEARED, status="CLEARED")
    edge_service.replay_store.record_event(event)
    with TestClient(edge_service.app) as client:
        ack = client.post("/api/v1/alerts/cleared/ack")
        assert ack.status_code == 200
        assert ack.json() == {**event.model_dump(mode="json"), "acked": True}
        twin = client.get("/api/v1/digital-twin/snapshot").json()
        assert twin["active_alerts"] == []
        assert all(point["source_event_id"] != "cleared" for point in twin["heat_points"])


def test_legacy_event_database_is_restored_without_overwriting_evidence(edge_service, tmp_path) -> None:
    database_path = tmp_path / "legacy.db"
    event = AlertEvent(event_id="legacy-event", level=AlertLevel.P2, acked=True)
    with sqlite3.connect(database_path) as connection:
        connection.execute("CREATE TABLE events (event_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
        connection.execute("INSERT INTO events VALUES (?, ?)", (event.event_id, event.model_dump_json()))
    edge_service.replay_store.close()
    edge_service.replay_store = ReplayStore(database_path, tmp_path / "legacy.jsonl")
    with TestClient(edge_service.app) as client:
        response = client.get("/api/v1/events")
        assert response.status_code == 200
        assert response.json() == [event.model_dump(mode="json")]
        assert client.get("/api/v1/system/snapshot").json()["alert"] == event.model_dump(mode="json")
        duplicate, _, _ = ingest(client, event_id="legacy-event", level="P3")
        assert duplicate == event.model_dump(mode="json")


def test_restore_window_keeps_older_events_queryable_and_acknowledgeable(edge_service) -> None:
    created_at = datetime(2026, 10, 19, tzinfo=timezone.utc)
    for index in range(1002):
        edge_service.replay_store.record_event(AlertEvent(
            event_id=f"history-{index}", level=AlertLevel.P2, acked=index == 0,
            created_at=created_at + timedelta(seconds=index),
        ))
    with TestClient(edge_service.app) as client:
        twin = client.get("/api/v1/digital-twin/snapshot").json()
        assert len(twin["active_alerts"]) == 1000
        assert not {"history-0", "history-1"} & {event["event_id"] for event in twin["active_alerts"]}
        page = client.get("/api/v1/events?limit=200&offset=1000").json()
        assert [event["event_id"] for event in page] == ["history-1", "history-0"]
        older, _, _ = ingest(client, event_id="history-0", level="P3")
        assert older == page[1]
        ack = client.post("/api/v1/alerts/history-1/ack")
        assert ack.status_code == 200
        assert ack.json() == {**page[0], "acked": True}
        assert client.get("/api/v1/system/snapshot").json()["alert"]["event_id"] == "history-1001"
        assert len(client.get("/api/v1/events?limit=1000").json()) == 1000
        assert len(client.get("/api/v1/events?limit=1000&offset=1000").json()) == 2


def test_failed_sqlite_ack_keeps_memory_and_persisted_event_unacknowledged(edge_service) -> None:
    with TestClient(edge_service.app, raise_server_exceptions=False) as client:
        created, _, _ = ingest(client)
        edge_service.replay_store.connection.execute("PRAGMA query_only = ON")
        try:
            response = client.post(f"/api/v1/alerts/{created['event_id']}/ack")
        finally:
            edge_service.replay_store.connection.execute("PRAGMA query_only = OFF")
        assert response.status_code == 500
        assert client.get("/api/v1/events").json() == [created]
        assert client.get("/api/v1/system/snapshot").json()["alert"] == created
        assert client.get("/api/v1/digital-twin/snapshot").json()["active_alerts"] == [created]
        assert client.get("/api/v1/ros/commands").json()["commands"] == []


def test_snapshot_without_hardware_or_latency_measurements_does_not_invent_metrics(edge_service) -> None:
    with TestClient(edge_service.app) as client:
        snapshot = client.get("/api/v1/system/snapshot").json()
        assert snapshot["boards_online"] == 0
        assert snapshot["links"] == []
        assert client.get("/api/v1/transport/status").json() == []
        ingest(client)
        assert client.get("/api/v1/system/snapshot").json()["links"] == []
        assert client.get("/api/v1/digital-twin/snapshot").json()["link_status"] == []
        with client.websocket_connect("/ws") as socket:
            initial = socket.receive_json()["data"]
            assert initial["boards_online"] == 0
            assert initial["links"] == []


def test_boards_online_tracks_actual_serial_port_statuses(edge_service) -> None:
    with TestClient(edge_service.app) as client:
        gateway = SerialGateway({"TEST-A": "C-SF", "TEST-B": "C-WIFI", "TEST-C": "offline"}, lambda *_: None)
        edge_service.serial_gateway = gateway
        gateway.statuses["TEST-A"].online = True
        gateway.statuses["TEST-B"].online = True
        assert client.get("/api/v1/system/snapshot").json()["boards_online"] == 2
        gateway.statuses["TEST-A"].online = False
        with client.websocket_connect("/ws") as socket:
            assert socket.receive_json()["data"]["boards_online"] == 1
        paused = client.post("/api/v1/safety/pause").json()
        assert paused["boards_online"] == 1
        gateway.statuses["TEST-B"].online = False
        assert client.get("/api/v1/system/snapshot").json()["boards_online"] == 0
