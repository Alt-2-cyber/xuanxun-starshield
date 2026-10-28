from fire_edge.patrol_controller import PatrolController, PatrolPose


def test_fixed_patrol_advances_toward_waypoint_with_bounded_command() -> None:
    controller = PatrolController()
    controller.start(PatrolPose(x=0.0, y=0.0, yaw=0.0), route=[(2.0, 0.0)])

    command = controller.tick(PatrolPose(x=0.0, y=0.0, yaw=0.0), obstacle_distance_m=2.0)

    assert command.reason == "PATROL_TRACKING"
    assert 0.0 < command.linear_x <= 0.20
    assert abs(command.angular_z) <= 0.80


def test_fixed_patrol_stops_when_scan_is_missing_or_obstacle_is_near() -> None:
    controller = PatrolController()
    controller.start(PatrolPose(x=0.0, y=0.0, yaw=0.0), route=[(2.0, 0.0)])

    no_scan = controller.tick(PatrolPose(x=0.0, y=0.0, yaw=0.0), obstacle_distance_m=None)
    blocked = controller.tick(PatrolPose(x=0.0, y=0.0, yaw=0.0), obstacle_distance_m=0.2)

    assert (no_scan.linear_x, no_scan.angular_z, no_scan.reason) == (0.0, 0.0, "SCAN_UNAVAILABLE")
    assert (blocked.linear_x, blocked.angular_z, blocked.reason) == (0.0, 0.0, "OBSTACLE_BLOCKED")


def test_fixed_patrol_returns_zero_when_route_is_complete() -> None:
    controller = PatrolController()
    controller.start(PatrolPose(x=0.0, y=0.0, yaw=0.0), route=[(0.05, 0.0)])

    command = controller.tick(PatrolPose(x=0.05, y=0.0, yaw=0.0), obstacle_distance_m=2.0)

    assert command.finished is True
    assert (command.linear_x, command.angular_z) == (0.0, 0.0)
