#!/usr/bin/env python3
"""Ubuntu-side ROS 2 safety bridge for the Windows edge service.

The bridge keeps the real ROS publisher next to the robot. The Windows service
only sends high-level commands and receives pose/laser telemetry over HTTP.
"""

from __future__ import annotations

import json
import math
import os
from queue import Empty, Queue
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.request import Request, urlopen

import rclpy
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from rclpy.node import Node
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy, qos_profile_sensor_data
from sensor_msgs.msg import LaserScan


MAX_LINEAR = 0.25
MAX_ANGULAR = 0.80
STOP_DISTANCE = 0.45
WAYPOINT_DISTANCE = 0.18


@dataclass
class Pose:
    x: float = 0.0
    y: float = 0.0
    yaw: float = 0.0


def clamp(value: float, limit: float) -> float:
    return max(-limit, min(limit, value))


def wrap_angle(value: float) -> float:
    return (value + math.pi) % (2.0 * math.pi) - math.pi


def front_distance(message: LaserScan) -> float | None:
    values: list[float] = []
    for index, value in enumerate(message.ranges):
        angle = float(message.angle_min) + index * float(message.angle_increment)
        if abs(angle) > math.pi / 3:
            continue
        numeric = float(value)
        if math.isfinite(numeric) and float(message.range_min) <= numeric <= float(message.range_max):
            values.append(numeric)
    return min(values) if values else None


class HttpBridge:
    def __init__(self, edge_url: str) -> None:
        self.edge_url = edge_url.rstrip("/")

    def get_commands(self, after: int) -> tuple[int, list[dict[str, Any]]]:
        with urlopen(f"{self.edge_url}/api/v1/ros/commands?after={after}", timeout=0.8) as response:
            body = json.loads(response.read().decode("utf-8"))
        return int(body.get("latest_sequence", after)), list(body.get("commands", []))

    def post_telemetry(self, payload: dict[str, Any]) -> None:
        request = Request(
            f"{self.edge_url}/api/v1/ros/telemetry",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=0.8):
            return


class SafetyBridgeNode(Node):
    def __init__(self, commands: Queue[dict[str, Any]]) -> None:
        super().__init__("xuanxun_ros_control_bridge")
        command_qos = QoSProfile(
            depth=10,
            reliability=ReliabilityPolicy.BEST_EFFORT,
            durability=DurabilityPolicy.VOLATILE,
        )
        self.publisher = self.create_publisher(Twist, "/cmd_vel", command_qos)
        self.create_subscription(Odometry, "/odom", self.on_odom, 10)
        self.create_subscription(LaserScan, "/scan", self.on_scan, qos_profile_sensor_data)
        self.timer = self.create_timer(0.05, self.tick)
        self.commands = commands
        self.pose = Pose()
        self.obstacle_distance: float | None = None
        self.last_scan_monotonic = 0.0
        self.mode = "FIXED_PATROL"
        self.paused = False
        self.estop_latched = False
        self.manual: tuple[float, float, float] | None = None
        self.route: list[tuple[float, float]] = []
        self.route_index = 0
        self.home = Pose()
        self.last_command_sequence = 0
        self.last_edge_seen = time.monotonic()
        self.lock = threading.Lock()

    def mark_edge_seen(self) -> None:
        self.last_edge_seen = time.monotonic()

    def on_odom(self, message: Odometry) -> None:
        orientation = message.pose.pose.orientation
        self.pose = Pose(
            x=float(message.pose.pose.position.x),
            y=float(message.pose.pose.position.y),
            yaw=math.atan2(
                2.0 * (float(orientation.w) * float(orientation.z)),
                1.0 - 2.0 * float(orientation.z) * float(orientation.z),
            ),
        )

    def on_scan(self, message: LaserScan) -> None:
        self.obstacle_distance = front_distance(message)
        self.last_scan_monotonic = time.monotonic()

    def apply_commands(self) -> None:
        while True:
            try:
                command = self.commands.get_nowait()
            except Empty:
                return
            self.last_command_sequence = int(command.get("sequence", self.last_command_sequence))
            kind = str(command.get("kind", ""))
            if kind == "SET_MODE":
                self.mode = str(command.get("mode") or "FIXED_PATROL")
                if self.mode == "FIXED_PATROL":
                    self.start_route([(self.home.x + 1.5, self.home.y), (self.home.x + 1.5, self.home.y + 1.5), (self.home.x, self.home.y + 1.5), (self.home.x, self.home.y)])
                else:
                    self.stop_route()
            elif kind == "VELOCITY":
                if self.mode == "MANUAL" and not self.estop_latched and not self.paused:
                    self.manual = (
                        clamp(float(command.get("linear_x", 0.0)), MAX_LINEAR),
                        clamp(float(command.get("angular_z", 0.0)), MAX_ANGULAR),
                        time.monotonic() + max(0, int(command.get("duration_ms", 0))) / 1000.0,
                    )
            elif kind == "STOP":
                self.manual = None
                self.stop_route()
                safety = str((command.get("task") or {}).get("safety_state", "PAUSED"))
                self.estop_latched = self.estop_latched or safety == "ESTOP_LATCHED"
                self.paused = True
            elif kind == "TASK":
                self.apply_task(command.get("task") or {})

    def apply_task(self, task: dict[str, Any]) -> None:
        intent = str(task.get("intent", ""))
        if intent == "RESUME" and not self.estop_latched:
            self.paused = False
            return
        if intent in {"PAUSE", "STOP"}:
            self.paused = True
            self.manual = None
            self.stop_route()
            return
        if intent == "START_PATROL":
            self.mode = "FIXED_PATROL"
            self.paused = False
            self.start_route([(self.home.x + 1.5, self.home.y), (self.home.x + 1.5, self.home.y + 1.5), (self.home.x, self.home.y + 1.5), (self.home.x, self.home.y)])
        elif intent == "RETURN_HOME":
            self.mode = "FIXED_PATROL"
            self.paused = False
            self.start_route([(self.home.x, self.home.y)])
        elif intent == "GO_TO_PATROL_POINT":
            self.mode = "FIXED_PATROL"
            self.paused = False
            self.start_route([(self.home.x + 1.5, self.home.y)])

    def start_route(self, route: list[tuple[float, float]]) -> None:
        self.route = route
        self.route_index = 0

    def stop_route(self) -> None:
        self.route = []
        self.route_index = 0

    def tick(self) -> None:
        self.apply_commands()
        command = Twist()
        if time.monotonic() - self.last_edge_seen > 2.0:
            self.manual = None
            self.stop_route()
            self.publisher.publish(command)
            return
        if self.estop_latched or self.paused:
            self.publisher.publish(command)
            return
        if time.monotonic() - self.last_scan_monotonic > 1.0 or self.obstacle_distance is None:
            self.publisher.publish(command)
            return
        if self.obstacle_distance < STOP_DISTANCE:
            self.publisher.publish(command)
            return
        if self.mode == "MANUAL" and self.manual is not None:
            linear, angular, expires_at = self.manual
            if time.monotonic() <= expires_at:
                command.linear.x = linear
                command.angular.z = angular
            else:
                self.manual = None
        elif self.mode == "FIXED_PATROL" and self.route_index < len(self.route):
            target_x, target_y = self.route[self.route_index]
            distance = math.hypot(target_x - self.pose.x, target_y - self.pose.y)
            if distance <= WAYPOINT_DISTANCE:
                self.route_index += 1
            if self.route_index < len(self.route):
                target_x, target_y = self.route[self.route_index]
                error = wrap_angle(math.atan2(target_y - self.pose.y, target_x - self.pose.x) - self.pose.yaw)
                command.angular.z = clamp(error * 1.4, MAX_ANGULAR)
                command.linear.x = MAX_LINEAR if abs(error) < 0.75 else 0.0
        self.publisher.publish(command)

    def telemetry(self) -> dict[str, Any]:
        safety_state = "ESTOP_LATCHED" if self.estop_latched else ("PAUSED" if self.paused else "PATROLLING")
        return {
            "ros_connected": True,
            "mode": self.mode,
            "safety_state": safety_state,
            "pose": {"frame_id": "odom", "x": self.pose.x, "y": self.pose.y, "yaw": self.pose.yaw, "quality": "GOOD"},
            "obstacle_distance_m": self.obstacle_distance,
            "last_command_sequence": self.last_command_sequence,
        }


def main() -> None:
    edge_url = os.getenv("XUANXUN_EDGE_URL", "http://10.19.20.168:8787")
    command_q: Queue[dict[str, Any]] = Queue()
    bridge = HttpBridge(edge_url)
    rclpy.init()
    node = SafetyBridgeNode(command_q)
    stop_event = threading.Event()

    def http_loop() -> None:
        cursor = 0
        last_telemetry = 0.0
        while not stop_event.is_set():
            try:
                latest_sequence, commands = bridge.get_commands(cursor)
                if latest_sequence < cursor:
                    cursor = 0
                    continue
                for command in commands:
                    cursor = max(cursor, int(command.get("sequence", cursor)))
                    command_q.put(command)
                node.mark_edge_seen()
            except Exception:
                pass
            now = time.monotonic()
            if now - last_telemetry >= 0.5:
                try:
                    bridge.post_telemetry(node.telemetry())
                    node.mark_edge_seen()
                    last_telemetry = now
                except Exception:
                    pass
            time.sleep(0.1)

    worker = threading.Thread(target=http_loop, daemon=True)
    worker.start()
    try:
        rclpy.spin(node)
    finally:
        stop_event.set()
        worker.join(timeout=2.0)
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
