# 玄巡·星盾开发日志

项目：玄巡·星盾，基于 MicroROS V2 与 WS63/HH-D02 风格星闪板的地下空间移动消防巡检系统。

本日志记录可复核的工程动作和证据。`PASS` 表示已在当前环境执行并有输出支撑；`PENDING` 表示仍需要实体操作、设备接线或现场数据，不能当作完成。

## 2026-09-18

### 软件与协议

- 建立项目目录：`xuanxun-starshield/`。
- 完成 edge service、Web 控制台、原生 ArkUI 鸿蒙 App 的第一版 vertical slice。
- edge service 增加 `VisionGate`：7 帧窗口中至少 5 帧、置信度至少 0.75 才确认视觉 P3。
- 增加 SQLite 事件索引、JSONL 原始证据、风险热区和回放接口。
- 固化 StarShield UART 帧：`FA CE | version:u8 | flags:u8 | payload_len:le16 | JSON | CRC16-CCITT-FALSE:le16`。
- 协议主机测试通过，覆盖字段保留、转义 JSON、长度限制、分片重组、CRC 和版本校验。

### 鸿蒙 App

- 修复 ArkUI `@Prop` 不允许函数回调导致的运行时崩溃。
- 清理 DevEco 残留 `MyApplication.iml`，保留 `XuanXunStarShield` 和 `entry` 模块。
- HAP 构建、安装、冷启动验证通过；`com.xuanxun.starshield/EntryAbility` 进入前台。
- 模拟器首屏为配对页，未宣称真实鸿蒙手机签名安装已完成。

## 2026-09-19

### 设备枚举与旧固件记录

- 主机枚举到五块 `USB-SERIAL CH340K`：`COM12`、`COM13`、`COM14`、`COM15`、`COM16`。
- 烧录前串口证据保存于：
  `星闪硬件代码/evidence/preflash-20260919/`。
- 旧固件识别结果：
  - `COM12`：`[FOREST_WIFI]`，扫描 SSID `ipone`。
  - `COM13`：旧救援网络受害端 `VD-003`。
  - `COM14`：旧救援网络受害端 `VD-002`。
  - `COM15`：旧救援网络受害端 `VD-001`。
  - `COM16`：旧救援网络中继/根侧日志。
- 旧固件未被误认为 StarShield A/B 实验数据。

### StarShield 构建环境

- 从本地参考 SDK 建立独立 staging：`D:\s0`。
- staging 未改动旧的 `D:\jr\v`、`D:\jr\r`、`D:\jr\n` 救援工程。
- 在 staging 父级 CMake/Kconfig 接入 StarShield overlay。
- 首次长路径构建因 Windows `CreateProcess` 命令行过长失败；迁移到 `D:\s0` 后解决。
- `ws63-liteos-app` 完整构建达到 `801/801`，签名镜像和 `.fwpkg` 均可生成。

### UART 与 LED 引脚审计

- 从 WS63E 原理图和 SDK IO 复用表确认：
  - UART1 参考：GPIO15=TXD、GPIO16=RXD。
  - UART2 参考：GPIO8=TXD、GPIO7=RXD。
  - RGB LED：GPIO7、GPIO10、GPIO11，低电平点亮。
- 因 UART2 RX 与红色 LED 共用 GPIO7，角色 LED 编码调整为：
  - `R-SENSE`：绿色，mask `2`。
  - `R-SF`：红色，mask `1`。
  - `R-WIFI`：黄色，mask `4`。
  - `C-SF`：红色+绿色，mask `3`。
  - `C-WIFI`：红色+黄色，mask `5`。
- UART2 构建默认固定为 GPIO8/GPIO7；实际板卡仍需回环确认，不能替代实物测量。

### 五角色产物

角色包位于：`星闪硬件代码/builds/s0-20260919/`。

| 角色 | 产物 | 构建状态 | 关键宏验证 |
|---|---|---|---|
| R-SENSE | `R-SENSE_all.fwpkg` | PASS | `CONFIG_STARSHIELD_ROLE_R_SENSE=y` |
| R-SF | `R-SF_all.fwpkg` | PASS | `CONFIG_STARSHIELD_ROLE_R_SF=y` |
| R-WIFI | `R-WIFI_all.fwpkg` | PASS | `CONFIG_STARSHIELD_ROLE_R_WIFI=y`，带测试 Wi-Fi 参数 |
| C-SF | `C-SF_all.fwpkg` | PASS | `CONFIG_STARSHIELD_ROLE_C_SF=y` |
| C-WIFI | `C-WIFI_all.fwpkg` | PASS | `CONFIG_STARSHIELD_ROLE_C_WIFI=y`，带测试 Wi-Fi 参数 |

R-WIFI/C-WIFI 的网络参数为构建时注入，不写入源代码。旧的 `XuanXunS0`/SoftAP 方案不再作为现场方案。

批量脚本：`星闪硬件代码/build_starshield_s0.ps1`。脚本会检查 role 宏和归档包 SHA-256。

### 鸿蒙与 ROS 2 现场验证

- VM guest 实测网卡：`ens33 10.19.20.217/24`。
- VM guest 实测串口：`/dev/ttyUSB0` 为 CP210x，`/dev/ttyUSB1` 为 CH340。
- 初始 ROS 只有 `/rosout`、`/parameter_events`。
- 设置 `ROS_DOMAIN_ID=40`、`CAR_TYPE=no_ptz` 后启动 `bringup_app.launch.py`，实测出现：
  `/scan`、`/odom`、`/odom_raw`、`/imu`、`/camera/image_raw`、`/tf`、`/tf_static`。
- ROS 证据：`evidence/xuanxun_bringup_probe.txt`、`evidence/xuanxun_bringup.log`。
- 已知环境问题：相机配置地址 `10.19.20.90:81` 当前不可达；rosbridge 端口已有旧进程占用；不影响 `/scan`、`/odom`、`/imu` 话题已出现的判断。

### Edge service 串口网关

- 新增 `serial_gateway.py`：CRC16、分片重组、版本/长度检查、端口状态和坏帧计数。
- 新增 `transport_events.py`：把 StarShield JSON payload 转成统一 `AlertEvent`；NORMAL 无触发位的遥测不提升为活动告警。
- 新增 `/api/v1/transport/ingest`、`/api/v1/transport/status`。
- 重复 event_id 不重复创建活动告警，但每条 SLE/Wi-Fi 传输样本会写入 SQLite/JSONL 证据。
- edge service 测试：`16 passed`。
- 安装 `pyserial 3.5` 并更新 `edge-service/uv.lock`。
- 现场主机服务实测监听 `COM15:C-SF`、`COM16:C-WIFI`，两个端口 `online=true`；旧救援固件字节流被读取但没有伪造 StarShield 帧，当前 `frames_received=0`。
- 通过 `/api/v1/transport/ingest` 注入一帧协议等价事件，实测生成统一告警并在 evidence 中保存 `event_id`、`sequence`、`device_time_ms` 和传输样本。
- 增加可选 `rclpy` `/odom` 适配器；全套测试更新为 `18 passed`。
- 主机运行配置示例：

  ```powershell
  $env:STARSHIELD_SERIAL_PORTS = 'COM15:C-SF,COM16:C-WIFI'
  $env:STARSHIELD_SERIAL_BAUDRATE = '115200'
  ```

## 当前待办与验收门

| 项目 | 状态 | 说明 |
|---|---|---|
| 五包源码构建 | PASS | 五种 role 均有独立 `.fwpkg`；最新包已切换到 GPIO5/SK6805 驱动 |
| 五板实体烧录 | PENDING | BurnTool 已识别 COM12，但必须在等待期间按板上 RST/Boot 流程；首次 COM12 因未进入 bootrom 超时 |
| LED 颜色验收 | PENDING | 烧录后需拍照/读取启动日志确认五种颜色 |
| UART1/UART2 回环 | PENDING | 需要真实板端 TX/RX 线和实际 HH-D02 接线确认 |
| SLE 事件到 C-SF | PENDING | 需要 R-SENSE/R-SF/C-SF 三板新固件运行 |
| Wi-Fi UDP 到 C-WIFI | PENDING | 需要 R-WIFI/C-WIFI 上电并加入同一测试网络 |
| ROS 与中控事件融合 | PENDING | 串口网关已实现，等待真实 C-SF/C-WIFI 帧 |
| Web/App 真实告警 | PENDING | demo 链路已验证，真实帧需完成后续验收 |
| SLE/Wi-Fi 正式 A/B 数据 | PENDING | 不使用旧救援日志，需同一 event_id 双链路采样 |

## 2026-09-19 追加：第一轮实体烧录复盘

- 第一轮五板烧录结果：`COM12–COM16` 均曾以 BurnTool 退出码 0 完成写入；证据在 `星闪硬件代码/evidence/flash-20260919/`。
- 现场反馈五块板载灯显示同一颜色；启动日志进一步显示第一轮 R-SENSE 使用了 UART2 未验证默认值，且旧包没有 role/mask 启动打印，因此第一轮 LED 身份验收判定失败，不能作为最终交付。
- 根因：第一轮批量包只在 Kconfig 默认中声明了 LED mask/UART2，生成目标没有把这些自定义符号可靠地注入最终编译宏；此外启动日志缺少身份自描述。
- 修正：
  - `starshield_app.c` 增加 `[STARSHIELD] role=... led_mask=... uart2_tx=... uart2_rx=...` 启动行。
  - 构建脚本显式注入 `UART2 TX=8/RX=7` 和五个 mask：`R-SENSE=2`、`R-SF=1`、`R-WIFI=4`、`C-SF=3`、`C-WIFI=5`。
  - UART2 使用 GPIO7 时关闭红色通道，避免 UART2 RX 与红色 LED 争用。
- 第二轮最终包已在 staging 完成 `801/801` 构建、packet 和 role 宏验证；因中文路径编码产生了重复归档目录，已将最终包复制回正确的 `builds/s0-20260919` 目录并逐包 SHA-256 校验。
- 第二轮实体重刷正在进行，必须以 `flash-20260919-final/flash-summary.jsonl` 和五块启动日志为最终依据；物理灯色仍需人工目视确认。

## 2026-09-19 追加：HH-D02 板载灯根因与第三轮固件

- 第二轮实测颜色为“三块白、一块绿、一块黄”，不能作为五角色身份验收。
- 读取官方 HH-D02 原理图和开发板手册后确认：板载三色灯不是 GPIO7/10/11 三路独立灯，而是单线 `SK6805/SK6812` 灯珠，数据脚为 `GPIO5`；`GPIO7`/`GPIO8` 分别是 `UART2_RXD`/`UART2_TXD`。
- 根因：原 LED 驱动把 WS63E 参考板的三路 GPIO 假设套用到 HH-D02，实际没有向板载 RGB 灯发送有效数据，颜色由上电/旧状态表现决定。
- 修正：
  - `starshield_led.c` 改用官方 `demo/tricolored` 的 GPIO5 单线时序，按 SK6805 的 GRB 顺序发送 24 bit 颜色数据。
  - 五角色颜色映射冻结为：`R-SF=红(1)`、`R-SENSE=绿(2)`、`R-WIFI=蓝(4)`、`C-SF=黄(3)`、`C-WIFI=品红(5)`。
  - `CONFIG_STARSHIELD_LED_DATA_PIN=5` 显式注入构建参数；Wi-Fi 构建参数改为传递真实双引号，修复 Windows CMake 的 `missing terminating \" character`。
- 第三轮五包已完成：`R-SENSE`、`R-SF`、`R-WIFI`、`C-SF`、`C-WIFI` 均通过 `801/801`、packet 和归档；最新产物位于 `星闪硬件代码/builds/s0-20260919/`。
- 主机测试：LED 颜色映射测试通过；协议主机测试全部通过。第三轮实体烧录和五色目视验收仍待执行。

## 2026-09-19 追加：第三轮实体烧录结果

- `flash-20260919-ledfix/` 已记录 COM12-COM16 的第三轮尝试；五个端口均为 BurnTool 退出码 `4`，没有任何一块完成新包写入。
- COM12-COM14 的重启串口仍能读到旧固件 `APP|[SYS INFO]`，说明“串口可打开”不等于“已进入 bootrom”；颜色不能据此验收。
- COM12、COM13 各做了第二次握手尝试，仍为 `Ack receiving timeout / Shakehand failed`。当前不继续重复同一复位动作。
- BurnTool 帮助确认没有可替代人工下载模式的自动复位参数。下一次现场操作前必须：停止占用 COM15/COM16 的 edge service，拔插或重新上电目标板，按板卡实际下载模式执行 `BOOT/用户键 + RST`，看到握手后再烧录。
- 在新的五块 BurnTool 退出码为 `0` 且启动身份行完整前，不得把第三轮包标记为实体交付，也不得用旧固件日志做 A/B 数据。
- 已停止两个重复 edge service 实例后，对 COM12 做 `-re 3` 专项重试，仍为退出码 `4`；本轮最终结论仍是五块实体板均未更新，需现场确认 USB 线、供电、下载键时序或使用 HiSpark Studio 手动加载流程。

## 2026-09-19 追加：现场下载模式恢复与实体包写入

- 现场重新按下载模式操作后，五块板均完成第三轮新包写入，BurnTool 退出码均为 `0`：
  - `COM12/R-SENSE`：包 SHA-256 `83333A40AEC7906EE2CD4F199B046FA03EC81B8817039DAB105D93C51631F8E3`
  - `COM13/R-SF`：包 SHA-256 `625ADBB37AFD01DB2E818CE8663499A11B27C4718F97F1EA32566BFC1579D4F4`
  - `COM14/C-SF`：包 SHA-256 `B1BD63F30287C5631D62B8A37943C8170D82B2BA2E0D095BEA1E3E7D1B890819`
  - `COM15/R-WIFI`：包 SHA-256 `C4F28322243E75AAB1BA986D951836A5233798710390A5B382F0EDDD67553B79`
  - `COM16/C-WIFI`：包 SHA-256 `D10370B4394F118B6B7C0AEC7CB3851CADB21450DBAA3235355CF4B5D924C3FF`
- 启动身份已确认：
  - COM12：`role=R-SENSE led_mask=2 uart2_tx=8 uart2_rx=7`；板载灯现场确认绿色。
  - COM13：`role=R-SF led_mask=1 uart2_tx=8 uart2_rx=7`；板载灯现场确认红色。
  - COM14：`role=C-SF led_mask=3 uart2_tx=8 uart2_rx=7`；SLE server 已启动并出现真实配对连接日志；颜色待现场补充记录。
- COM15 已打印 `R-WIFI STA connect retry`，证明 R-WIFI 新固件已运行；需要 C-WIFI AP 在线后补充身份/联网验收。
- COM16 已完成新包写入；需要补抓启动身份并记录品红颜色。
- 主机当前实际枚举 `COM12-COM16` 为五块 `USB-SERIAL CH340K`；VM 当前 IP 为 `192.168.1.9`，旧探测日志中的 `10.19.20.217` 已过期。

## 现场操作记录模板

每次刷写或实验追加以下字段：

```text
时间：
板卡端口：
物理板号/序列号：
目标角色：
产物 SHA-256：
按键动作：RST / BOOT / 上电顺序
启动日志：
LED 颜色：
UART 回环：PASS / FAIL
SLE/Wi-Fi 状态：
event_id：
备注：
```

## 2026-09-19 追加：Redmi K70 统一 Wi-Fi 方案

- 现场网络确认：SSID `Redmi K70`，2.4 GHz；密码仅通过本地构建参数注入，不写入源码和日志正文。
- R-WIFI 与 C-WIFI 已改为共同 STA 模式；R-WIFI 向 `10.19.20.255:6789` 发送 UDP 广播，C-WIFI DHCP 入网后监听 `6789`，不再依赖 SoftAP `192.168.63.1`。
- 新增 `starshield_wifi_sta.c/.h` 共享扫描、认证、DHCP 连接逻辑；新增主机配置契约测试，测试通过。
- Redmi K70 新包已构建成功：R-WIFI 最新包 SHA-256 `DF736B6E542FEDBDA18E68EE7618828E34E974F93059DB83A27428F21D5FCE8A`；C-WIFI 最新包 SHA-256 `F1DF5A60287BD1F06D8423657CEF3A8E3F3C41324B573EEC18C85675F8A78B9E`。
- 车端厂家配置工具已确认支持通过 `/dev/ttyUSB0` 下发 SSID、密码、Agent IP 和 ROS Domain；VM 当前 Agent 目标为 `10.19.20.217:8090`、Domain `40`。配置脚本需用 Redmi K70 参数执行并回读校验。

## 2026-09-19 追加：现场联网与真实接收链路

- 厂家配置工具回读确认 ESP32-S3 控制板：`wifi_name=Redmi K70`、`agent_ip_addr=10.19.20.217`、`agent_ip_port=8090`、`ros_domain_id=40`。
- 控制板真实日志确认连接 Redmi K70，DHCP 地址 `10.19.20.16`，随后进入 `AGENT_CONNECTED`；VM micro-ROS Agent 正常监听 8090。
- ROS 实测：`/odom` 约 20 Hz、`/imu` 约 26 Hz；`/scan` 当前无有效发布数据，激光雷达侧仍待排查；相机子模块仍返回 `sta_ip:null`。
- C-SF 日志确认 SLE server 启动并完成过配对；当前 edge-service 监听 COM14/C-SF、COM16/C-WIFI。
- Wi-Fi 硬件闭环测试通过：主机向 `10.19.20.255:6789` 广播协议帧 `wifi-redmi-test-001`，C-WIFI 实际收到并从 COM16 转发，edge-service 记录 `frames_received=1`、`crc_errors=0`，事件证据已落盘。
- R-WIFI 与 C-WIFI 自然 R-SENSE 事件尚未出现，原因是角色架构需要板间 UART 跳线：
  - R-SENSE UART1 TX `GPIO15` -> R-SF UART1 RX `GPIO16`，两板 GND 共地；可补接反向 TX/RX。
  - R-SENSE UART2 TX `GPIO8` -> R-WIFI UART2 RX `GPIO7`，两板 GND 共地；可补接反向 TX/RX。
  - 两板分别 USB 供电，不连接两板 5V。

## 2026-09-19 追加：Wi-Fi 广播闭环与当前剩余硬件接线

- Redmi K70 STA 固件重新构建并归档：
  - R-WIFI：`DF736B6E542FEDBDA18E68EE7618828E34E974F93059DB83A27428F21D5FCE8A`
  - C-WIFI：`F1DF5A60287BD1F06D8423657CEF3A8E3F3C41324B573EEC18C85675F8A78B9E`
- R-WIFI 日志确认 `role=R-WIFI led_mask=4`、连接 Redmi K70、`DHCP bound`、广播目标 `10.19.20.255:6789`。
- C-WIFI 日志确认 `role=C-WIFI led_mask=5`、扫描并连接 Redmi K70、`DHCP bound`。
- 主机广播帧 `wifi-redmi-test-001` 经 C-WIFI 实体板转发到 COM16，edge-service 解码成功：`frames_received=1`、`crc_errors=0`，事件证据已落盘。
- edge-service 回归测试 `18 passed`；LED 映射、Wi-Fi 端点和协议主机测试均通过。
- 当前自然车端事件仍为 `0`：R-SENSE 的双 UART 输出需要实际跳线到 R-SF/R-WIFI。完成接线后，edge-service 应同时看到 C-SF 与 C-WIFI 的同一 `event_id`，再进行正式 SLE/Wi-Fi A/B 延迟实验。

## 2026-09-19 追加：龙虾任务模式与安全仲裁链路

### 架构决策

- 固化四种运行状态：固定循迹 + 激光避障、Web/App 手动控制、龙虾 AI 任务模式、暂停/急停锁存。
- AI 只负责把语音或文字转换成结构化任务意图：`START_PATROL`、`GO_TO_PATROL_POINT`、`RETURN_HOME`、`PAUSE`、`RESUME`、`STOP`；禁止生成连续速度流和急停动作。
- ROS 2 作为唯一运动安全边界，负责 `/cmd_vel` 发布、速度限幅、`/scan` 前向障碍停车、任务转发和失联降级。ESP32 固件不接受 AI 直接控制。
- DeepSeek 为可选任务解析器，密钥只从边缘服务进程环境变量 `DEEPSEEK_API_KEY` 读取，不写入源码、日志、前端或鸿蒙 App；无密钥时使用本地中文规则解析，无法识别则拒绝执行。

### 已实现

- `edge-service/src/fire_edge/control.py`：控制模式、任务模型、本地任务解析器、可选 DeepSeek JSON 适配器。
- `edge-service/src/fire_edge/safety_controller.py`：任务安全仲裁器；线速度上限 `0.25 m/s`、角速度上限 `0.80 rad/s`、前方停车阈值 `0.45 m`、急停锁存。
- `edge-service/src/fire_edge/ros_adapter.py`：订阅 `/odom` 和 `/scan`，向 `/cmd_vel` 发布限时速度，向 `/xuanxun/task` 发布结构化任务；ROS 未连接时不接受运动指令。
- 新增 API：`GET /api/v1/control/state`、`POST /api/v1/control/mode`、`POST /api/v1/control/task`、`POST /api/v1/control/manual`；普通暂停和急停接口保持兼容。
- Web 新增“任务驾驶台”：三种工作模式卡片、文字任务、浏览器语音输入、TTS 反馈、手动方向控制、障碍距离、仲裁状态和急停锁存。
- 鸿蒙 App 接入原生 `CoreSpeechKit` ASR、`AudioKit` 麦克风采集和 `CoreSpeechKit` TTS；新增模式/任务/手动控制契约，麦克风权限带用户说明。

### 本轮验证证据

- Edge service：`uv run pytest -q` -> `31 passed`，仅有既有 `httpx`/Starlette 弃用警告；新增暂停/急停控制状态回归测试。
- Web：`npm run build` -> Vite/TypeScript 构建成功；桌面浏览器 `http://127.0.0.1:5175` 实测任务驾驶台、模式切换、暂停任务、手动 ROS 断链拒绝和急停锁存。
- 实时 HTTP：`/api/v1/control/state` 返回 200；模式切换返回 200；ROS 未连接时开始巡检/手动运动返回 409；龙虾模式下“暂停巡检”返回 200 并进入 `PAUSED`。
- 鸿蒙：Hvigor `--no-daemon test` -> `BUILD SUCCESSFUL`；`--no-daemon -p product=default assembleHap` -> `BUILD SUCCESSFUL`。HAP 仍为未签名调试包。
- 当前边缘服务运行实例：Windows 主机 `COM14:C-SF`、`COM16:C-WIFI` 在线，服务监听 `8787`。
- 安全动作补强：暂停/急停会向 ROS 适配器排队零速度脉冲；ROS 适配器退出时直接发布零速度，并通过 `control.state` 广播 ROS 连接状态变化。

### 当前阻塞与下一步

- 2026-09-19 23:xx 复测时，Ubuntu ROS 2 虚拟机 `10.19.20.217:22` 不可达，导致 `/scan`、`/cmd_vel`、固定循迹、真实激光停车和车体运动尚未进行本轮实机验收。
- 2026-09-20 复测：虚拟机 SSH 端口已恢复可达，但本机 `id_ed25519` 未被 `yahboom` 接受，当前仅剩密码认证；本轮没有读取 ROS 话题，也没有把历史探测日志冒充为当前证据。
- 2026-09-20 后续现场恢复：使用现场提供的 `yahboom` 登录信息进入 VM；VM DHCP 地址从 `.217` 变为 `.218`。通过 `/dev/ttyUSB1`（CP210x）配置工具回写车端 Agent `10.19.20.218:8090`、Domain `40`，参数回读 PASS；原 `/dev/ttyUSB0` 为 CH340，不再作为主控配置口。
- Windows edge-service 与 Ubuntu ROS 2 的远程控制桥已启用：Windows 通过 HTTP 命令队列向 `/api/v1/ros/commands` 下发，Ubuntu `/home/yahboom/ros_control_bridge.py` 原生发布 `/cmd_vel` 并回传 `/odom`、`/scan` 遥测。
- 实时证据：edge `/api/v1/control/state` 返回 `ros_connected=true`、`obstacle_distance_m≈0.12`、`obstacle_blocked=true`；`ros_last_command_sequence=3` 与固定模式/龙虾开始巡检三条命令一致，证明 Ubuntu 桥消费了队列。
- ROS 话题证据：`/odom` 实测约 `20 Hz`；`/scan` 实测有持续消息；`/cmd_vel --verbose` 显示 `xuanxun_ros_control_bridge` 原生发布者，QoS `BEST_EFFORT/VOLATILE`，与车端订阅契约一致；当前近障条件下桥持续发布零速度。
- rosbridge 直发路径曾出现发布消息未到车端的问题，根因是 rosbridge 发布 QoS/底盘订阅兼容性；已保留 rosbridge 用于可视化，运动控制改用 Ubuntu 原生 ROS 桥，避免将演示链路误判为车体控制闭环。

## 2026-09-20 追加：跨主机 ROS 原生控制闭环

- VM 网络恢复后发现 DHCP 地址已从 `10.19.20.217` 变为 `10.19.20.218`；通过 `config_robot_vm_live.py` 在 `/dev/ttyUSB1`（CP210x）回写并读取主控参数：`agent_ip_addr=10.19.20.218`、`agent_ip_port=8090`、`ros_domain_id=40`，配置完成。
- `/dev/ttyUSB0` 当前为 CH340，不能作为主控配置口；根因分析已写入 `现场联调清单.md`，本地 `config_robot_vm.py` 改为支持 `XUANXUN_SERIAL_PORT` 和 `XUANXUN_AGENT_IP` 环境变量，默认值与当前现场一致。
- 新增 `tools/ros_control_bridge.py`，部署到 `/home/yahboom/ros_control_bridge.py`。Ubuntu 原生 ROS 节点订阅 `/odom`、`/scan`，以 `BEST_EFFORT/VOLATILE` QoS 发布 `/cmd_vel`，通过 Windows edge 的 `/api/v1/ros/commands`、`/api/v1/ros/telemetry` 协同。
- 桥接器本地执行安全策略：激光缺失、前方小于 `0.45 m`、边缘服务超过 2 秒不可达时发布零速度；支持固定路线、手动限速、暂停和急停锁存任务。
- 真实运行证据：Windows `10.19.20.168` 到 VM `10.19.20.218` HTTP/SSH/rosbridge 可达；edge 状态 `ros_connected=true`、`obstacle_distance_m≈0.12`、`obstacle_blocked=true`；`ros_last_command_sequence=1` 在 edge 重启后重新回执，证明命令游标自动复位并被 Ubuntu 桥消费。
- ROS 现场证据：`/odom` 约 `20 Hz`；`/scan` 有真实消息；`/cmd_vel --verbose` 显示 `xuanxun_ros_control_bridge` 原生 publisher，QoS `BEST_EFFORT/VOLATILE`，并能收到持续零速度消息。当前近障状态下未发送前进速度。
- 浏览器 `http://127.0.0.1:5173` 实测任务驾驶台显示“ROS 2 在线”“前方距离 0.12 m”“障碍停车”；Web/App 的高层任务仍经过 edge 安全仲裁。
- Vite 已改为监听 `0.0.0.0:5173`，Windows 本机和同一局域网鸿蒙设备可访问 `http://10.19.20.168:5173`；edge 服务局域网地址为 `http://10.19.20.168:8787`。LAN HTTP 访问实测返回 200。
- 本轮最终软件验证：edge `53 passed`；Web `npm run build` 成功；鸿蒙 `test` 成功、`assembleHap` 成功；HAP 仍为未签名调试包，仅有语音 API 警告和未配置签名警告。
- 火情和急停语音已固定化：Web 使用浏览器本地 `speechSynthesis`，鸿蒙使用系统 TTS；同一告警事件只播报一次，不调用 DeepSeek。普通暂停也有固定“已暂停巡检”提示。
- 跨主机遥测增加 `mode`、`safety_state` 和 `last_command_sequence`，edge 重启后会按 Ubuntu 桥实际状态对账，不再把车端暂停状态误显示为巡检中；相关 edge 回归已纳入 `52 passed` 全量套件。
- 新增正式 A/B 汇总接口 `/api/v1/experiments/ab/summary` 和 Web“链路实验”页：只纳入同一 `event_id` 同时出现在 C-SF/C-WIFI 的 paired 样本，计算 SLE/Wi-Fi 胜出数、SLE-Wi-Fi 到达差值均值/P95、重试次数；当前现场尚无自然双链路配对样本，页面明确显示等待真实事件。
- DeepSeek 配置验证：密钥通过交互式安全输入注入 edge-service 进程，并保存到当前 Windows 用户环境变量 `DEEPSEEK_API_KEY`；未进入仓库、前端或日志。自然语言“请让机器人原地保持静止，等待现场人员确认”经实测返回 `provider=deepseek`、结构化 `intent=PAUSE`，没有产生速度流。
- DeepSeek 在线复测：Windows WLAN/edge 当前地址为 `192.168.1.21`，Ubuntu VM 为 `192.168.1.20`；更新 Ubuntu 桥的 `XUANXUN_EDGE_URL` 后，edge 返回 `ros_connected=true`。同一自然语言再次返回 HTTP 200、`provider=deepseek`、`intent=PAUSE`、`safety_state=PAUSED`，并回执 `ros_last_command_sequence` 递增。
- 网络切换后的车端 Agent 纠正：检测到 ESP32 仍保存旧 Agent `10.19.20.218` 后，使用 CP210x `/dev/ttyUSB1` 将其改为 `192.168.1.20:8090`、Domain `40`；配置工具回读 PASS，随后 VM 重新出现 `/imu`、`/odom`、`/scan` 话题，数字孪生位姿继续更新。
- 雷达遮挡诊断：现场照片显示相机支架/黑色外壳可能进入圆形雷达的水平扫描面；页面 `0.12 m` 恰好等于雷达 `range_min`，属于可疑近距回波。但随后一次 VM 复核显示 `/scan` `Publisher count: 0`，因此该页面值不能作为当前实测障碍，需先恢复车端 Agent/实时 `/scan`，再通过移动相机支架前后对比角度确认遮挡。
- 虚拟机恢复后按顺序验收：确认 `ROS_DOMAIN_ID=40`、`/odom`、`/scan`、`/cmd_vel`；测试前向障碍停车；发送固定路线任务；再测试手动和龙虾任务；最后做失联停车和恢复策略。
- 五块星闪板的自然事件链路仍需按现场清单完成 R-SENSE 到 R-SF/R-WIFI 的 UART1/UART2/GND 跳线后再做同一 `event_id` 的 SLE/Wi-Fi 正式 A/B。
