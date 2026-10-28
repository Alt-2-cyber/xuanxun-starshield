# Edge service

Ubuntu/Windows 现场边缘服务。它把中控端 C-SF/C-WIFI 的串口帧、ROS 2
机器人状态、视觉确认和 Web/App 推送汇入同一条事件时间轴。

- FastAPI health endpoint
- 系统状态快照
- WebSocket 初始快照
- 模拟 P2/P3 事件
- 普通暂停和急停锁存状态
- StarShield `FA CE` UART 帧解码、CRC 校验、JSON 事件接入
- SQLite 事件/回放索引与 JSONL 原始帧落盘
- 事件历史分页、人工确认持久化、重启恢复和告警更新推送
- `/api/v1/transport/status` 显示中控串口在线、帧数和 CRC 错误
- 任务级控制 API：模式切换、龙虾任务解析、手动速度安全仲裁和急停锁存
- Windows/Ubuntu 分主机时，通过 `/api/v1/ros/commands` 和 `/api/v1/ros/telemetry` 与 `tools/ros_control_bridge.py` 对接

## 现场运行

在 Windows 主机监听两块中控板时：

```powershell
$env:STARSHIELD_SERIAL_PORTS = 'COM15:C-SF,COM16:C-WIFI'
$env:STARSHIELD_SERIAL_BAUDRATE = '115200'
$env:EDGE_DB_PATH = '.\data\edge.db'
$env:EDGE_RAW_LOG_PATH = '.\data\raw.jsonl'
$env:EDGE_ROS_ENABLE = '0' # Windows 主机；Ubuntu ROS Python 环境改为 1
& .\.venv\Scripts\python.exe -m fire_edge.app
```

`STARSHIELD_SERIAL_PORTS` 的格式是 `端口:链路标签`，端口可替换为 Ubuntu
的 `/dev/ttyUSB0`、`/dev/ttyUSB1`。未配置时服务不打开任何串口，便于离线
运行前端和单元测试。

## 告警事件 API

`GET /api/v1/events?limit=200&offset=0` 直接返回 `AlertEvent[]`，没有额外的
`data`/`items` 包装。默认 `limit=200`、`offset=0`；`limit` 必须为 1–1000
的整数，`offset` 必须为非负整数，非法参数返回 422。所有事件从 SQLite
按原始 `created_at` 倒序分页，同一时刻按入库顺序倒序；超出末尾返回 `[]`。
人工确认不会改变创建时间、排序位置或告警级别。

`POST /api/v1/alerts/{event_id}/ack` 不需要请求体，成功返回完整的更新后
`AlertEvent`，仅将 `acked` 设为 `true`；未知事件返回 404
`{"detail":"event not found"}`。重复确认返回相同事件，数据库及审计日志不
重复修改；每次成功请求仍依次向 `/ws` 广播 `alert.updated` 和
`twin.snapshot`。消息外层维持 `type`/`data`：`alert.updated.data` 是完整
`AlertEvent`，`twin.snapshot.data` 是完整孪生快照，其中仍包含已确认的
活动告警。
人工确认只表示操作员已知悉，不清除风险、不改变 `level`/`status`、热力图
规则或安全状态，不解除暂停/急停，也不发送 ROS 控制指令。确认较早的事件
不会替换系统快照中的最新告警；数据库提交成功后才同步内存 twin 和当前
`system.snapshot.alert`。

`GET /api/v1/events/{event_id}/evidence` 保留既有响应层级，返回完整事件和
`transport_samples`。`GET /api/v1/events/{event_id}/replay` 仍返回
`{"event_id":"…","frames":[…]}`。确认不会重写原始帧、传输样本或历史回放；
第一次确认只追加一条 `alert.updated` JSONL 审计记录。

同一 `event_id` 的首次入库事件是原始事件，SLE/Wi-Fi 重复到达或重启后的
重传不会覆盖它的创建时间、原始内容或确认状态；每次收到的传输及原始载荷
仍分别保存为证据。`/api/v1/demo/alert` 和 `/api/v1/demo/vision` 生成的 ID
带 UUID，避免进程重启后覆盖以前的演示事件。

启动时自动为旧版 `events(event_id,payload)` 表补充创建时间索引，不改写旧
事件内容；最新 1000 条持久化事件回填至 twin，系统快照恢复最新一条。
更早的事件仍可通过分页 API 查询、确认和查看证据；访问较早事件的确认或
接收其重传时，也会将其加入内存 twin。该 1000 条限制只针对启动回填，运行
期间新增事件仍会进入 twin。风险区域和机器人轨迹目前不做重启持久化。

## 在线状态与链路测量

`system.snapshot.boards_online` 为当前实际已打开且在线的本机串口连接数，
与 `/api/v1/transport/status` 中 `online=true` 的数量一致；未配置串口时为
0。它不代表所有远端板卡的心跳在线数。

当前没有可用的同步时钟端到端延迟、丢包率或重试率测量，系统快照的
`links` 和孪生快照的 `link_status` 均返回 `[]`，不会提供固定演示 p95。
收到传输帧也不会将不同设备时钟和主机时钟直接相减作为延迟。
`/api/v1/experiments/ab/summary` 继续依据实际收到的同事件双链路样本，单独
报告接收时间差；该时间差不等于任一链路的端到端延迟。

## 测试

```powershell
& .\.venv\Scripts\python.exe -m pytest --quiet
```

`tests/conftest.py` 在应用导入前将 SQLite 路径隔离到内存，再为每项测试提供
临时磁盘数据库及 JSONL 日志，同时禁用现场串口和 ROS 连接。测试不会读取
或改写用户的 `data/*.db`。事件回归覆盖真实帧接入、分页与参数校验、重复
确认、证据与安全状态保留、WebSocket 广播、旧表迁移、重启恢复、恢复窗口
之外的历史事件，以及写库失败时的内存一致性。

## 龙虾任务模式

`POST /api/v1/control/task` 接收语音转写或文字，不接受速度流。边缘服务先
使用本地中文规则解析；规则无法识别时，若配置了 `DEEPSEEK_API_KEY`，再请求
DeepSeek 的 JSON 输出。真实密钥只放在 Ubuntu 进程环境变量中：

```bash
export DEEPSEEK_API_KEY='在本机安全注入，不写入仓库'
export DEEPSEEK_MODEL='deepseek-chat'
```

ROS 适配器订阅 `/scan` 前向扇区并在 `0.45 m` 内停车，所有手动速度先经过
`0.25 m/s` 线速度和 `0.80 rad/s` 角速度限幅；急停锁存后不接受模式和运动
指令。高层任务会通过 `/xuanxun/task` 交给 ROS 侧导航/巡检节点，禁止 AI
直接控制 ESP32。

协议帧为 `FA CE | version | flags | payload_len(le16) | JSON | CRC16-CCITT-FALSE(le16)`。
业务事件的 `event_id/sequence/device_time_ms` 原样保留，重复 event_id 不重复
创建活动告警，但每条 SLE/Wi-Fi 传输仍会写入证据。

## ROS 2 边界

ROS 2 机器人侧由 MicroROS V2 原有 bringup 管理，边缘服务通过同一现场局域网
读取 ROS 2/rosbridge 或后续 rclpy 适配器。当前 VM 验证过 `CAR_TYPE=no_ptz`、
ROS Domain ID 40 下的 `/scan`、`/odom`、`/imu`、`/camera/image_raw` 和 TF 话题；
相机地址仍以 VM 中 `.system_cfg/robot_info.json` 为准。

在 Ubuntu 且已 `source /opt/ros/humble/setup.bash` 的环境中，可设置
`EDGE_ROS_ENABLE=1`。服务会订阅 `/odom`，把位姿写入数字孪生轨迹；没有
`rclpy` 时会自动报告 ROS 未连接，不影响串口告警链路。

当五块星闪板在 Windows、ROS 2 在 Ubuntu VM 时，推荐运行项目根目录的
`tools/ros_control_bridge.py`：

```bash
source /opt/ros/humble/setup.bash
export ROS_DOMAIN_ID=40
export XUANXUN_EDGE_URL=http://10.19.20.168:8787
python3 /home/yahboom/ros_control_bridge.py
```

桥接器在 Ubuntu 原生发布 `/cmd_vel`，订阅 `/odom`、`/scan`，激光数据缺失、
前方小于 `0.45 m` 或边缘服务超过 2 秒无响应时发布零速度。Windows edge
service 不需要安装 `rclpy`；它通过命令队列和遥测接口完成跨主机协同。
