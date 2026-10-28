import math

from fire_edge.ros_adapter import min_front_obstacle_distance, pose_from_values, quaternion_to_yaw


def test_quaternion_to_yaw_converts_planar_rotation() -> None:
    yaw = math.pi / 2
    assert abs(quaternion_to_yaw(0.0, 0.0, math.sin(yaw / 2), math.cos(yaw / 2)) - yaw) < 1e-6


def test_pose_from_values_preserves_frame_and_quality() -> None:
    pose = pose_from_values("odom", 1.2, -0.4, 0.25)

    assert pose.frame_id == "odom"
    assert pose.x == 1.2
    assert pose.y == -0.4
    assert pose.yaw == 0.25
    assert pose.quality == "GOOD"


def test_min_front_obstacle_distance_ignores_invalid_and_rear_ranges() -> None:
    distance = min_front_obstacle_distance(
        angle_min=-math.pi,
        angle_increment=math.pi / 4,
        ranges=[0.2, float("inf"), 1.4, 0.3, 0.6, 0.9, 0.1, 0.8, 0.7],
        range_min=0.1,
        range_max=4.0,
        front_half_angle=math.pi / 3,
    )

    assert distance == 0.3


def test_min_front_obstacle_distance_returns_none_when_front_is_clear() -> None:
    distance = min_front_obstacle_distance(
        angle_min=-math.pi,
        angle_increment=math.pi / 2,
        ranges=[5.0, 5.0, 5.0, 5.0, 5.0],
        range_min=0.1,
        range_max=4.0,
        front_half_angle=math.pi / 6,
    )

    assert distance is None
