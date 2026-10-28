import math

from fire_edge.rosbridge_adapter import (
    build_advertise,
    build_publish_twist,
    build_subscribe,
    parse_rosbridge_message,
)


def test_rosbridge_advertises_publish_topics_before_sending_commands() -> None:
    assert build_advertise("/cmd_vel", "geometry_msgs/Twist") == {
        "op": "advertise",
        "topic": "/cmd_vel",
        "type": "geometry_msgs/Twist",
        "qos": {
            "history": "keep_last",
            "depth": 10,
            "reliability": "best_effort",
            "durability": "volatile",
        },
    }


def test_rosbridge_builds_subscriptions_for_odom_and_scan() -> None:
    assert build_subscribe("/odom", "nav_msgs/Odometry")["op"] == "subscribe"
    assert build_subscribe("/scan", "sensor_msgs/LaserScan")["type"] == "sensor_msgs/LaserScan"


def test_rosbridge_builds_bounded_twist_message_shape() -> None:
    message = build_publish_twist(0.25, -0.8)

    assert message == {
        "op": "publish",
        "topic": "/cmd_vel",
        "qos": {
            "history": "keep_last",
            "depth": 10,
            "reliability": "best_effort",
            "durability": "volatile",
        },
        "msg": {
            "linear": {"x": 0.25, "y": 0.0, "z": 0.0},
            "angular": {"x": 0.0, "y": 0.0, "z": -0.8},
        },
    }


def test_rosbridge_parses_odom_and_scan_publish_messages() -> None:
    odom = parse_rosbridge_message(
        {
            "op": "publish",
            "topic": "/odom",
            "msg": {
                "header": {"frame_id": "odom"},
                "pose": {
                    "pose": {
                        "position": {"x": 1.2, "y": -0.4},
                        "orientation": {"x": 0.0, "y": 0.0, "z": math.sin(0.2 / 2), "w": math.cos(0.2 / 2)},
                    }
                },
            },
        }
    )
    scan = parse_rosbridge_message(
        {
            "op": "publish",
            "topic": "/scan",
            "msg": {
                "angle_min": -1.0,
                "angle_increment": 1.0,
                "range_min": 0.1,
                "range_max": 8.0,
                "ranges": [2.0, 0.35, 2.0],
            },
        }
    )

    assert odom.pose is not None
    assert abs(odom.pose.x - 1.2) < 1e-6
    assert abs(odom.pose.yaw - 0.2) < 1e-6
    assert scan.obstacle_distance_m == 0.35
