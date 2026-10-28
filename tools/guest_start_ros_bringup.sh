#!/usr/bin/env bash
set +e
source /opt/ros/humble/setup.bash
if [ -f /home/yahboom/microros_ws/install/setup.bash ]; then
  source /home/yahboom/microros_ws/install/setup.bash
fi
export ROS_DOMAIN_ID=40
export CAR_TYPE=no_ptz
ros2 daemon stop >/dev/null 2>&1 || true
pkill -f 'microros_v2_bringup bringup_app.launch.py' 2>/dev/null || true
sleep 1
nohup ros2 launch microros_v2_bringup bringup_app.launch.py use_camera:=false micro_ros_agent_verbose:=3 \
  > /tmp/xuanxun_bringup.log 2>&1 &
echo $! > /tmp/xuanxun_bringup.pid
sleep 8
{
  echo '=== PID ==='
  cat /tmp/xuanxun_bringup.pid
  echo '=== NODES ==='
  ros2 node list
  echo '=== TOPICS ==='
  ros2 topic list
} > /tmp/xuanxun_bringup_probe.txt 2>&1
exit 0
