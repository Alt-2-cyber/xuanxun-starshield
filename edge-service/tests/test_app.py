from fastapi.testclient import TestClient

from fire_edge.app import app
from fire_edge.serial_gateway import encode_frame


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_demo_alert_is_visible_in_snapshot() -> None:
    with TestClient(app) as client:
        created = client.post("/api/v1/demo/alert")
        snapshot = client.get("/api/v1/system/snapshot")

    assert created.status_code == 200
    assert created.json()["event_id"].startswith("demo-")
    assert snapshot.json()["alert"]["level"] == "P2"


def test_estop_is_latched() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/safety/estop")
    assert response.status_code == 200
    assert response.json()["safety"]["state"] == "ESTOP_LATCHED"


def test_digital_twin_snapshot_has_heat_points_and_risk_zones() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/digital-twin/snapshot")

    assert response.status_code == 200
    body = response.json()
    assert body["map_version"] == "demo-map-v1"
    assert body["risk_zones"]
    assert body["heat_points"]


def test_vision_status_exposes_missing_external_model_without_fake_success() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/vision/status")

    assert response.status_code == 200
    assert response.json()["loaded"] is False
    assert "VISION_MODEL_PATH" in response.json()["fault"]


def test_demo_alert_can_be_replayed() -> None:
    with TestClient(app) as client:
        created = client.post("/api/v1/demo/alert")
        event_id = created.json()["event_id"]
        evidence = client.get(f"/api/v1/events/{event_id}/evidence")
        replay = client.get(f"/api/v1/events/{event_id}/replay")

    assert evidence.status_code == 200
    assert evidence.json()["event_id"] == event_id
    assert replay.status_code == 200
    assert replay.json()["event_id"] == event_id


def test_transport_ingest_promotes_real_frame_into_alert_and_evidence() -> None:
    payload = {
        "protocol_version": 1,
        "event_id": "serial-test-42",
        "robot_id": "R01",
        "source_id": "R-SENSE",
        "message_type": "ALERT",
        "sequence": 42,
        "device_time_ms": 9001,
        "level": "P2",
        "sensor_values": {"temperature_c": 46.2, "smoke_ratio": 0.4},
        "trigger_bits": ["TEMP", "SMOKE"],
    }
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/transport/ingest",
            json={"transport": "SLE", "payload": payload, "raw_frame_hex": encode_frame(b"x").hex()},
        )
        evidence = client.get("/api/v1/events/serial-test-42/evidence")

    assert response.status_code == 200
    assert response.json()["event_id"] == "serial-test-42"
    assert response.json()["sequence"] == 42
    assert evidence.status_code == 200
    assert evidence.json()["transport"] == "SLE"


def test_control_state_exposes_mode_and_safety_boundary() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/control/state")

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "FIXED_PATROL"
    assert body["safety_state"] in {"PATROLLING", "PAUSED", "ESTOP_LATCHED"}
    assert "voice_feedback" in body


def test_control_mode_switch_is_explicit_and_task_pause_is_local() -> None:
    with TestClient(app) as client:
        mode = client.post("/api/v1/control/mode", json={"mode": "LOBSTER_AI"})
        task = client.post(
            "/api/v1/control/task",
            json={"text": "暂停巡检", "source": "VOICE"},
        )

    assert mode.status_code == 200
    assert mode.json()["state"]["mode"] == "LOBSTER_AI"
    assert task.status_code == 200
    assert task.json()["result"]["reason"] == "PAUSED_BY_OPERATOR"


def test_control_rejects_motion_task_when_ros_is_disconnected() -> None:
    with TestClient(app) as client:
        mode = client.post("/api/v1/control/mode", json={"mode": "LOBSTER_AI"})
        response = client.post(
            "/api/v1/control/task",
            json={"text": "开始巡检", "source": "WEB"},
        )

    assert mode.status_code == 200
    assert response.status_code == 409
    assert response.json()["detail"] == "ROS_DISCONNECTED"


def test_estop_is_latched_for_control_mode_and_manual_commands() -> None:
    with TestClient(app) as client:
        estop = client.post("/api/v1/safety/estop")
        mode = client.post("/api/v1/control/mode", json={"mode": "MANUAL"})
        manual = client.post(
            "/api/v1/control/manual",
            json={"linear_x": 0.1, "angular_z": 0.0, "duration_ms": 300},
        )

    assert estop.status_code == 200
    assert mode.status_code == 409
    assert manual.status_code == 409


def test_safety_endpoints_publish_control_state_and_latch_control_snapshot() -> None:
    with TestClient(app) as client:
        paused = client.post("/api/v1/safety/pause")
        paused_control = client.get("/api/v1/control/state")
        estopped = client.post("/api/v1/safety/estop")
        estopped_control = client.get("/api/v1/control/state")

    assert paused.status_code == 200
    assert paused_control.json()["safety_state"] == "PAUSED"
    assert estopped.status_code == 200
    assert estopped_control.json()["safety_state"] == "ESTOP_LATCHED"


def test_safety_endpoints_broadcast_control_and_safety_updates() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as socket:
            initial = socket.receive_json()
            client.post("/api/v1/safety/pause")
            first = socket.receive_json()
            second = socket.receive_json()

    assert initial["type"] == "system.snapshot"
    assert {first["type"], second["type"]} == {"control.state", "safety.changed"}
    control_message = first if first["type"] == "control.state" else second
    assert control_message["data"]["safety_state"] == "PAUSED"


def test_remote_ros_telemetry_enables_control_and_updates_digital_twin() -> None:
    with TestClient(app) as client:
        telemetry = client.post(
            "/api/v1/ros/telemetry",
            json={
                "ros_connected": True,
                "pose": {"frame_id": "odom", "x": 2.0, "y": 1.0, "yaw": 0.2},
                "obstacle_distance_m": 0.8,
                "last_command_sequence": 0,
            },
        )
        control = client.get("/api/v1/control/state")
        twin = client.get("/api/v1/digital-twin/snapshot")

    assert telemetry.status_code == 200
    assert control.json()["ros_connected"] is True
    assert control.json()["ros_last_command_sequence"] == 0
    assert twin.json()["robot_pose"]["x"] == 2.0


def test_remote_ros_polls_bounded_velocity_command_after_manual_request() -> None:
    with TestClient(app) as client:
        client.post(
            "/api/v1/ros/telemetry",
            json={"ros_connected": True, "obstacle_distance_m": 2.0},
        )
        mode = client.post("/api/v1/control/mode", json={"mode": "MANUAL"})
        manual = client.post(
            "/api/v1/control/manual",
            json={"linear_x": 0.8, "angular_z": 1.2, "duration_ms": 300},
        )
        commands = client.get("/api/v1/ros/commands?after=0")

    assert mode.status_code == 200
    assert manual.status_code == 200
    assert commands.status_code == 200
    body = commands.json()
    velocity = [item for item in body["commands"] if item["kind"] == "VELOCITY"][-1]
    assert velocity["linear_x"] == 0.25
    assert velocity["angular_z"] == 0.8


def test_remote_ros_bridge_receives_stop_command_for_estop() -> None:
    with TestClient(app) as client:
        client.post(
            "/api/v1/ros/telemetry",
            json={"ros_connected": True, "obstacle_distance_m": 2.0},
        )
        response = client.post("/api/v1/safety/estop")
        commands = client.get("/api/v1/ros/commands?after=0")

    assert response.status_code == 200
    assert any(item["kind"] == "STOP" for item in commands.json()["commands"])


def test_remote_ros_telemetry_reconciles_mode_and_safety_state() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/ros/telemetry",
            json={
                "ros_connected": True,
                "mode": "MANUAL",
                "safety_state": "PAUSED",
                "obstacle_distance_m": 0.8,
                "last_command_sequence": 9,
            },
        )
        control = client.get("/api/v1/control/state")

    assert response.status_code == 200
    assert control.json()["mode"] == "MANUAL"
    assert control.json()["safety_state"] == "PAUSED"
    assert control.json()["ros_last_command_sequence"] == 9


def test_transport_ab_summary_pairs_same_event_from_both_receivers() -> None:
    payload = {
        "protocol_version": 1,
        "event_id": "ab-live-1",
        "robot_id": "R01",
        "source_id": "R-SENSE",
        "message_type": "ALERT",
        "sequence": 1,
        "device_time_ms": 100,
        "level": "P2",
        "sensor_values": {"temperature_c": 45.0},
        "trigger_bits": ["TEMP"],
    }
    with TestClient(app) as client:
        sle = client.post("/api/v1/transport/ingest", json={"transport": "C-SF", "payload": payload})
        wifi = client.post("/api/v1/transport/ingest", json={"transport": "C-WIFI", "payload": payload})
        summary = client.get("/api/v1/experiments/ab/summary")

    assert sle.status_code == 200
    assert wifi.status_code == 200
    assert summary.status_code == 200
    assert summary.json()["paired_events"] >= 1
    assert any(item["event_id"] == "ab-live-1" for item in summary.json()["samples"])
