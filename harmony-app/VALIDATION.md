# 智巡消防 Harmony App 1.2.0 交付与验证

## 2026-10-20 原生视觉升级（本轮交付）

本轮仅修改 `D:\table\ros_car\xuanxun-starshield\harmony-app\**`。采用与 Web 统一的深石墨 `#101614`、双层表面 `#19221D / #202A25`、细边线 `#2C3931`、青柠绿 `#D8EDAA`、暖橙 `#F0A17E` 与危险红 `#E58B79`。品牌仍为“智巡消防 / ZHIXUN FIRE”。frontend-design 技能用于统一字体层级、留白、原生触控尺寸和轻量空间层次，未增加依赖或渲染引擎。

- 六个页面文件共用 `Theme.ets`：页头、底部导航、告警等级、档案筛选、配对输入、证据重试、逐帧回放和安全确认均适配深色。按钮保留至少 48 vp 高度，导航为 62 vp；正文保持原生 Harmony 字体与可滚动布局。
- 首页加入手工绘制的 R01 等距 SVG：车体、六轮底盘、激光传感器、前端摄像头、地面投影和两层半透明信息片。场景旁明确标注“R01 概念巡检平台 / 示意模型 · 非实车画面”；两个连接标签均由真实连接属性驱动，仅有轻微入场过渡。
- 安全状态判定、业务回调、档案筛选算法和配对语义沿用原实现。`AppStore.ets`、`PairingStore.ets`、`EdgeClient.ets` 的 SHA-256 与修改前一致。ROS 未连接时首页和安全页仍显示“等待机器人连接”，不会把边缘的 PATROLLING 记录当作机器人已运行。
- 状态栏和系统底栏使用深石墨底与浅色内容；在页面加载成功后应用系统栏主题，避免窗口尚未就绪时的 1300002 错误。启动页与应用图标改为本地青柠绿盾牌 PNG，可用 `tools/render-brand-icons.ps1` 重建。

### 本轮文件清单

以下路径均相对于 `harmony-app/`；构建工具按常规另更新 `.hvigor/` 和 `entry/build/`。

| 文件 | 本轮变化 |
| --- | --- |
| `AppScope/app.json5` | 1.2.0 / 1000002；保留 bundleName `com.xuanxun.starshield` |
| `entry/src/main/ets/components/Theme.ets` | 新增共享配色 |
| `entry/src/main/ets/components/RobotScene.ets` | 新增原生空间场景和真实连接标签 |
| `entry/src/main/ets/components/SafetyComponents.ets` | 深色品牌栏、风险提示、指标、告警、图标导航与反馈 |
| `entry/src/main/ets/pages/Index.ets` | 根页面背景使用共享主题，业务方法不变 |
| `entry/src/main/ets/pages/SafetyHomePage.ets` | R01 场景、首页层级、指标、控制与空档案视觉 |
| `entry/src/main/ets/pages/EventHistoryPage.ets` | 档案数量、搜索、筛选、空态与加载反馈 |
| `entry/src/main/ets/pages/SafetyActionsPage.ets` | 暂停与急停确认的层级、对比度及风险色 |
| `entry/src/main/ets/pages/PairingPage.ets` | 配对标识、输入、连接信息及取消配对确认样式 |
| `entry/src/main/ets/pages/AlertDetailPage.ets` | 详情、确认、证据、媒体及回放控件样式 |
| `entry/src/main/ets/entryability/EntryAbility.ets` | 强制深色、窗口背景和系统栏颜色 |
| `entry/src/main/resources/base/element/color.json`、`entry/src/main/resources/dark/element/color.json` | 启动背景及主题资源色 |
| `entry/src/main/resources/base/media/robot_r01.svg`、`brand_shield.svg`、`nav_overview.svg`、`nav_events.svg`、`nav_safety.svg`、`archive_empty.svg`、`pairing_scan.svg` | 七个本地矢量资源 |
| `AppScope/resources/base/media/background.png`、`foreground.png` | 统一的应用分层图标 |
| `entry/src/main/resources/base/media/background.png`、`foreground.png`、`startIcon.png` | 模块图标和启动标识 |
| `tools/render-brand-icons.ps1` | 本地 PNG 标识重建脚本 |
| `release/ZhiXunFire_1.2.0_debug_unsigned.hap` | 最终可安装的未签名调试包 |
| `VALIDATION.md` | 本轮文件、安装和实际界面验证记录 |

### 最终构建与实际界面验证

- 使用已安装的 SDK `6.0.2(22)` 和既有 Hvigor：设置 `DEVECO_SDK_HOME=D:\Program Files\Huawei\DevEco Studio\sdk`，执行 `node 'D:\Program Files\Huawei\DevEco Studio\tools\hvigor\hvigor\bin\hvigor.js' --no-daemon -p product=default assembleHap`。最终结果 `BUILD SUCCESSFUL in 11 s 591 ms`，退出码 0。未下载 SDK，未新增或重跑既有 38 项业务单测。
- HDC 先确认现有设备 `127.0.0.1:5555`，以 `install -r` 覆盖安装最终包，再通过 `aa start -a EntryAbility -b com.xuanxun.starshield` 启动。`bm dump` 确认已安装版本为 `1.2.0 / 1000002`、`com.xuanxun.starshield`、`ZHIXUN FIRE`，模拟器架构 `x86_64`。
- 已实际验证“巡检总览 → 事件档案 → 安全操作 → 巡检总览”三项底部导航。首页刷新后仍为“边缘在线 / 等待机器人连接”，板端 `0/5`、ROS 未连接、视觉未就绪；`http://10.0.2.2:8787` 的既有配对保留。配套接口读取也确认 `ros_connected=false`、历史 `[]`。
- 已实际点击 P1 等级、待确认筛选、滚动空档案和清除筛选；深色选中态及空态正常。已打开急停二次确认并取消返回，未发送暂停、急停、移动或任务请求。已进入配对管理，检查当前地址、扫码入口、手动表单、空输入禁用态并返回，未取消或重设配对。
- 已目视检查最终包的首页场景、在线状态、控制区、档案筛选、空态、安全确认和配对表单，文字与按钮无旧白底控件。状态栏及系统底栏均已实际显示为深石墨底。模拟器最终停留在首页，配对在线。
- 本轮未操作 DevEco 窗口、未重启或卸载模拟器、未清理应用数据，未修改 `web-console/` 或 `edge-service/`。

最终 HAP 为 `D:\table\ros_car\xuanxun-starshield\harmony-app\release\ZhiXunFire_1.2.0_debug_unsigned.hap`，828921 字节，与 `entry/build/default/outputs/default/entry-default-unsigned.hap` 的 SHA-256 一致：

```text
6892CAB5E994DCFD1F2010D747EEB5C3D58DCD8217179CA80D21F6D423E41AF9
```

1.1.0 包完整保留，SHA-256 仍为 `5C560955DCDDC9E676D3C82B06A176E3D8527D781C1E981CD1D025712A997277`。

截图目录为 `C:\Users\q4984\AppData\Local\Temp\zhixun-design-a881b863\`，均由现有模拟器直接截取：

| 截图文件 | 已验证内容 |
| --- | --- |
| `app-home.jpeg` | 首页 R01 场景、品牌、连接状态和导航 |
| `app-home-status.jpeg` | 完整安全状态、同步时间及真实指标 |
| `app-home-controls.jpeg` | 最近事件空态、安全入口和巡检控制样式 |
| `app-history.jpeg` | 档案数量、搜索及全部筛选 |
| `app-history-filter.jpeg` | P1 / 待确认选中、空态、清除筛选 |
| `app-safety.jpeg` | 安全页、真实状态和暂停入口 |
| `app-safety-confirm.jpeg` | 急停二次确认和取消返回 |
| `app-pairing.jpeg` | 现有配对、连接状态和扫码入口 |
| `app-pairing-form.jpeg` | 手动输入、禁用提交及取消配对入口 |

本轮限制：现场无真实事件，因此告警详情、确认、媒体证据和逐帧回放仅完成样式修改及编译校验，未伪造事件进行运行验证；扫码相机、原生语音、真实机器人动作与硬件未验证。调试包未签名；沿用的 `VoiceService.ets:100` 异常处理警告仍存在，未影响构建或上述界面验证。

## 1.1.0 历史交付记录

以下保留前轮原始记录，其中浅色主题描述仅对应 1.1.0，本轮视觉与验证范围以上面的 1.2.0 记录为准。

本文件记录 `D:\table\ros_car\xuanxun-starshield\harmony-app\**` 内的原生 APP 改动。网站和配套边缘服务的变更另见 `../docs/网站与APP重构交付说明.md`。沿用当前 Stage / ArkUI / ArkTS 项目、SDK 6.0.2(22)、本机 DevEco 工具链和原有应用标识 `com.xuanxun.starshield`。

## 已实现功能

- 全部六个页面统一使用暖白 / 浅灰背景、深蓝标题、青绿主动作和橙红风险提示；品牌统一为“智巡消防”（ZHIXUN FIRE），包括页头、配对页、AppScope / entry 应用与启动 label、模块描述及 DevEco 项目 / 运行配置显示名称。已检查全部实际资源目录：字符串使用 base，dark 只有颜色覆盖，无额外语言的旧品牌；现有启动图标不含品牌文字。关键按钮至少 48 vp 高，页面可纵向滚动，主体限制最大宽度，导航独立分配布局空间。强制浅色模式以保持状态、文字和控件的对比度。
- 首页整合真实安全快照、板端 / ROS / 视觉状态、最近事件和控制模式。“龙虾”显示名称改为“智能任务”，接口继续使用 `LOBSTER_AI`。传感器读数明确标注为事件历史采样，缺失或断网状态显示未知 / 待核实。
- 共享安全摘要区分边缘在线与机器人连接：ROS 未连接或连接信息缺失时，READY / PATROLLING 显示“等待机器人连接”；PAUSED / FAULT / ESTOP_LATCHED 保留边缘已记录状态并注明现场待核实。边缘断线时保留这些安全状态的“上次记录”提示。首页控制模式摘要、机器人链路与安全操作页同步使用不暗示实车已运行或已停止的文案。
- 历史档案通过 `GET /api/v1/events?limit=200&offset=0` 加载此前保存的事件，并可继续分页。支持全部等级（含 NORMAL / CLEARED）、待确认 / 已确认、事件编号 / 机器人 / 设备来源 / 触发源 / 状态关键词组合筛选。筛选保存在根页面，查看详情后返回仍保留。筛选仅作用于已加载的记录。
- 告警确认通过 `POST /api/v1/alerts/{event_id}/ack`，校验返回事件编号、等级和 `acked`，成功后使用完整服务端事件更新详情、档案与匹配的当前告警。支持 `alert.updated` 广播与跨端确认同步。迟到的未确认快照不会撤回已经保存的确认；确认失败可以重试，不伪造成功。
- 详情继续使用原有 evidence 接口，显示事件、位置和传感器证据，区分加载中、失败和未附带媒体。支持证据 / 图片失败重试、相对图片地址和视觉检测记录。照片仅在服务端返回媒体资源时显示。
- 通过既有 `GET /api/v1/events/{id}/replay` 按需读取回放，提供上一帧 / 下一帧和滑块，查看历史位置、传感器和安全状态。空回放与请求失败均有明确显示。
- 安全操作提供暂停、急停确认和现场处置提示。只接受服务器成功返回的真实状态；HTTP 失败或控制响应 `accepted: false` 不会显示操作成功。新的安全广播优先于早先发起的读取 / 操作请求。没有增加急停解除、释放或恢复按钮，解除仍须现场授权。
- 所有变更请求由状态层防止重复提交，证据与档案读取各自维护加载和错误状态，读取不会占用安全操作的提交锁。HTTP 404 / 405 的确认接口可用性错误也允许重新尝试。
- 配对管理可返回、重连或二次确认取消配对。仅打开 / 返回配对页不会销毁连接，也不会因后台状态更新自动退出配对页。保存失败保留现有连接，取消配对在本机存储删除成功后才断开连接。保留 ScanKit 扫码、手动内容、短期令牌、有效期校验和过期令牌不发送的逻辑。
- 断线后自动以 3 / 6 / 12 / 15 秒间隔重连，可手动重连。在线时每 15 秒读取状态，以发现未触发 WebSocket close 的网络故障。网络失败后保留上次记录、提示现场核实并禁用远程操作。网络判定受 5 秒连接 / 10 秒读取超时影响，非零延迟。
- 更换服务、重新连接、取消配对、退出和切换详情时，用连接身份、请求序号和状态修订号隔离旧请求。断开客户端会取消原生 HTTP、关闭旧 WebSocket；dispose 后不会回调页面或安排重连 / 状态探测。
- 保留原生 CoreSpeechKit 语音识别 / 播报和 AudioKit 采集，以及 APP / VOICE 任务来源。补充运行时麦克风授权处理，离线、退出、配对管理或离开智能任务入口后不提交过期识别结果。

## 所有手工改动路径

下列路径均相对于 `D:\table\ros_car\xuanxun-starshield\harmony-app`。Hvigor 另外会按常规更新 `.hvigor/`、`entry/build/` 和 `entry/.test/` 中的构建与测试产物。

| 路径 | 变更 |
| --- | --- |
| `AppScope/app.json5` | versionName 1.1.0 / versionCode 1000001，厂商显示 ZHIXUN FIRE |
| `AppScope/resources/base/element/string.json` | 智巡消防应用名称 |
| `entry/src/main/resources/base/element/string.json` | 智巡消防模块描述及启动 / 应用 label |
| `.idea/.name` | 智巡消防 DevEco 项目显示名称 |
| `.idea/workspace.xml` | ZHIXUN FIRE 运行配置显示名称 |
| `entry/src/main/ets/components/SafetyComponents.ets` | 共享品牌、状态、导航、卡片、反馈与阅读层级 |
| `entry/src/main/ets/entryability/EntryAbility.ets` | 保持统一浅色主题 |
| `entry/src/main/ets/models/EdgeModels.ets` | 确认返回事件及回放类型 |
| `entry/src/main/ets/pages/Index.ets` | 自适应页面框架、路由返回、筛选保留、配对 / 语音生命周期与授权 |
| `entry/src/main/ets/pages/SafetyHomePage.ets` | 首页与智能任务 / 手动控制 / 真实状态展示 |
| `entry/src/main/ets/pages/SafetyActionsPage.ets` | 暂停、急停二次确认、反馈及现场授权边界 |
| `entry/src/main/ets/pages/AlertDetailPage.ets` | 确认、证据、媒体重试和逐帧回放 |
| `entry/src/main/ets/pages/EventHistoryPage.ets` | 服务端档案、组合筛选、分页、加载与错误重试 |
| `entry/src/main/ets/pages/PairingPage.ets` | 扫码 / 手动配对、保留连接返回、重连和取消配对确认 |
| `entry/src/main/ets/services/edge/EdgeClient.ets` | 档案 / 回放、完整确认事件、HTTP 取消及旧 socket 隔离 |
| `entry/src/main/ets/services/edge/EdgeMessageRouter.ets` | 解析 alert.updated 与无效 envelope 保护 |
| `entry/src/main/ets/services/edge/EventHistory.ets` | 新增档案排序、去重、单向确认合并与组合筛选 |
| `entry/src/main/ets/store/AppStore.ets` | 服务端数据、并发防护、重连 / 探测、状态与请求生命周期 |
| `entry/src/main/resources/base/element/color.json` | 浅色启动背景与统一主色 |
| `entry/src/main/resources/dark/element/color.json` | 启动背景一致性 |
| `entry/src/test/EdgeMessageRouter.test.ets` | alert.updated 回归 |
| `entry/src/test/EventHistory.test.ets` | 新增筛选、确认不可回退及分页合并测试 |
| `entry/src/test/List.test.ets` | 注册档案测试套件 |
| `tools/verify-store.cjs` | 新增 23 项真实非 UI ArkTS 模块的宿主回归检查 |
| `VALIDATION.md` | 本交付记录 |
| `README.md` | 智巡消防项目介绍与新交付路径 |
| `docs/superpowers/plans/2026-09-18-harmony-safety-app.md` | 计划文档标题和品牌 |
| `release/1.1.0_unsigned.hap` | 本次联调修正后的指定 unsigned 发布包 |
| `release/ZhiXunFire_1.1.0_debug_unsigned.hap` | 智巡消防最终交付包，旧品牌 1.1.0 包移名至此，原有 1.0.0 包保留 |

本次交付包含前轮离线状态展示修正和本轮品牌统一。应用 ID、协议、配对存储键、语音请求标识、安全状态数据、请求和既有测试文件保持不变。

## 验证结果（2026-10-19）

在项目根目录用 PowerShell 串行执行：

```powershell
$env:DEVECO_SDK_HOME = 'D:\Program Files\Huawei\DevEco Studio\sdk'
node 'D:\Program Files\Huawei\DevEco Studio\tools\hvigor\hvigor\bin\hvigor.js' --no-daemon -p product=default assembleHap
node 'D:\Program Files\Huawei\DevEco Studio\tools\hvigor\hvigor\bin\hvigor.js' --no-daemon test
node tools/verify-store.cjs
```

- 最终 `assembleHap`：`BUILD SUCCESSFUL`，ArkTS / 资源 / 打包校验通过。
- 前轮 Hypium 基线：`Tests run: 15, Failure: 0, Error: 0, Pass: 15, Ignore: 0`。本次展示补丁未扩展或重跑该套件。
- 前轮状态层宿主回归基线：23 / 23 通过。运行实际 `AppStore`、`EdgeClient`、路由、配对存储与档案模块，只替换原生 HTTP / WebSocket / preferences 边界；不会联网或向设备发指令。本次展示补丁未扩展或重跑该套件。
- 前轮离线状态修正对实际共享卡片的展示方法执行 13 组临时分支核验，全部通过：正常 / 巡检与 ROS false / 缺失、ROS true 正常状态、ROS 未连接时暂停 / 故障 / 急停保留，以及边缘断线时安全记录保留。未新增持久测试文件；本轮品牌替换保留上述逻辑，该核验不等于模拟器屏幕测试。
- 回归覆盖：初次加载持久化历史、分页去重与组合筛选、ack 完整事件 / 失败重试 / 返回编号校验、旧档案不撤回确认、旧告警更新不替换当前风险、安全请求失败与重复提交、服务器拒绝控制、迟到控制状态 / 快照不能撤回安全状态、换配对旧请求、详情证据 / 回放竞态、dispose 取消资源与重连、延后 open 时加载档案及无 close 的网络故障探测。
- Hypium 原始结果：`entry/.test/default/intermediates/test/coverage_data/test_result.txt`；覆盖报告：`entry/.test/default/outputs/test/reports/index.html`。覆盖报告仅表示该测试目标的覆盖范围，不等同于完整 UI 验证。
- 本次最终 `assembleHap`：`BUILD SUCCESSFUL in 14 s 790 ms`，SDK 6.0.2(22)，退出码 0。
- 最终实际交付路径：`D:\table\ros_car\xuanxun-starshield\harmony-app\release\ZhiXunFire_1.1.0_debug_unsigned.hap`，848402 字节；中性名称副本 `release/1.1.0_unsigned.hap` 与构建输出 SHA-256 一致。版本仍为 1.1.0 / 1000001。旧品牌 1.1.0 文件名已移名，原有 1.0.0 包保留。

```text
5C560955DCDDC9E676D3C82B06A176E3D8527D781C1E981CD1D025712A997277
```

## 2026-10-20 模拟器运行恢复

- 已恢复 DevEco 的工程模型：通过“文件 → 同步和刷新项目”重新同步，日志记录 `sync module success`，整体同步在 45 秒完成，`entry` 恢复识别。
- 已从 DevEco 选择 `ZHIXUN FIRE` 运行配置、`Enjoy 90 Pro Max` 设备并使用 Shift+F10 验证；2026-10-20 10:39 构建成功，安装和 EntryAbility 启动成功，不再出现 `No module found`。
- 实际运行版本为 1.1.0 / 1000001。设备使用现有空闲的 Enjoy 90 Pro Max，运行时 HDC 为 `127.0.0.1:5555`，可用空间约 4.4 GB。原 Enjoy 90 Pro Max 001 的数据未擦除。
- 已验证 APP 进入前台并显示“智巡消防”配对页。随后按用户要求启动本机边缘服务，通过模拟器宿主机地址 `http://10.0.2.2:8787` 完成配对，首页显示“边缘在线”和“边缘档案已同步”，服务地址保存在 APP 中。连接截图为 `release/runtime-20261020/zhixun-connected.jpeg`。本次不把软件连接验证等同于全部页面、摄像扫码、原生语音或现场硬件验证。
- 运行证据位于 `release/runtime-20261020/`，包含 `zhixun-running.jpeg`、能力前台状态、窗口焦点与应用日志；`deveco-run-success.png` 记录 IDE 同步结果。后续使用 Shift+F10 运行相同配置即可。

本机软件服务：边缘服务 `http://127.0.0.1:8787`，网站 `http://127.0.0.1:5173`。模拟器使用 `10.0.2.2` 访问宿主机；真机应填写电脑的局域网地址。当前边缘服务按本机软件联调配置启动，机器人和板端仍等待实际连接。

## 2026-10-20 晚间安装恢复

20:59 的 DevEco 运行日志在 `bm install` 返回 `9568288 / install failed due to insufficient disk memory`，应用尚未进入启动环节。现场读取确认：

- 运行中的模拟器是 `Enjoy 90 Pro Max 001`，`/data` 总量约 5.7 GB、已用约 4.9 GB、剩余约 426 MB；其已安装应用仍为 1.0.0 / 1000000。宿主机 C、D 盘空间充足，HAP 为 828921 字节。
- 正常关闭该模拟器后，启动既有的 `Enjoy 90 Pro Max`（不带 `001`）。HDC 重新连接为 `127.0.0.1:5555`，目标内部剩余约 4.6 GB；端口相同不表示仍是原来的模拟器实例。
- 使用当前 `entry/build/default/outputs/default/entry-default-unsigned.hap` 执行 HDC `install -r`，实际返回 `install bundle successfully`；随后 `aa start -a EntryAbility -b com.xuanxun.starshield` 返回 `start ability successfully`。
- `bm dump` 确认 1.2.0 / 1000002、`x86_64`；`aa dump -a` 确认 `EntryAbility` 为 `FOREGROUND`。已查看设备截图，首页正常显示新版场景、边缘在线和原有地址 `http://10.0.2.2:8787`，机器人状态为“等待机器人连接”。两台模拟器数据均保留，未卸载应用或清除配对。

本次验证为 HDC 安装和实际应用启动。后续在 DevEco 选择 `Enjoy 90 Pro Max` 与 `ZHIXUN FIRE`；若再次使用空间不足的 `001`，仍可能遇到同一安装错误。本轮未修改应用代码或重新构建。

本轮证据位于 `release/runtime-20261020/storage-recovery/`：`installed-version.json`、`device-storage.txt`、`ability.txt` 和 `zhixun-home.jpeg`。

## 限制与运行说明

- 当前工程没有 signingConfigs，发布文件为 debug unsigned HAP；真机安装需要用户已有的项目签名配置。
- 2026-10-19 原 Enjoy 90 Pro Max 001 覆盖安装曾返回 `9568288: install failed due to insufficient disk memory`，当时仅剩约 440 MB。2026-10-20 已改用现有空闲的 Enjoy 90 Pro Max 成功安装、启动新版；原设备数据保留。扫码、原生语音和真实硬件仍需单独验证。
- 沿用的 `VoiceService.ets:100` 原生资源调用仍有一条 SDK 异常处理警告，未阻止编译。语音硬件与离线识别引擎须在支持 CoreSpeechKit / AudioKit 的设备上验证。
- 配套边缘服务已提供持久化 events / ack 接口与 alert.updated 广播；现场联调仍需接入实际设备。照片、预览与回放只展示服务实际保存的数据，不补造媒体、处置结果或安全状态。
- 本次验证不购买服务、不下载新 SDK、不自动控制机器人。设备安全状态仍以现场和服务端确认结果为准。

用 DevEco Studio 打开整个 `harmony-app` 目录，选择正常的 `ZHIXUN FIRE` 应用运行配置与 `entry` 模块，首次运行不使用 HotReload 配置。若 Module 显示 `[none]`，关闭该项目窗口、重新打开根目录并同步已有项目模型。SDK 仍使用本机 `6.0.2(22)`，无需更换版本。
