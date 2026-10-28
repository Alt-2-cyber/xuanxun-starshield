from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio
import json
import os
import time
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    AlertEvent,
    AlertLevel,
    ReplayFrame,
    RiskZone,
    SafetyState,
    SystemSnapshot,
    TransportIngestRequest,
    TransportSample,
)
from .control import (
    ControlMode,
    ControlSnapshot,
    ManualVelocityRequest,
    ModeRequest,
    SafetyActionRequest,
    TaskPlanner,
    TaskPlannerError,
    TaskRequest,
)
from .replay_store import ReplayStore
from .ros_adapter import RosAdapter
from .ros_bridge import RosCommandKind, RosCommandQueue, RosTelemetry
from .rosbridge_adapter import RosbridgeAdapter
from .safety_controller import ControlActionResult, SafetyArbiter
from .serial_gateway import DecodedFrame, SerialGateway, SerialPortStatus
from .twin_state import TwinState
from .transport_events import alert_event_from_payload
from .transport_experiment import summarize_transport_samples
from .vision_worker import OnnxVisionWorker, VisionGate, VisionObservation


TWIN_RESTORE_LIMIT = 1000


class EdgeState:
    def __init__(self) -> None:
        self.snapshot = SystemSnapshot()
        self.clients: set[WebSocket] = set()
        self.transport_samples: dict[str, list[TransportSample]] = {}

    def create_demo_alert(self, level: AlertLevel = AlertLevel.P2) -> AlertEvent:
        event = AlertEvent(
            event_id=f"demo-{uuid4().hex}",
            level=level,
            trigger_bits=["TEMP", "SMOKE"] if level != AlertLevel.P1 else ["TEMP"],
            sensor_values={"temperature_c": 31.6, "smoke_ratio": 0.42, "gas_ratio": 0.18},
            transport="SLE",
        )
        return event


state = EdgeState()
twin = TwinState()
replay_store = ReplayStore(
    os.getenv("EDGE_DB_PATH", "data/edge.db"),
    os.getenv("EDGE_RAW_LOG_PATH", "data/raw.jsonl"),
)
vision_worker = OnnxVisionWorker(os.getenv("VISION_MODEL_PATH"))
vision_gate = VisionGate()
serial_gateway: SerialGateway | None = None
ros_adapter: RosAdapter | None = None
rosbridge_adapter: RosbridgeAdapter | None = None
ros_command_queue = RosCommandQueue()
remote_ros_last_seen_ns = 0
remote_ros_watchdog_sequence = 0
task_planner = TaskPlanner()
control_arbiter = SafetyArbiter()


def _remember_alert(event: AlertEvent) -> None:
    twin.add_event(event)
    current = state.snapshot.alert
    if current is None or current.event_id == event.event_id or event.created_at >= current.created_at:
        state.snapshot.alert = event


def _record_alert(event: AlertEvent) -> tuple[AlertEvent, bool]:
    is_new = replay_store.record_event(event)
    if not is_new:
        event = AlertEvent.model_validate(replay_store.get_event(event.event_id))
    _remember_alert(event)
    return event, is_new


def _system_snapshot() -> SystemSnapshot:
    statuses = serial_gateway.snapshot() if serial_gateway is not None else []
    state.snapshot.boards_online = sum(1 for status in statuses if status["online"])
    twin.links = state.snapshot.links
    return state.snapshot


async def broadcast(message: dict[str, Any]) -> None:
    stale: list[WebSocket] = []
    for client in state.clients:
        try:
            await client.send_json(message)
        except Exception:
            stale.append(client)
    for client in stale:
        state.clients.discard(client)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global serial_gateway, ros_adapter, rosbridge_adapter, control_arbiter
    global ros_command_queue, remote_ros_last_seen_ns, remote_ros_watchdog_sequence
    state.snapshot = SystemSnapshot()
    state.transport_samples.clear()
    restored = replay_store.list_events(limit=TWIN_RESTORE_LIMIT)
    twin.events = {event.event_id: event for event in restored}
    twin.links = state.snapshot.links
    state.snapshot.alert = restored[0] if restored else None
    control_arbiter = SafetyArbiter()
    ros_command_queue = RosCommandQueue()
    remote_ros_last_seen_ns = 0
    remote_ros_watchdog_sequence = 0
    loop = asyncio.get_running_loop()

    async def process_serial_frame(status: SerialPortStatus, frame: DecodedFrame) -> None:
        try:
            payload = json.loads(frame.payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            status.last_error = f"invalid JSON payload: {exc}"
            return
        await ingest_transport_payload(
            payload,
            transport=status.label,
            raw_frame_hex=frame.raw.hex(),
            receive_ns=frame.received_ns,
        )

    def on_serial_frame(status: SerialPortStatus, frame: DecodedFrame) -> None:
        asyncio.run_coroutine_threadsafe(process_serial_frame(status, frame), loop)

    serial_gateway = SerialGateway.from_env(on_serial_frame)
    if serial_gateway.ports:
        serial_gateway.start()

    def on_pose(pose: object) -> None:
        twin.update_pose(pose)

        async def publish() -> None:
            await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})

        asyncio.run_coroutine_threadsafe(publish(), loop)

    def on_ros_status(connected: bool) -> None:
        state.snapshot.ros_connected = connected
        control_arbiter.set_ros_connected(connected)
        asyncio.run_coroutine_threadsafe(_publish_control_state(), loop)

    def on_scan_distance(distance_m: float | None) -> None:
        control_arbiter.update_obstacle_distance(distance_m)

    ros_adapter = RosAdapter(on_pose, on_ros_status, on_scan_distance)
    if ros_adapter.enabled_from_env():
        ros_adapter.start()

    rosbridge_url = os.getenv("ROS_BRIDGE_URL", "").strip()
    if rosbridge_url:
        def on_remote_pose(pose: object) -> None:
            global remote_ros_last_seen_ns
            remote_ros_last_seen_ns = time.monotonic_ns()
            twin.update_pose(pose)
            asyncio.create_task(
                broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
            )

        def on_remote_obstacle(distance_m: float | None) -> None:
            global remote_ros_last_seen_ns
            remote_ros_last_seen_ns = time.monotonic_ns()
            control_arbiter.update_obstacle_distance(distance_m)

        def on_remote_status(connected: bool) -> None:
            global remote_ros_last_seen_ns
            state.snapshot.ros_connected = connected
            control_arbiter.set_ros_connected(connected)
            if connected:
                remote_ros_last_seen_ns = time.monotonic_ns()
            asyncio.create_task(_publish_control_state())

        rosbridge_adapter = RosbridgeAdapter(
            rosbridge_url,
            on_pose=on_remote_pose,
            on_obstacle=on_remote_obstacle,
            on_status=on_remote_status,
        )
        await rosbridge_adapter.start()
    yield
    if serial_gateway is not None:
        serial_gateway.stop()
    serial_gateway = None
    if ros_adapter is not None:
        ros_adapter.stop()
    ros_adapter = None
    if rosbridge_adapter is not None:
        await rosbridge_adapter.stop()
    rosbridge_adapter = None


app = FastAPI(
    title="智巡消防 Edge Service",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "xuanxun-fire-edge", "version": "0.1.0"}


@app.get("/api/v1/system/snapshot", response_model=SystemSnapshot)
async def system_snapshot() -> SystemSnapshot:
    return _system_snapshot()


@app.get("/api/v1/digital-twin/snapshot")
async def digital_twin_snapshot() -> dict[str, Any]:
    twin.links = state.snapshot.links
    return twin.snapshot().model_dump(mode="json")


@app.post("/api/v1/demo/alert", response_model=AlertEvent)
async def demo_alert() -> AlertEvent:
    event, _ = _record_alert(state.create_demo_alert())
    replay_store.record_frame(event.event_id, twin.snapshot().model_dump(mode="json"))
    await broadcast({"type": "alert.created", "data": event.model_dump(mode="json")})
    await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
    return event


async def ingest_transport_payload(
    payload: dict[str, Any],
    *,
    transport: str,
    raw_frame_hex: str | None = None,
    receive_ns: int | None = None,
    retry_count: int = 0,
) -> AlertEvent | None:
    event = alert_event_from_payload(payload, transport=transport)
    event_id = str(payload.get("event_id", ""))
    if event is None:
        replay_store.record_transport_sample(
            TransportSample(
                event_id=event_id or "unknown",
                transport=transport,
                t0_device_ms=int(payload.get("device_time_ms", 0)),
                t2_receive_ns=receive_ns or time.monotonic_ns(),
                retry_count=retry_count,
                status="TELEMETRY",
            ),
            raw_frame_hex=raw_frame_hex,
            payload=payload,
        )
        return None

    sample = TransportSample(
        event_id=event.event_id,
        transport=transport,
        t0_device_ms=event.device_time_ms,
        t2_receive_ns=receive_ns or time.monotonic_ns(),
        retry_count=retry_count,
    )
    samples = state.transport_samples.setdefault(event.event_id, [])
    samples.append(sample)
    event, is_new_event = _record_alert(event)
    replay_store.record_transport_sample(sample, raw_frame_hex=raw_frame_hex, payload=payload)
    replay_store.record_frame(
        event.event_id,
        ReplayFrame(
            event_id=event.event_id,
            pose=event.pose,
            sensor_values=event.sensor_values,
            heat_points=twin.snapshot().heat_points,
            transport_samples=samples,
            safety_state=state.snapshot.safety.state,
        ).model_dump(mode="json"),
    )
    if is_new_event:
        await broadcast({"type": "alert.created", "data": event.model_dump(mode="json")})
    await broadcast({"type": "transport.sample", "data": sample.model_dump(mode="json")})
    await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
    return event


@app.post("/api/v1/transport/ingest", response_model=AlertEvent | None)
async def transport_ingest(request: TransportIngestRequest) -> AlertEvent | None:
    return await ingest_transport_payload(
        request.payload,
        transport=request.transport,
        raw_frame_hex=request.raw_frame_hex,
        retry_count=request.retry_count,
    )


@app.get("/api/v1/transport/status")
async def transport_status() -> list[dict[str, object]]:
    return serial_gateway.snapshot() if serial_gateway is not None else []


@app.get("/api/v1/experiments/ab/summary")
async def transport_ab_summary() -> dict[str, Any]:
    return summarize_transport_samples(replay_store.list_transport_samples())


@app.get("/api/v1/ros/status")
async def ros_status() -> dict[str, bool]:
    return {"connected": state.snapshot.ros_connected}


@app.post("/api/v1/demo/vision", response_model=AlertEvent)
async def demo_vision() -> AlertEvent:
    event_id = f"vision-demo-{uuid4().hex}"
    for index in range(7):
        vision_gate.observe(VisionObservation(frame_id=f"{event_id}-{index}", label="smoke", confidence=0.82))
    event = AlertEvent(
        event_id=event_id,
        level=AlertLevel.P3,
        trigger_bits=["VISION"],
        sensor_values={"temperature_c": 34.2, "smoke_ratio": 0.61, "gas_ratio": 0.24},
        transport="SLE",
    )
    event, _ = _record_alert(event)
    replay_store.record_frame(event.event_id, twin.snapshot().model_dump(mode="json"))
    await broadcast({"type": "vision.detection", "data": {"event_id": event.event_id, "label": "smoke", "confidence": 0.82}})
    await broadcast({"type": "alert.created", "data": event.model_dump(mode="json")})
    await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
    return event


@app.get("/api/v1/vision/status")
async def vision_status() -> dict[str, Any]:
    return vision_worker.status().model_dump(mode="json")


@app.get("/api/v1/risk-zones")
async def risk_zones() -> list[dict[str, Any]]:
    return [zone.model_dump(mode="json") for zone in twin.risk_zones]


@app.post("/api/v1/risk-zones", response_model=RiskZone)
async def add_risk_zone(zone: RiskZone) -> RiskZone:
    added = twin.add_risk_zone(zone)
    await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
    return added


@app.get("/api/v1/events", response_model=list[AlertEvent])
async def list_events(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[AlertEvent]:
    return replay_store.list_events(limit=limit, offset=offset)


@app.post("/api/v1/alerts/{event_id}/ack", response_model=AlertEvent)
async def acknowledge_alert(event_id: str) -> AlertEvent:
    event = replay_store.acknowledge_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="event not found")
    _remember_alert(event)
    await broadcast({"type": "alert.updated", "data": event.model_dump(mode="json")})
    await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
    return event


@app.get("/api/v1/events/{event_id}/evidence")
async def event_evidence(event_id: str) -> dict[str, Any]:
    event = replay_store.get_evidence(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="event not found")
    return event


@app.get("/api/v1/events/{event_id}/replay")
async def event_replay(event_id: str) -> dict[str, Any]:
    event = replay_store.get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="event not found")
    return {"event_id": event_id, "frames": replay_store.get_replay(event_id)}


@app.post("/api/v1/safety/pause", response_model=SystemSnapshot)
async def pause_patrol(request: SafetyActionRequest | None = None) -> SystemSnapshot:
    control_arbiter.pause()
    if ros_adapter is not None:
        ros_adapter.stop_motion()
    await _dispatch_ros_command(
        request_id=request.request_id if request is not None else "safety-pause",
        kind=RosCommandKind.STOP,
        task={"safety_state": "PAUSED"},
    )
    state.snapshot.safety.state = SafetyState.PAUSED
    await _publish_control_state()
    return state.snapshot


@app.post("/api/v1/safety/estop", response_model=SystemSnapshot)
async def estop(request: SafetyActionRequest | None = None) -> SystemSnapshot:
    control_arbiter.estop()
    if ros_adapter is not None:
        ros_adapter.stop_motion()
    await _dispatch_ros_command(
        request_id=request.request_id if request is not None else "safety-estop",
        kind=RosCommandKind.STOP,
        task={"safety_state": "ESTOP_LATCHED"},
    )
    state.snapshot.safety.state = SafetyState.ESTOP_LATCHED
    await _publish_control_state()
    return state.snapshot


def _action_payload(result: ControlActionResult) -> dict[str, object]:
    return {
        "accepted": result.accepted,
        "reason": result.reason,
        "intent": result.intent.value if result.intent is not None else None,
        "task_id": result.task_id,
        "linear_x": result.linear_x,
        "angular_z": result.angular_z,
        "duration_ms": result.duration_ms,
        "spoken_response": result.spoken_response,
    }


def _refresh_remote_ros_watchdog() -> None:
    global remote_ros_watchdog_sequence
    if rosbridge_adapter is None or remote_ros_last_seen_ns == 0:
        return
    if time.monotonic_ns() - remote_ros_last_seen_ns <= 3_000_000_000:
        return
    if control_arbiter.state().ros_connected:
        control_arbiter.set_ros_connected(False)
    if remote_ros_watchdog_sequence != ros_command_queue.latest_sequence:
        command = ros_command_queue.enqueue(
            request_id="ros-watchdog-disconnect",
            kind=RosCommandKind.STOP,
        )
        remote_ros_watchdog_sequence = command.sequence


async def _dispatch_ros_command(
    *,
    request_id: str,
    kind: RosCommandKind,
    mode: ControlMode | None = None,
    linear_x: float = 0.0,
    angular_z: float = 0.0,
    duration_ms: int = 0,
    task: dict[str, Any] | None = None,
) -> None:
    ros_command_queue.enqueue(
        request_id=request_id,
        kind=kind,
        mode=mode,
        linear_x=linear_x,
        angular_z=angular_z,
        duration_ms=duration_ms,
        task=task,
    )
    if rosbridge_adapter is None:
        return
    if kind in {RosCommandKind.VELOCITY, RosCommandKind.STOP}:
        await rosbridge_adapter.publish_velocity(
            0.0 if kind == RosCommandKind.STOP else linear_x,
            0.0 if kind == RosCommandKind.STOP else angular_z,
        )
    elif kind in {RosCommandKind.TASK, RosCommandKind.SET_MODE}:
        await rosbridge_adapter.publish_task(
            task or {"kind": kind.value, "mode": mode.value if mode is not None else None}
        )


async def _publish_control_state() -> None:
    _refresh_remote_ros_watchdog()
    snapshot = control_arbiter.state()
    state.snapshot.safety.state = SafetyState(snapshot.safety_state)
    state.snapshot.ros_connected = snapshot.ros_connected
    await broadcast({"type": "control.state", "data": snapshot.model_dump(mode="json")})
    await broadcast({"type": "safety.changed", "data": _system_snapshot().model_dump(mode="json")})


@app.get("/api/v1/control/state", response_model=ControlSnapshot)
async def control_state() -> ControlSnapshot:
    _refresh_remote_ros_watchdog()
    return control_arbiter.state()


@app.get("/api/v1/ros/commands")
async def ros_commands(after: int = 0) -> dict[str, object]:
    _refresh_remote_ros_watchdog()
    return {
        "latest_sequence": ros_command_queue.latest_sequence,
        "commands": [item.model_dump(mode="json") for item in ros_command_queue.after(after)],
    }


@app.post("/api/v1/ros/telemetry")
async def ros_telemetry(telemetry: RosTelemetry) -> dict[str, object]:
    global remote_ros_last_seen_ns
    remote_ros_last_seen_ns = time.monotonic_ns()
    state.snapshot.ros_connected = telemetry.ros_connected
    control_arbiter.set_ros_connected(telemetry.ros_connected)
    control_arbiter.reconcile_ros_state(mode=telemetry.mode, safety_state=telemetry.safety_state)
    control_arbiter.update_obstacle_distance(telemetry.obstacle_distance_m)
    control_arbiter.set_ros_command_sequence(telemetry.last_command_sequence)
    if telemetry.pose is not None:
        twin.update_pose(telemetry.pose)
    await _publish_control_state()
    await broadcast({"type": "twin.snapshot", "data": twin.snapshot().model_dump(mode="json")})
    return {"accepted": True, "control": control_arbiter.state().model_dump(mode="json")}


@app.post("/api/v1/control/mode")
async def set_control_mode(request: ModeRequest) -> dict[str, object]:
    result = control_arbiter.set_mode(request.mode)
    if not result.accepted:
        raise HTTPException(status_code=409, detail=result.reason)
    await _dispatch_ros_command(
        request_id=request.request_id,
        kind=RosCommandKind.SET_MODE,
        mode=request.mode,
    )
    await _publish_control_state()
    return {"result": _action_payload(result), "state": control_arbiter.state().model_dump(mode="json")}


@app.post("/api/v1/control/task")
async def submit_control_task(request: TaskRequest) -> dict[str, object]:
    if control_arbiter.state().mode != ControlMode.LOBSTER_AI:
        raise HTTPException(status_code=409, detail="MODE_NOT_LOBSTER_AI")
    try:
        plan = task_planner.plan(request.text)
    except TaskPlannerError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    plan = plan.model_copy(update={"source": request.source})
    result = control_arbiter.accept_task(plan)
    if not result.accepted:
        await _publish_control_state()
        raise HTTPException(status_code=409, detail=result.reason)
    await _publish_control_state()
    await _dispatch_ros_command(
        request_id=request.request_id,
        kind=RosCommandKind.TASK,
        task={
            "task_id": result.task_id,
            "intent": plan.intent.value,
            "target": plan.target,
            "speed_limit_mps": plan.speed_limit_mps,
        },
    )
    return {
        "result": _action_payload(result),
        "plan": plan.model_dump(mode="json"),
        "state": control_arbiter.state().model_dump(mode="json"),
        "provider": task_planner.last_provider,
    }


@app.post("/api/v1/control/manual")
async def manual_control(request: ManualVelocityRequest) -> dict[str, object]:
    result = control_arbiter.manual_velocity(
        linear_x=request.linear_x,
        angular_z=request.angular_z,
        duration_ms=request.duration_ms,
    )
    if not result.accepted:
        await _publish_control_state()
        raise HTTPException(status_code=409, detail=result.reason)
    # This is the safety boundary. The ROS publisher is the next adapter; the
    # HTTP API never writes to ESP32 or accepts an AI-generated velocity stream.
    await _dispatch_ros_command(
        request_id=request.request_id,
        kind=RosCommandKind.VELOCITY,
        linear_x=result.linear_x,
        angular_z=result.angular_z,
        duration_ms=result.duration_ms,
    )
    await _publish_control_state()
    return {"result": _action_payload(result), "state": control_arbiter.state().model_dump(mode="json")}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    state.clients.add(websocket)
    await websocket.send_json({"type": "system.snapshot", "data": _system_snapshot().model_dump(mode="json")})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.clients.discard(websocket)


def main() -> None:
    import uvicorn

    uvicorn.run("fire_edge.app:app", host="0.0.0.0", port=8787, reload=False)
