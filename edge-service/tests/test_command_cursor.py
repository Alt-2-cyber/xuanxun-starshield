from fire_edge.ros_bridge import reconcile_command_cursor


def test_command_cursor_resets_when_edge_service_restarts() -> None:
    assert reconcile_command_cursor(cursor=17, latest_sequence=2) == 0


def test_command_cursor_keeps_progress_for_normal_sequence() -> None:
    assert reconcile_command_cursor(cursor=17, latest_sequence=18) == 17
