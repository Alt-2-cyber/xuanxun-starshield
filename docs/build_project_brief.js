const fs = require("fs");
const path = require("path");
const MODULE_ROOT = path.resolve(__dirname, "..", "..", "docs", "node_modules");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  PageNumber,
} = require(path.join(MODULE_ROOT, "docx"));

const ASSETS = path.join(__dirname, "report_assets");
const DOCX_OUT = path.join(__dirname, "玄巡·星盾_项目简介_正式版.docx");
const MD_OUT = path.join(__dirname, "玄巡·星盾_项目简介_正式版.md");
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1080;
const CONTENT_W = PAGE_W - MARGIN * 2;
const C = { navy: "16324F", blue: "2C6DB2", cyan: "138A8A", orange: "D17A16", red: "B54444", green: "2E865A", ink: "263746", gray: "60758A", line: "B7C7D5", light: "F4F7FA", paleBlue: "EAF2F8", paleCyan: "E7F5F3", paleOrange: "FFF3D9", paleRed: "FBE9E7", white: "FFFFFF" };

function run(text, options = {}) {
  return new TextRun({ text: String(text), font: options.font || "Microsoft YaHei", size: options.size || 22, bold: options.bold || false, color: options.color || C.ink, italics: options.italics || false });
}

function para(text, options = {}) {
  const children = Array.isArray(text) ? text : [run(text, options)];
  return new Paragraph({ alignment: options.alignment || AlignmentType.JUSTIFIED, spacing: { before: options.before || 0, after: options.after || 120, line: options.line || 360 }, indent: options.indent === false ? undefined : { firstLine: options.firstLine || 420 }, children });
}

function heading(text, level = 1, pageBreak = false) {
  const options = { heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: level === 1 ? 260 : 180, after: 150 }, children: [run(text, { size: level === 1 ? 30 : 25, bold: true, color: level === 1 ? C.navy : C.blue })] };
  if (pageBreak) options.pageBreakBefore = true;
  return new Paragraph(options);
}

function image(file, width, height, alt) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(ASSETS, file)), transformation: { width, height }, altText: { title: alt, description: alt, name: alt } })] });
}

function caption(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 170 }, children: [run(text, { size: 18, color: C.gray })] });
}

function cell(value, width, header = false) {
  return new TableCell({ width: { size: width, type: WidthType.DXA }, margins: { top: 90, bottom: 90, left: 120, right: 120 }, shading: { fill: header ? C.navy : C.white, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ spacing: { before: 0, after: 0, line: 300 }, children: [run(value, { size: 18, bold: header, color: header ? C.white : C.ink })] })] });
}

function table(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.line };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, borders, rows: [new TableRow({ children: headers.map((value, i) => cell(value, widths[i], true)) }), ...rows.map((row) => new TableRow({ children: row.map((value, i) => cell(value, widths[i])) }))] });
}

function pageBreakHeading(text) {
  return heading(text, 1, true);
}

function writeMarkdown() {
  const text = `# 玄巡·星盾项目简介\n\n## 项目名称\n\n**玄巡·星盾——基于 MicroROS V2 与 HH-D02 星闪双链路的地下空间移动消防巡检系统**\n\n## 一句话定位\n\n玄巡·星盾是一套面向地下车库、设备间和管廊等 GPS 拒止环境的移动消防巡检原型系统，以 MicroROS V2 轮式机器人为移动感知载体，以 Ubuntu ROS 2 与 Edge 服务为计算和安全控制中心，以五块 HH-D02 构成 SLE/Wi-Fi 双链路告警通道，并通过 Windows Web 和鸿蒙原生 ArkUI 提供告警、任务、视频和安全操作。\n\n## 项目痛点\n\n地下空间存在固定传感器盲区、人工巡检频率有限、车辆和结构物遮挡、无线链路难以对比、火情证据分散等问题。系统需要同时解决“发现慢、进不去、判断难、数据不可复核”。\n\n## 核心方案\n\n- 移动感知：摄像头、激光雷达、里程计、IMU 以及温度/烟雾/可燃气体传感器。\n- 基础机器人能力：ROS 2 话题通信、TF2 坐标树、/odom 状态估计、LaserScan 建图、定位、固定路线、局部避障和安全停车。\n- 双链路告警：R-SENSE 生成同源 event_id，经 SLE 与 Wi-Fi 两路传输到中控，记录 t0、t2、ACK、retry。\n- 智能识别：传感器先触发候选事件，摄像头进行 fire/smoke 复核，7 帧中至少 5 帧且置信度不低于 0.75 才确认视觉 P3。\n- 认知任务智能体：语音或文字转换为结构化任务，ROS 2 负责限速、避障、失联停车和急停锁存。\n\n## 创新点\n\n1. 星闪确定性告警链路与 Wi-Fi 严格 A/B 对照。\n2. 同一 event_id 贯穿传感器、视觉、地图、链路和人工操作证据。\n3. 2.5D 时空数字孪生，将真实 SLAM 2D 地图与风险热区叠加。\n4. 认知任务智能体与 ROS 2 安全仲裁解耦，AI 不直接输出速度流。\n5. 通过 SQLite + JSONL 构建可回放、可审计的实验数据链。\n\n## 当前状态\n\nEdge 服务 55 项测试通过，Web 构建通过，五种星闪角色固件完成构建和实体写入记录；ROS 侧 /odom、/scan 与 /cmd_vel 原生桥已有现场证据。自然双链路配对样本、真实视觉模型、鸿蒙正式签名和完整实车重复性仍待现场验收。\n\n## 演示流程\n\n1. 启动 Windows Edge/Web 与 Ubuntu ROS 2。\n2. 检查 /odom、/scan、TF 和五块星闪板身份。\n3. 小车执行固定路线并实时更新地图、轨迹和前方障碍状态。\n4. 传感器触发候选告警，摄像头完成视觉复核。\n5. Web 显示风险热区，鸿蒙端收到告警并支持暂停/急停。\n6. 进入链路实验或证据回放，查看同一事件的全链路证据。\n`;
  fs.writeFileSync(MD_OUT, text, "utf8");
}

async function build() {
  writeMarkdown();
  const children = [];
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 220 }, children: [run("玄巡·星盾", { size: 50, bold: true, color: C.navy })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [run("项目简介", { size: 31, bold: true, color: C.blue })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 520 }, children: [run("基于 MicroROS V2 与 HH-D02 星闪双链路的地下空间移动消防巡检系统", { size: 24, color: C.gray })] }));
  children.push(image("fig02_end_to_end_architecture.png", 640, 347, "项目总体架构"));
  children.push(caption("项目总体架构：移动车端、ROS 2/Edge 计算中心与 Web/鸿蒙交互层"));
  children.push(para("文档用途：项目申报、技术答辩、方案汇报与现场演示开场材料", { alignment: AlignmentType.CENTER, indent: false, color: C.gray }));
  children.push(para("版本：V1.0 · 2026 年 9 月 21 日", { alignment: AlignmentType.CENTER, indent: false, color: C.gray }));

  children.push(pageBreakHeading("1 项目定位与建设目标"));
  children.push(heading("1.1 一句话定位", 2));
  children.push(para("玄巡·星盾是一套面向地下车库、设备间和管廊等 GPS 拒止环境的移动消防巡检原型系统。系统以 MicroROS V2 轮式机器人为移动感知载体，以 Ubuntu ROS 2 与 Edge 服务为计算和安全控制中心，以五块 HH-D02 构成 SLE/Wi-Fi 双链路告警通道，并通过 Windows Web 和鸿蒙原生 ArkUI 提供告警、任务、视频和安全操作。"));
  children.push(heading("1.2 建设目标", 2));
  children.push(table(["目标维度", "建设内容", "交付形态"], [
    ["移动感知", "摄像头、激光雷达、里程计、IMU 与温度/烟雾/气体输入", "一台可运行的 MicroROS V2 移动机器人原型"],
    ["火情闭环", "传感器触发候选事件、视觉复核、告警、定位、人工确认", "可演示、可回放、可解释的事件链"],
    ["通信验证", "HH-D02 五板双链路、同源 event_id、SLE/Wi-Fi A/B", "硬件链路与正式实验接口"],
    ["交互平台", "Windows Web + 鸿蒙 App", "控制台和移动安全端"],
    ["工程验证", "测试、日志、SQLite、JSONL、现场验收表", "可复核的工程证据"],
  ], [1700, 4700, 3140]));

  children.push(pageBreakHeading("2 现实痛点与解决思路"));
  children.push(table(["现场痛点", "传统方式局限", "玄巡·星盾的解决思路"], [
    ["发现慢", "固定传感器存在覆盖盲区，人工巡检受频次限制", "让传感器随机器人移动，按路线巡检并持续采样"],
    ["进不去", "车位、立柱、窄通道和烟气环境影响人员接近", "激光雷达建图、定位和避障，支持远程暂停与急停"],
    ["判断难", "单一烟感、尾气、灯光可能造成误报", "传感器触发 + 摄像头复核 + 连续帧门控"],
    ["链路不可比", "只展示“收到了”，无法说明哪条链路更快更稳", "同源 event_id 记录 t0/t2/ACK/retry，严格配对统计"],
    ["数据不可复核", "告警、视频、地图和人工操作分散在不同界面", "统一时间轴回放，SQLite 保存索引，JSONL 保存原始证据"],
  ], [2100, 3600, 3840]));
  children.push(para("项目不把机器人宣传为已经取得消防认证的产品，而是首先建立“发现—告警—定位—确认—回放”的工程原型闭环。初期灭火执行机构可以在后续阶段以受控模拟装置接入，所有真实测试必须在受控环境下进行。", { color: C.red }));

  children.push(pageBreakHeading("3 总体方案与基础能力"));
  children.push(image("fig03_five_board_roles.png", 640, 347, "五块星闪板角色"));
  children.push(caption("五块 HH-D02 角色：R-SENSE、R-SF、C-SF、R-WIFI、C-WIFI"));
  children.push(table(["能力层", "技术内容", "系统价值"], [
    ["车体与通信", "ESP32-S3 MicroROS V2、micro-ROS Agent、ROS 2 话题", "复用现有底盘，保持硬件和高层软件解耦"],
    ["扫图与定位", "LaserScan、/odom、IMU、TF2、SLAM、地图固化、定位复用", "把地下空间转化为可规划、可定位的二维环境"],
    ["运动与避障", "固定路线、局部控制、前方最小距离、速度限幅、失联停车", "保障演示过程中出现异常时优先停车"],
    ["火情识别", "温度/烟雾/气体候选 + fire/smoke 视觉复核", "提高告警可解释性，降低单传感器误报"],
    ["告警通信", "SLE 与 Wi-Fi 双路传输、串口网关、事件配对", "把星闪价值转化为可测量的链路性能"],
    ["任务智能", "玄巡认知任务智能体、TaskPlan、安全仲裁", "支持语音任务但不允许 AI 直接控制速度"],
  ], [1900, 4700, 2940]));
  children.push(image("fig15_mapping_localization_pipeline.png", 640, 373, "建图定位导航流水线"));
  children.push(caption("小车建图、定位与导航：从 /scan、/odom、TF 到路径规划"));

  children.push(pageBreakHeading("4 核心功能说明"));
  children.push(heading("4.1 小车扫图与地图复用", 2));
  children.push(para("小车扫图不是简单绘制激光点，而是将 LaserScan、里程计和 TF 放入二维 SLAM 后端。系统首先检查 /scan、/odom、TF、QoS 和时间戳；随后在低速、可闭环的路线中采集数据；SLAM 使用里程计运动先验和扫描匹配修正位姿，将障碍占据概率写入栅格地图；最后保存 map.yaml、栅格图、分辨率、原点、参数和版本号，用于后续定位与导航。"));
  children.push(table(["阶段", "主要动作", "验收重点"], [
    ["数据准备", "检查 scan/odom/TF、publisher、QoS、frame_id", "数据持续、坐标方向正确"],
    ["扫描采集", "沿外圈和关键通道低速行驶，尽量形成闭环", "墙体、立柱、通道轮廓连续"],
    ["地图固化", "保存地图文件、原点、分辨率、参数和版本", "地图可重新加载"],
    ["定位复用", "加载地图并设置初始位姿", "机器人位姿稳定，路径规划可用"],
  ], [1800, 4900, 2840]));
  children.push(heading("4.2 路径规划与激光避障", 2));
  children.push(image("fig17_navigation_and_safety_control.png", 640, 368, "导航与安全控制"));
  children.push(caption("全局规划、局部控制和安全门共同决定最终 /cmd_vel"));
  children.push(para("任务点或固定路线先被转换为结构化目标，再由 ROS 2 侧规划和控制。局部控制器根据位置误差、航向误差、局部路径和障碍距离计算候选速度；安全门再次检查激光数据新鲜度、前方距离、Edge/ROS 状态和急停锁存，只有通过安全检查才允许速度输出。"));
  children.push(heading("4.3 多源火情识别", 2));
  children.push(image("fig18_multisensor_fire_fusion.png", 640, 389, "多源火情融合"));
  children.push(caption("传感器触发候选事件，摄像头复核并通过连续帧门控"));
  children.push(para("系统先利用温度、烟雾或可燃气体传感器形成候选事件，再通过摄像头对 fire/smoke 进行视觉复核。VisionGate 使用 7 帧窗口，至少 5 帧置信度达到 0.75 才确认视觉 P3；模型缺失或异常进入 VISION_FAULT，不生成虚假视觉告警。"));
  children.push(heading("4.4 双链路告警与证据回放", 2));
  children.push(para("R-SENSE 为每次候选事件生成统一 event_id，并分别通过 R-SF/C-SF 的 SLE 路径与 R-WIFI/C-WIFI 的 Wi-Fi 路径传输。Edge 记录车端 t0、中控 t2、ACK、retry 和链路状态。只有同一 event_id 同时出现在两条链路时，才进入正式 A/B 配对统计。"));

  children.push(pageBreakHeading("5 认知任务智能体与多端交互"));
  children.push(image("fig08_cognitive_mission_agent.png", 640, 363, "认知任务智能体安全链"));
  children.push(caption("玄巡认知任务智能体：自然语言理解与 ROS 2 安全执行解耦"));
  children.push(para("玄巡认知任务智能体（Cognitive Mission Agent，CMA）是项目对语音/文字任务模式的正式命名。它负责把“开始巡检、去 B 区巡检点、返回起点、暂停、继续”等输入解析为 START_PATROL、GO_TO_PATROL_POINT、RETURN_HOME、PAUSE、RESUME、STOP 等结构化意图。它不生成线速度、角速度和连续控制流，急停也不能由它解除。"));
  children.push(table(["终端", "主要功能", "安全限制"], [
    ["Windows Web", "总览、数字孪生、任务驾驶台、链路实验、证据回放", "运动请求必须经过 Edge 和 ROS 安全桥"],
    ["鸿蒙 App", "告警、确认、视频/截图、简化位置、暂停、急停", "不能解除急停、改模型阈值、改风险区或启动实验"],
    ["Ubuntu ROS 2", "Agent、/scan、/odom、/cmd_vel、控制桥", "激光失效、失联和急停优先零速度"],
  ], [1900, 4900, 2740]));

  children.push(pageBreakHeading("6 项目创新与当前状态"));
  children.push(table(["创新点", "技术表达", "可验证证据"], [
    ["星闪确定性告警链路", "SLE 与 Wi-Fi 传输同一事件，记录 t0/t2/ACK/retry", "transport_samples、A/B 汇总接口和实验页面"],
    ["时空统一证据链", "event_id 贯穿传感器、视觉、位姿、地图、链路和人工操作", "SQLite + JSONL + ReplayFrame"],
    ["2.5D 数字孪生", "真实 SLAM 2D 地图叠加风险热区、轨迹和告警浮标", "TwinSnapshot、热区权重和 Web 页面"],
    ["认知任务智能体", "意图理解与运动安全仲裁分离，AI 不直接控车", "TaskPlan、SafetyArbiter、ROS 控制桥"],
    ["可降级工程架构", "通信、视觉、雷达异常时进入明确故障状态", "VISION_FAULT、失联停车、急停锁存"],
  ], [2100, 5000, 2440]));
  children.push(table(["状态", "已具备", "仍需现场补齐"], [
    ["软件基线", "Edge 55 项测试通过，Web 构建通过，页面和 API 已实现", "真实模型预处理/后处理和长时间运行"],
    ["星闪硬件", "五种角色包构建、烧录记录、Wi-Fi 单帧接收证据", "UART 跳线后的自然同源双链路事件"],
    ["ROS 2 车辆", "/odom、/scan、/cmd_vel 原生桥有现场记录", "摄像头、雷达扫描面、固定路线重复测试"],
    ["移动端", "原生 ArkUI 代码与 HAP 构建完成", "正式签名、真机安装和现场截图"],
  ], [1900, 4500, 3140]));
  children.push(para("当前版本适合项目展示、技术答辩和受控原型验证，不应被表述为正式消防值守系统。正式 A/B 结论必须在完成板间接线并获得自然 paired event 后形成。", { color: C.red }));

  children.push(pageBreakHeading("7 推荐演示流程"));
  children.push(table(["步骤", "演示动作", "观众看到的结果"], [
    ["1", "启动 Windows Edge/Web 与 Ubuntu ROS 2", "Web 控制台在线，ROS 状态可见"],
    ["2", "按颜色复位五块 HH-D02，检查角色身份", "绿色/红色/黄色/蓝色/品红角色明确"],
    ["3", "检查 /scan、/odom、TF 与前方距离", "数字孪生显示位姿、轨迹和障碍状态"],
    ["4", "执行固定路线或认知任务智能体任务", "小车低速移动，任务转成结构化意图"],
    ["5", "触发受控温度/烟雾/视觉演示事件", "Web 出现告警、热区和视觉证据"],
    ["6", "鸿蒙端确认或执行暂停/急停", "多端状态同步，急停保持锁存"],
    ["7", "打开链路实验页面", "同一 event_id 的 SLE/Wi-Fi 配对状态可查看"],
    ["8", "打开证据回放", "地图、视觉、传感器、链路、人工操作同步回放"],
  ], [900, 4200, 4440]));
  children.push(image("web-overview-live.png", 640, 388, "Web 系统总览实测截图"));
  children.push(caption("Web 控制台实测截图：总览、地图、风险区和链路摘要"));

  children.push(pageBreakHeading("8 项目简介短版文案"));
  children.push(heading("8.1 约 100 字版本", 2));
  children.push(para("玄巡·星盾是一套面向地下空间的移动消防巡检系统。项目以 MicroROS V2 轮式机器人为移动载体，以 ROS 2 与 Edge 为计算和安全控制中心，以五块 HH-D02 构成 SLE/Wi-Fi 双链路告警通道，融合激光建图、视觉复核、多源传感器、数字孪生和鸿蒙移动端，实现火情发现、定位、确认、暂停和证据回放。"));
  children.push(heading("8.2 约 300 字版本", 2));
  children.push(para("针对地下车库、设备间和管廊中固定传感器覆盖不足、人工巡检效率有限、车辆遮挡严重和告警证据难以复核的问题，玄巡·星盾构建了一套移动式消防巡检原型。系统基于现有 MicroROS V2 轮式小车，接入摄像头、激光雷达、里程计、IMU 及温度/烟雾/可燃气体传感器；Ubuntu ROS 2 负责 micro-ROS Agent、TF、SLAM、定位、避障和底盘安全控制；Edge 服务负责事件统一、视觉复核、风险热区、回放和双链路实验；五块 HH-D02 通过 SLE 与 Wi-Fi 传输同源事件，利用 event_id、t0、t2、ACK、retry 对链路性能进行严格 A/B 对比。系统同时提供 Windows Web 和鸿蒙原生 App，支持认知任务智能体语音任务，但 AI 只输出结构化任务，不能直接输出速度流。"));
  children.push(heading("8.3 答辩开场推荐表述", 2));
  children.push(para("我们的项目不是简单地把传感器装到小车上，而是把移动感知、ROS 2 基础能力、星闪双链路、视觉复核、安全控制和证据回放组织成一条可验证的工程闭环。评委可以看到机器人如何扫图和避障，也可以看到同一火情事件如何通过两条链路到达中控、如何在地图上形成风险热区，以及系统为什么允许或禁止机器人继续运动。"));

  const doc = new Document({
    creator: "玄巡·星盾项目组",
    title: "玄巡·星盾项目简介",
    subject: "地下空间移动消防巡检系统项目简介",
    styles: {
      default: { document: { run: { font: "Microsoft YaHei", size: 22, color: C.ink }, paragraph: { spacing: { line: 360, after: 120 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Microsoft YaHei", size: 30, bold: true, color: C.navy }, paragraph: { spacing: { before: 280, after: 180 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Microsoft YaHei", size: 25, bold: true, color: C.blue }, paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("玄巡·星盾 | 项目简介", { size: 15, color: C.gray })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("项目简介 · 第 ", { size: 15, color: C.gray }), new TextRun({ children: [PageNumber.CURRENT], font: "Microsoft YaHei", size: 15, color: C.gray })] })] }) },
      children,
    }],
  });
  fs.writeFileSync(DOCX_OUT, await Packer.toBuffer(doc));
  console.log(`WROTE ${DOCX_OUT}`);
  console.log(`WROTE ${MD_OUT}`);
}

build().catch((error) => { console.error(error); process.exitCode = 1; });\n