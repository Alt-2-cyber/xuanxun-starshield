from fire_edge.control import ControlMode
from fire_edge.models import PoseSnapshot
from fire_edge.ros_bridge import RosCommandKind, RosCommandQueue, RosTelemetry


def test_ros_command_queue_returns_ordered_commands_after_cursor() -> None:
    queue = RosCommandQueue(max_size=3)
    queue.enqueue(request_id="m-1", kind=RosCommandKind.SET_MODE, mode=ControlMode.MANUAL)
    queue.enqueue(request_id="m-2", kind=RosCommandKind.STOP)

    commands = queue.after(1)

    assert len(commands) == 1
    assert commands[0].sequence == 2
    assert commands[0].kind == RosCommandKind.STOP


def test_ros_command_queue_bounds_history_without_reordering() -> None:
    queue = RosCommandQueue(max_size=2)
    for index in range(3):
        queue.enqueue(request_id=f"v-{index}", kind=RosCommandKind.VELOCITY, linear_x=index / 10)

    commands = queue.after(0)

    assert [command.sequence for command in commands] == [2, 3]
    assert commands[-1].linear_x == 0.2


def test_ros_telemetry_keeps_pose_and_obstacle_evidence() -> None:
    telemetry = RosTelemetry(
        ros_connected=True,
        pose=PoseSnapshot(frame_id="odom", x=1.2, y=-0.4, yaw=0.3),
        obstacle_distance_m=0.32,
        last_command_sequence=7,
    )

    assert telemetry.pose.x == 1.2
    assert telemetry.obstacle_distance_m == 0.32
    assert telemetry.last_command_sequence == 7
