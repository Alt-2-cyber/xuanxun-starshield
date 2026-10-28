from __future__ import annotations

import math
import os
import threading
import time
from collections.abc import Callable

from .models import PoseSnapshot


def quaternion_to_yaw(x: float, y: float, z: float, w: float) -> float:
    siny_cosp = 2.0 * (w * z + x * y)
    cosy_cosp = 1.0 - 2.0 * (y * y + z * z)
    return math.atan2(siny_cosp, cosy_cosp)


def pose_from_values(frame_id: str, x: float, y: float, yaw: float) -> PoseSnapshot:
    return PoseSnapshot(frame_id=frame_id or "map", x=x, y=y, yaw=yaw, quality="GOOD")


def min_front_obstacle_distance(
    *,
    angle_min: float,
    angle_increment: float,
    ranges: list[float],
    range_min: float,
    range_max: float,
    front_half_angle: float = math.pi / 3,
) -> float | None:
    """Return the nearest valid range in a forward sector, or None if clear."""
    valid: list[float] = []
    for index, value in enumerate(ranges):
        angle = angle_min + index * angle_increment
        if abs(angle) > front_half_angle:
            continue
        if math.isfinite(value) and range_min <= value <= range_max:
            valid.append(value)
    return min(valid) if valid else None


class RosAdapter:
    """Optional rclpy subscriber, loaded only on a ROS 2 host."""

    def __init__(
        self,
        on_pose: Callable[[PoseSnapshot], None],
        on_status: Callable[[bool], None],
        on_scan_distance: Callable[[float | None], None] | None = None,
    ) -> None:
        self.on_pose = on_pose
        self.on_status = on_status
        self.on_scan_distance = on_scan_distance or (lambda _distance: None)
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._node = None
        self._rclpy = None
        self._command_lock = threading.Lock()
        self._pending_velocity: tuple[float, float, float] | None = None
        self._pending_task: str | None = None
        self._cmd_vel_publisher = None
        self._task_publisher = None
        self._twist_type = None

    @classmethod
    def enabled_from_env(cls) -> bool:
        return os.getenv("EDGE_ROS_ENABLE", "0").lower() in {"1", "true", "yes"}

    def start(self) -> bool:
        if self._thread is not None:
            return True
        try:
            import rclpy
            from nav_msgs.msg import Odometry
        except ImportError:
            self.on_status(False)
            return False

        self._rclpy = rclpy
        self._thread = threading.Thread(target=self._run, args=(Odometry,), daemon=True)
        self._thread.start()
        return True

    def stop(self) -> None:
        self._stop.set()
        if self._rclpy is not None and self._rclpy.ok():
            self._rclpy.shutdown()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self._thread = None

    def publish_velocity(self, linear_x: float, angular_z: float, duration_ms: int) -> bool:
        """Queue a bounded velocity burst for the ROS thread to publish."""
        if self._thread is None or self._node is None:
            return False
        with self._command_lock:
            self._pending_velocity = (linear_x, angular_z, time.monotonic() + duration_ms / 1000.0)
        return True

    def stop_motion(self) -> bool:
        """Queue a zero-velocity watchdog pulse for pause, estop, or link loss."""
        return self.publish_velocity(0.0, 0.0, 1000)

    def publish_task(self, task_json: str) -> bool:
        """Queue a high-level task; ROS owns the downstream navigation policy."""
        if self._thread is None or self._node is None:
            return False
        with self._command_lock:
            self._pending_task = task_json
        return True

    def _run(self, odometry_type: object) -> None:
        assert self._rclpy is not None
        rclpy = self._rclpy
        try:
            rclpy.init(args=None)
            from geometry_msgs.msg import Twist
            node = rclpy.create_node("xuanxun_fire_edge_ros_adapter")
            self._node = node
            self._twist_type = Twist
            self._cmd_vel_publisher = node.create_publisher(Twist, "/cmd_vel", 10)

            try:
                from sensor_msgs.msg import LaserScan
            except ImportError:
                LaserScan = None

            try:
                from std_msgs.msg import String
                self._task_publisher = node.create_publisher(String, "/xuanxun/task", 10)
            except ImportError:
                String = None

            def on_odom(message: object) -> None:
                pose = message.pose.pose
                orientation = pose.orientation
                self.on_pose(
                    pose_from_values(
                        message.header.frame_id,
                        float(pose.position.x),
                        float(pose.position.y),
                        quaternion_to_yaw(
                            float(orientation.x),
                            float(orientation.y),
                            float(orientation.z),
                            float(orientation.w),
                        ),
                    )
                )

            node.create_subscription(odometry_type, "/odom", on_odom, 10)
            if LaserScan is not None:
                def on_scan(message: object) -> None:
                    distance = min_front_obstacle_distance(
                        angle_min=float(message.angle_min),
                        angle_increment=float(message.angle_increment),
                        ranges=[float(value) for value in message.ranges],
                        range_min=float(message.range_min),
                        range_max=float(message.range_max),
                    )
                    self.on_scan_distance(distance)

                node.create_subscription(LaserScan, "/scan", on_scan, 10)
            self.on_status(True)
            while rclpy.ok() and not self._stop.is_set():
                rclpy.spin_once(node, timeout_sec=0.2)
                self._flush_commands(Twist, String)
        except Exception:
            self.on_status(False)
        finally:
            self._publish_zero_immediately()
            self.on_status(False)
            if self._node is not None:
                self._node.destroy_node()
                self._node = None
            self._twist_type = None

    def _publish_zero_immediately(self) -> None:
        if self._cmd_vel_publisher is None:
            return
        try:
            if self._twist_type is None:
                return
            message = self._twist_type()
            message.linear.x = 0.0
            message.angular.z = 0.0
            self._cmd_vel_publisher.publish(message)
        except Exception:
            # ROS shutdown can invalidate the publisher during teardown.
            pass

    def _flush_commands(self, twist_type: object, string_type: object | None) -> None:
        if self._cmd_vel_publisher is not None:
            with self._command_lock:
                pending = self._pending_velocity
                if pending is not None and time.monotonic() >= pending[2]:
                    self._pending_velocity = None
                    pending = (0.0, 0.0, 0.0)
            if pending is not None:
                message = twist_type()
                message.linear.x = pending[0]
                message.angular.z = pending[1]
                self._cmd_vel_publisher.publish(message)
        if self._task_publisher is not None and string_type is not None:
            with self._command_lock:
                task = self._pending_task
                self._pending_task = None
            if task is not None:
                message = string_type()
                message.data = task
                self._task_publisher.publish(message)
