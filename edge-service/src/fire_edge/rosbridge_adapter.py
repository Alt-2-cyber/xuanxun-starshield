from __future__ import annotations

import asyncio
import json
import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from .models import PoseSnapshot
from .ros_adapter import min_front_obstacle_distance, pose_from_values, quaternion_to_yaw


COMMAND_QOS = {
    "history": "keep_last",
    "depth": 10,
    "reliability": "best_effort",
    "durability": "volatile",
}


def build_subscribe(topic: str, message_type: str, *, throttle_rate: int = 0) -> dict[str, Any]:
    message: dict[str, Any] = {
        "op": "subscribe",
        "topic": topic,
        "type": message_type,
        "queue_length": 1,
    }
    if throttle_rate > 0:
        message["throttle_rate"] = throttle_rate
    return message


def build_publish_twist(linear_x: float, angular_z: float) -> dict[str, Any]:
    return {
        "op": "publish",
        "topic": "/cmd_vel",
        "qos": COMMAND_QOS,
        "msg": {
            "linear": {"x": linear_x, "y": 0.0, "z": 0.0},
            "angular": {"x": 0.0, "y": 0.0, "z": angular_z},
        },
    }


def build_advertise(topic: str, message_type: str) -> dict[str, Any]:
    return {"op": "advertise", "topic": topic, "type": message_type, "qos": COMMAND_QOS}


def build_publish_task(task: dict[str, Any]) -> dict[str, Any]:
    return {
        "op": "publish",
        "topic": "/xuanxun/task",
        "msg": {"data": json.dumps(task, ensure_ascii=False, separators=(",", ":"))},
    }


@dataclass(frozen=True)
class RosbridgeObservation:
    pose: PoseSnapshot | None = None
    obstacle_distance_m: float | None = None


def parse_rosbridge_message(message: dict[str, Any]) -> RosbridgeObservation:
    if message.get("op") != "publish":
        return RosbridgeObservation()
    topic = message.get("topic")
    data = message.get("msg") or {}
    if topic == "/odom":
        pose_data = ((data.get("pose") or {}).get("pose") or {})
        position = pose_data.get("position") or {}
        orientation = pose_data.get("orientation") or {}
        pose = pose_from_values(
            str((data.get("header") or {}).get("frame_id") or "odom"),
            float(position.get("x", 0.0)),
            float(position.get("y", 0.0)),
            quaternion_to_yaw(
                float(orientation.get("x", 0.0)),
                float(orientation.get("y", 0.0)),
                float(orientation.get("z", 0.0)),
                float(orientation.get("w", 1.0)),
            ),
        )
        return RosbridgeObservation(pose=pose)
    if topic == "/scan":
        ranges = [float(value) for value in data.get("ranges", [])]
        distance = min_front_obstacle_distance(
            angle_min=float(data.get("angle_min", 0.0)),
            angle_increment=float(data.get("angle_increment", 0.0)),
            ranges=ranges,
            range_min=float(data.get("range_min", 0.1)),
            range_max=float(data.get("range_max", 8.0)),
        )
        return RosbridgeObservation(obstacle_distance_m=distance)
    return RosbridgeObservation()


class RosbridgeAdapter:
    """Async rosbridge client used when ROS 2 runs on a separate host."""

    def __init__(
        self,
        url: str,
        *,
        on_pose: Callable[[PoseSnapshot], None],
        on_obstacle: Callable[[float | None], None],
        on_status: Callable[[bool], None],
        reconnect_delay_s: float = 2.0,
    ) -> None:
        self.url = url
        self.on_pose = on_pose
        self.on_obstacle = on_obstacle
        self.on_status = on_status
        self.reconnect_delay_s = reconnect_delay_s
        self._task: asyncio.Task[None] | None = None
        self._socket: Any = None
        self._send_lock = asyncio.Lock()
        self._stopping = False

    async def start(self) -> None:
        if self._task is None:
            self._stopping = False
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._stopping = True
        task = self._task
        self._task = None
        if self._socket is not None:
            try:
                await self._socket.close()
            except Exception:
                pass
        if task is not None:
            try:
                await asyncio.wait_for(task, timeout=3.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                task.cancel()
        self._socket = None
        self.on_status(False)

    async def publish_velocity(self, linear_x: float, angular_z: float) -> bool:
        return await self._send(build_publish_twist(linear_x, angular_z))

    async def publish_task(self, task: dict[str, Any]) -> bool:
        return await self._send(build_publish_task(task))

    async def _send(self, message: dict[str, Any]) -> bool:
        if self._socket is None:
            return False
        try:
            async with self._send_lock:
                await self._socket.send(json.dumps(message, ensure_ascii=False, separators=(",", ":")))
            return True
        except Exception:
            return False

    async def _run(self) -> None:
        try:
            import websockets
        except ImportError:
            self.on_status(False)
            return

        while not self._stopping:
            connected = False
            try:
                async with websockets.connect(
                    self.url,
                    open_timeout=5.0,
                    ping_interval=10.0,
                    ping_timeout=5.0,
                    max_size=2**22,
                ) as socket:
                    self._socket = socket
                    await socket.send(json.dumps(build_advertise("/cmd_vel", "geometry_msgs/Twist")))
                    await socket.send(json.dumps(build_advertise("/xuanxun/task", "std_msgs/String")))
                    await socket.send(json.dumps(build_subscribe("/odom", "nav_msgs/Odometry")))
                    await socket.send(json.dumps(build_subscribe("/scan", "sensor_msgs/LaserScan", throttle_rate=100)))
                    connected = True
                    self.on_status(True)
                    async for raw in socket:
                        try:
                            message = json.loads(raw)
                            observation = parse_rosbridge_message(message)
                        except (TypeError, ValueError, json.JSONDecodeError):
                            continue
                        if observation.pose is not None:
                            self.on_pose(observation.pose)
                        if observation.obstacle_distance_m is not None or message.get("topic") == "/scan":
                            self.on_obstacle(observation.obstacle_distance_m)
            except Exception:
                pass
            finally:
                self._socket = None
                if connected:
                    self.on_status(False)
            if not self._stopping:
                await asyncio.sleep(self.reconnect_delay_s)
