#!/usr/bin/env bash
set +e
{
  echo '=== IP ==='
  ip -brief addr
  echo '=== SERIAL ==='
  ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true
  echo '=== USB ==='
  lsusb 2>/dev/null || true
  echo '=== ROS NODES ==='
  source /opt/ros/humble/setup.bash
  if [ -f /home/yahboom/microros_ws/install/setup.bash ]; then
    source /home/yahboom/microros_ws/install/setup.bash
  fi
  ros2 node list
  echo '=== ROS TOPICS ==='
  ros2 topic list
  echo '=== MICRO-ROS PROCESSES ==='
  ps -ef | grep -E 'micro|ros|yahboom' | grep -v grep || true
} > /tmp/xuanxun_ros_probe.txt 2>&1
exit 0
