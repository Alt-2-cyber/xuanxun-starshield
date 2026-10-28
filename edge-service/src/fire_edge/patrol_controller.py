from __future__ import annotations

from dataclasses import dataclass
import math


MAX_PATROL_LINEAR = 0.20
MAX_PATROL_ANGULAR = 0.80
OBSTACLE_STOP_DISTANCE = 0.45
WAYPOINT_REACHED_DISTANCE = 0.18


@dataclass(frozen=True)
class PatrolPose:
    x: float
    y: float
    yaw: float


@dataclass(frozen=True)
class PatrolCommand:
    linear_x: float
    angular_z: float
    reason: str
    finished: bool = False


def _wrap_angle(angle: float) -> float:
    return (angle + math.pi) % (2.0 * math.pi) - math.pi


class PatrolController:
    """Small, deterministic odom-frame patrol controller for the ROS bridge.

    It deliberately stops when `/scan` is unavailable. A production map/nav2
    executor can replace this class without changing the edge command contract.
    """

    def __init__(self) -> None:
        self._route: list[tuple[float, float]] = []
        self._index = 0
        self._active = False

    def start(self, home: PatrolPose, route: list[tuple[float, float]] | None = None) -> None:
        selected = route or [(home.x + 1.5, home.y), (home.x + 1.5, home.y + 1.5), (home.x, home.y + 1.5), (home.x, home.y)]
        self._route = list(selected)
        self._index = 0
        self._active = bool(self._route)

    def stop(self) -> None:
        self._active = False

    @property
    def active(self) -> bool:
        return self._active

    def tick(self, pose: PatrolPose, obstacle_distance_m: float | None) -> PatrolCommand:
        if not self._active:
            return PatrolCommand(0.0, 0.0, "PATROL_IDLE")
        if obstacle_distance_m is None:
            return PatrolCommand(0.0, 0.0, "SCAN_UNAVAILABLE")
        if obstacle_distance_m < OBSTACLE_STOP_DISTANCE:
            return PatrolCommand(0.0, 0.0, "OBSTACLE_BLOCKED")

        target_x, target_y = self._route[self._index]
        dx = target_x - pose.x
        dy = target_y - pose.y
        distance = math.hypot(dx, dy)
        if distance <= WAYPOINT_REACHED_DISTANCE:
            self._index += 1
            if self._index >= len(self._route):
                self._active = False
                return PatrolCommand(0.0, 0.0, "PATROL_COMPLETE", finished=True)
            target_x, target_y = self._route[self._index]
            dx = target_x - pose.x
            dy = target_y - pose.y

        heading_error = _wrap_angle(math.atan2(dy, dx) - pose.yaw)
        angular = max(-MAX_PATROL_ANGULAR, min(MAX_PATROL_ANGULAR, heading_error * 1.4))
        linear = MAX_PATROL_LINEAR if abs(heading_error) < 0.75 else 0.0
        return PatrolCommand(linear, angular, "PATROL_TRACKING")
