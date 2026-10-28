const fs = require("fs");
const path = require("path");
const MODULE_ROOT = path.resolve(__dirname, "..", "..", "docs", "node_modules");
const sharp = require(path.join(MODULE_ROOT, "sharp"));
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
  LevelFormat,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  PageNumber,
  TableOfContents,
  ExternalHyperlink,
} = require(path.join(MODULE_ROOT, "docx"));

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(__dirname, "report_assets");
const OUT = path.join(__dirname, "玄巡·星盾_项目技术文档_增强技术版.docx");
fs.mkdirSync(ASSETS, { recursive: true });

const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1080;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  navy: "16324F",
  blue: "2C6DB2",
  cyan: "138A8A",
  orange: "D17A16",
  red: "B54444",
  green: "2E865A",
  ink: "263746",
  gray: "60758A",
  line: "B7C7D5",
  light: "F4F7FA",
  paleBlue: "EAF2F8",
  paleCyan: "E7F5F3",
  paleOrange: "FFF3D9",
  paleRed: "FBE9E7",
  paleGreen: "E9F6EE",
  white: "FFFFFF",
};

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function svgText(x, y, value, options = {}) {
  const size = options.size || 22;
  const fill = options.fill || `#${C.ink}`;
  const weight = options.weight || 400;
  const anchor = options.anchor || "start";
  const family = options.family || "Microsoft YaHei, Arial, sans-serif";
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function svgMultiline(x, y, lines, options = {}) {
  const size = options.size || 22;
  const lineHeight = options.lineHeight || Math.round(size * 1.45);
  const fill = options.fill || `#${C.ink}`;
  const weight = options.weight || 400;
  const anchor = options.anchor || "start";
  let out = `<text x="${x}" y="${y}" font-family="Microsoft YaHei, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">`;
  lines.forEach((line, index) => {
    out += `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`;
  });
  return `${out}</text>`;
}

function rect(x, y, w, h, fill, stroke = `#${C.line}`, radius = 12, width = 2) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
}

function line(x1, y1, x2, y2, stroke = `#${C.gray}`, width = 3, dash = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}

function arrow(x1, y1, x2, y2, stroke = `#${C.blue}`, width = 4, dash = "") {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} marker-end="url(#arrow)"/>`;
}

function circle(cx, cy, r, fill, stroke = `#${C.line}`, width = 2) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
}

function pill(x, y, label, fill, width = null) {
  const w = width || Math.max(112, label.length * 25 + 34);
  return rect(x, y, w, 38, fill, fill, 19, 1) + svgText(x + w / 2, y + 26, label, { size: 18, fill: "#FFFFFF", weight: 700, anchor: "middle" });
}

function svgWrap(width, height, body, title) {
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>${esc(title)}</title><defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#${C.blue}"/></marker><marker id="arrowOrange" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#${C.orange}"/></marker></defs>${rect(0, 0, width, height, "#FFFFFF", "#FFFFFF", 0, 0)}${body}</svg>`;
}

async function writeFigure(name, width, height, body, title) {
  const svgPath = path.join(ASSETS, `${name}.svg`);
  const pngPath = path.join(ASSETS, `${name}.png`);
  fs.writeFileSync(svgPath, svgWrap(width, height, body, title), "utf8");
  await sharp(Buffer.from(fs.readFileSync(svgPath))).png().toFile(pngPath);
  return { name, svgPath, pngPath, width, height };
}

function figureTitle(body, title, subtitle) {
  return svgText(36, 42, title, { size: 30, fill: `#${C.navy}`, weight: 700 }) + svgText(36, 78, subtitle, { size: 19, fill: `#${C.gray}` }) + body;
}

async function makeFigures() {
  const figures = {};
  let b;

  b = "";
  b += rect(36, 118, 350, 470, `#${C.paleRed}`, `#${C.red}`, 18, 2);
  b += pill(60, 140, "地下空间痛点", `#${C.red}`, 166);
  b += svgMultiline(70, 228, ["发现慢", "固定烟感存在盲区", "人工巡检频率有限"], { size: 23, weight: 700, lineHeight: 54 });
  b += line(70, 386, 350, 386, `#${C.red}`, 2);
  b += svgMultiline(70, 432, ["进不去", "窄通道、车辆遮挡", "烟气与光照干扰"], { size: 19, fill: `#${C.gray}`, lineHeight: 33 });
  b += rect(426, 118, 350, 470, `#${C.paleOrange}`, `#${C.orange}`, 18, 2);
  b += pill(450, 140, "系统闭环", `#${C.orange}`, 136);
  b += svgMultiline(462, 228, ["移动感知", "传感器 + 相机 + 激光雷达", "边缘事件统一编号"], { size: 21, weight: 700, lineHeight: 54 });
  b += line(462, 386, 742, 386, `#${C.orange}`, 2);
  b += svgMultiline(462, 432, ["可解释告警", "先传感器触发，再视觉复核", "证据可回放、状态可追溯"], { size: 19, fill: `#${C.gray}`, lineHeight: 33 });
  b += rect(816, 118, 350, 470, `#${C.paleCyan}`, `#${C.cyan}`, 18, 2);
  b += pill(840, 140, "项目价值", `#${C.cyan}`, 116);
  b += svgMultiline(852, 228, ["发现—定位—确认", "双链路对照实验", "Web / 鸿蒙移动端"], { size: 21, weight: 700, lineHeight: 54 });
  b += line(852, 386, 1132, 386, `#${C.cyan}`, 2);
  b += svgMultiline(852, 432, ["安全边界", "AI 只输出任务意图", "ROS 2 负责限速与停车"], { size: 19, fill: `#${C.gray}`, lineHeight: 33 });
  b += arrow(386, 350, 426, 350, `#${C.red}`, 4);
  b += arrow(776, 350, 816, 350, `#${C.orange}`, 4);
  figures.pain = await writeFigure("fig01_pain_and_value", 1200, 650, figureTitle(b, "图 1  地下空间消防巡检痛点与项目价值", "从“发现慢、进不去、救不了”转化为可移动、可解释、可验证的闭环。"), "痛点与项目价值");

  b = "";
  b += rect(36, 114, 330, 500, `#${C.paleBlue}`, `#${C.blue}`, 18, 2);
  b += pill(58, 136, "移动车端", `#${C.blue}`, 126);
  b += rect(64, 210, 274, 92, "#FFFFFF", `#${C.blue}`, 12, 2);
  b += svgMultiline(84, 244, ["MicroROS V2 / ESP32-S3", "底盘与 micro-ROS"], { size: 18, weight: 700, lineHeight: 28 });
  b += rect(64, 330, 274, 92, "#FFFFFF", `#${C.cyan}`, 12, 2);
  b += svgMultiline(84, 364, ["摄像头 + 激光雷达", "/camera /scan /odom"], { size: 18, weight: 700, lineHeight: 28 });
  b += rect(64, 450, 274, 104, "#FFFFFF", `#${C.orange}`, 12, 2);
  b += svgMultiline(84, 484, ["HH-D02 星闪板", "R-SENSE 事件生成"], { size: 18, weight: 700, lineHeight: 28 });
  b += arrow(366, 365, 426, 365, `#${C.blue}`, 5);
  b += svgText(396, 340, "Wi-Fi / micro-ROS", { size: 16, fill: `#${C.blue}`, weight: 700, anchor: "middle" });
  b += rect(426, 114, 366, 500, `#${C.light}`, `#${C.line}`, 18, 2);
  b += pill(448, 136, "Ubuntu ROS 2 + Edge", `#${C.navy}`, 184);
  b += rect(452, 210, 314, 86, "#FFFFFF", `#${C.orange}`, 12, 2);
  b += svgMultiline(472, 244, ["micro-ROS Agent / ROS 2", "话题、TF、控制桥"], { size: 18, weight: 700, lineHeight: 28 });
  b += rect(452, 324, 314, 86, "#FFFFFF", `#${C.cyan}`, 12, 2);
  b += svgMultiline(472, 358, ["FastAPI + WebSocket", "串口网关 / 安全仲裁"], { size: 18, weight: 700, lineHeight: 28 });
  b += rect(452, 438, 314, 116, "#FFFFFF", `#${C.blue}`, 12, 2);
  b += svgMultiline(472, 472, ["SQLite + JSONL", "视觉、孪生、回放、实验"], { size: 18, weight: 700, lineHeight: 28 });
  b += arrow(792, 365, 852, 365, `#${C.orange}`, 5);
  b += rect(852, 114, 314, 500, `#${C.paleCyan}`, `#${C.cyan}`, 18, 2);
  b += pill(874, 136, "交互与展示", `#${C.cyan}`, 142);
  b += rect(878, 224, 262, 96, "#FFFFFF", `#${C.blue}`, 12, 2);
  b += svgMultiline(898, 260, ["Windows Web", "驾驶台 / 数字孪生"], { size: 18, weight: 700, lineHeight: 28 });
  b += rect(878, 350, 262, 96, "#FFFFFF", `#${C.green}`, 12, 2);
  b += svgMultiline(898, 386, ["鸿蒙原生 ArkUI", "告警 / 确认 / 视频 / 暂停"], { size: 17, weight: 700, lineHeight: 28 });
  b += rect(878, 476, 262, 78, "#FFFFFF", `#${C.orange}`, 12, 2);
  b += svgText(1009, 510, "操作员 / 评委", { size: 19, fill: `#${C.ink}`, weight: 700, anchor: "middle" });
  figures.arch = await writeFigure("fig02_end_to_end_architecture", 1200, 650, figureTitle(b, "图 2  玄巡·星盾端到端总体架构", "车端负责感知与运动，Ubuntu 负责 ROS 2 与边缘决策，Web/鸿蒙负责安全交互和证据展示。"), "总体架构");

  b = "";
  b += rect(40, 120, 1120, 470, "#FAFCFE", `#${C.line}`, 18, 2);
  b += svgText(72, 158, "车辆侧 / R01", { size: 22, fill: `#${C.navy}`, weight: 700 });
  const boards = [
    ["绿色", "R-SENSE", "COM12", "传感采样\n统一 event_id", "#2E9A68"],
    ["红色", "R-SF", "COM13", "UART1 接收\nSLE 发送", "#D54646"],
    ["蓝色", "R-WIFI", "COM15", "UART2 接收\nWi-Fi UDP", "#3479D1"],
    ["黄色", "C-SF", "COM14", "SLE 接收\n中控 UART0", "#D49A22"],
    ["品红", "C-WIFI", "COM16", "Wi-Fi 接收\n中控 UART0", "#B04AAB"],
  ];
  boards.forEach((item, i) => {
    const x = 72 + i * 214;
    b += rect(x, 205, 184, 194, "#FFFFFF", item[4], 12, 3);
    b += circle(x + 28, 236, 12, item[4], item[4], 1);
    b += svgText(x + 50, 243, item[0], { size: 16, fill: item[4], weight: 700 });
    b += svgText(x + 92, 284, item[1], { size: 24, fill: `#${C.navy}`, weight: 700, anchor: "middle" });
    b += svgText(x + 92, 316, item[2], { size: 16, fill: `#${C.gray}`, anchor: "middle" });
    b += svgMultiline(x + 92, 354, item[3].split("\n"), { size: 16, fill: `#${C.ink}`, anchor: "middle", lineHeight: 25 });
  });
  b += arrow(164, 430, 478, 430, `#${C.red}`, 4);
  b += arrow(478, 430, 794, 430, `#${C.blue}`, 4);
  b += svgText(320, 420, "UART1 / SLE", { size: 16, fill: `#${C.red}`, weight: 700, anchor: "middle" });
  b += svgText(636, 420, "UART2 / Wi-Fi", { size: 16, fill: `#${C.blue}`, weight: 700, anchor: "middle" });
  b += arrow(886, 399, 886, 500, `#${C.orange}`, 4);
  b += arrow(1094, 399, 1094, 500, `#${C.magenta || "#B04AAB"}`, 4);
  b += rect(190, 486, 820, 70, `#${C.light}`, `#${C.line}`, 10, 1);
  b += svgText(600, 528, "C-SF / C-WIFI 通过 USB-UART 接入 Windows Edge；同一 event_id 才进入正式 A/B 配对。", { size: 18, fill: `#${C.ink}`, anchor: "middle" });
  figures.boards = await writeFigure("fig03_five_board_roles", 1200, 650, figureTitle(b, "图 3  五块 HH-D02 星闪板角色与端口映射", "颜色用于现场识别，端口仅作当前枚举记录；USB 重枚举或 DHCP 变化时以现场回读为准。"), "五板角色");

  b = "";
  b += rect(36, 120, 528, 480, `#${C.paleBlue}`, `#${C.blue}`, 18, 2);
  b += pill(58, 142, "SLE / UART1 路径", `#${C.blue}`, 170);
  b += rect(80, 226, 186, 112, "#FFFFFF", `#${C.green}`, 10, 2);
  b += svgMultiline(173, 263, ["绿色 R-SENSE", "GPIO15 TX", "COM12"], { size: 18, weight: 700, anchor: "middle", lineHeight: 27 });
  b += arrow(266, 282, 390, 282, `#${C.red}`, 5);
  b += svgText(328, 264, "TX -> RX", { size: 16, fill: `#${C.red}`, weight: 700, anchor: "middle" });
  b += rect(390, 226, 124, 112, "#FFFFFF", `#${C.red}`, 10, 2);
  b += svgMultiline(452, 263, ["红色 R-SF", "GPIO16 RX"], { size: 17, weight: 700, anchor: "middle", lineHeight: 27 });
  b += line(173, 350, 452, 350, `#${C.gray}`, 3);
  b += svgText(312, 378, "GND 共地；不连接两板 5V", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += arrow(452, 400, 452, 520, `#${C.orange}`, 4);
  b += svgText(470, 468, "SLE", { size: 18, fill: `#${C.orange}`, weight: 700 });
  b += rect(62, 442, 212, 76, "#FFFFFF", `#${C.orange}`, 10, 2);
  b += svgText(168, 487, "黄色 C-SF / COM14", { size: 18, fill: `#${C.ink}`, weight: 700, anchor: "middle" });
  b += rect(602, 120, 562, 480, `#${C.paleCyan}`, `#${C.cyan}`, 18, 2);
  b += pill(624, 142, "Wi-Fi / UART2 路径", `#${C.cyan}`, 190);
  b += rect(650, 226, 186, 112, "#FFFFFF", `#${C.green}`, 10, 2);
  b += svgMultiline(743, 263, ["绿色 R-SENSE", "GPIO8 TX", "COM12"], { size: 18, weight: 700, anchor: "middle", lineHeight: 27 });
  b += arrow(836, 282, 960, 282, `#${C.blue}`, 5);
  b += svgText(898, 264, "TX -> RX", { size: 16, fill: `#${C.blue}`, weight: 700, anchor: "middle" });
  b += rect(960, 226, 164, 112, "#FFFFFF", `#${C.blue}`, 10, 2);
  b += svgMultiline(1042, 263, ["蓝色 R-WIFI", "GPIO7 RX"], { size: 17, weight: 700, anchor: "middle", lineHeight: 27 });
  b += line(743, 350, 1042, 350, `#${C.gray}`, 3);
  b += svgText(892, 378, "GND 共地；两块板分别 USB 供电", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += arrow(1042, 400, 1042, 520, `#${C.blue}`, 4);
  b += svgText(1060, 468, "UDP", { size: 18, fill: `#${C.blue}`, weight: 700 });
  b += rect(730, 442, 250, 76, "#FFFFFF", `#${C.cyan}`, 10, 2);
  b += svgText(855, 487, "品红 C-WIFI / COM16", { size: 18, fill: `#${C.ink}`, weight: 700, anchor: "middle" });
  figures.wiring = await writeFigure("fig04_uart_wiring", 1200, 650, figureTitle(b, "图 4  两路事件传输的 UART 接线约束", "必须完成 TX→RX、GND 共地；实体联调前停止占用中控串口的服务，避免端口冲突。"), "UART 接线");

  b = "";
  const rows = [["R-SENSE", 128, `#${C.green}`], ["R-SF", 220, `#${C.red}`], ["C-SF", 312, `#${C.orange}`], ["R-WIFI", 404, `#${C.blue}`], ["C-WIFI", 496, "#B04AAB"], ["Edge", 588, `#${C.navy}`]];
  rows.forEach(([label, y, color]) => {
    b += svgText(44, y + 7, label, { size: 18, fill: color, weight: 700 });
    b += line(146, y, 1160, y, `#${C.line}`, 2);
  });
  b += line(230, 96, 230, 622, `#${C.gray}`, 2, "5 5");
  b += line(488, 96, 488, 622, `#${C.gray}`, 2, "5 5");
  b += line(740, 96, 740, 622, `#${C.gray}`, 2, "5 5");
  b += line(1000, 96, 1000, 622, `#${C.gray}`, 2, "5 5");
  b += svgText(230, 102, "t0 事件生成", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(488, 102, "车端传输", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(740, 102, "t2 中控接收", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(1000, 102, "ACK / 入库", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += circle(230, 128, 10, `#${C.green}`, `#${C.green}`, 1);
  b += arrow(240, 128, 464, 220, `#${C.red}`, 4);
  b += arrow(504, 220, 718, 312, `#${C.orange}`, 4);
  b += arrow(240, 128, 464, 404, `#${C.blue}`, 4);
  b += arrow(504, 404, 718, 496, "#B04AAB", 4);
  b += arrow(760, 312, 972, 588, `#${C.orange}`, 3);
  b += arrow(760, 496, 972, 588, `#${C.blue}`, 3);
  b += svgText(370, 196, "SLE 配对", { size: 16, fill: `#${C.red}`, weight: 700, anchor: "middle" });
  b += svgText(370, 386, "Wi-Fi 对照", { size: 16, fill: `#${C.blue}`, weight: 700, anchor: "middle" });
  b += svgText(850, 420, "同一 event_id", { size: 16, fill: `#${C.navy}`, weight: 700, anchor: "middle" });
  b += rect(210, 634, 790, 48, `#${C.light}`, `#${C.line}`, 8, 1);
  b += svgText(605, 665, "正式样本 = SLE 与 Wi-Fi 均到达 Edge，且 event_id 相同；未配对数据只作链路诊断。", { size: 17, fill: `#${C.ink}`, anchor: "middle" });
  figures.sequence = await writeFigure("fig05_dual_link_sequence", 1200, 720, figureTitle(b, "图 5  SLE/Wi-Fi 双链路事件时序与正式配对规则", "严格 A/B 测试记录 t0、t2、ACK、retry，并按同一 event_id 配对，不使用模拟数据替代自然样本。"), "双链路时序");

  b = "";
  const layerData = [
    ["交互层", "Windows Web / 鸿蒙 ArkUI / 浏览器语音", C.paleCyan, C.cyan],
    ["服务层", "FastAPI REST / WebSocket / DeepSeek 任务解析", C.paleBlue, C.blue],
    ["安全层", "模式状态 / 限速 / 前方 0.45 m 停车 / 急停锁存", C.paleRed, C.red],
    ["数据层", "TwinState / VisionGate / SQLite / JSONL 回放", C.paleOrange, C.orange],
    ["ROS 适配层", "Ubuntu HTTP 控制桥 / /odom /scan /cmd_vel", "EEF5F6", C.cyan],
    ["设备层", "ESP32-S3 MicroROS V2 + HH-D02 星闪五板", "F3F5F7", C.navy],
  ];
  layerData.forEach((item, i) => {
    const y = 118 + i * 78;
    b += rect(80, y, 1040, 56, `#${item[2]}`, `#${item[3]}`, 10, 2);
    b += svgText(112, y + 35, item[0], { size: 20, fill: `#${item[3]}`, weight: 700 });
    b += svgText(340, y + 35, item[1], { size: 18, fill: `#${C.ink}` });
    if (i < layerData.length - 1) b += arrow(600, y + 58, 600, y + 76, `#${C.gray}`, 2);
  });
  b += rect(80, 600, 1040, 52, `#${C.light}`, `#${C.line}`, 8, 1);
  b += svgText(100, 633, "方向约束", { size: 18, fill: `#${C.navy}`, weight: 700 });
  b += svgText(250, 633, "AI 不产生速度流；任何运动指令必须经过 ROS 安全仲裁和失联停车。", { size: 17, fill: `#${C.ink}` });
  figures.software = await writeFigure("fig06_software_layers", 1200, 700, figureTitle(b, "图 6  软件分层与安全依赖方向", "高层任务、视觉和 Web/App 均通过受控接口进入 Edge；ROS 2 是唯一的运动安全出口。"), "软件分层");

  b = "";
  const flow = [
    ["温度 / 烟雾 / 气体", 70, C.paleOrange, C.orange],
    ["相机帧 / 视觉检测", 302, C.paleBlue, C.blue],
    ["统一 AlertEvent", 534, C.paleRed, C.red],
    ["双链路 / 串口网关", 766, C.paleCyan, C.cyan],
    ["Twin + Replay + Web/App", 998, C.paleGreen, C.green],
  ];
  flow.forEach(([label, x, fill, stroke], i) => {
    b += rect(x, 230, 180, 160, `#${fill}`, `#${stroke}`, 16, 2);
    b += svgMultiline(x + 90, 285, String(label).split(" / "), { size: 18, fill: `#${stroke}`, weight: 700, anchor: "middle", lineHeight: 29 });
    if (i < flow.length - 1) b += arrow(x + 182, 310, x + 226, 310, `#${stroke}`, 4);
  });
  b += svgText(160, 176, "采样", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(392, 176, "复核", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(624, 176, "证据化", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(856, 176, "传输", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += svgText(1088, 176, "展示", { size: 17, fill: `#${C.gray}`, anchor: "middle" });
  b += rect(130, 474, 940, 96, "#FFFFFF", `#${C.line}`, 12, 2);
  b += svgMultiline(600, 512, ["每条证据携带 event_id、timestamp、pose、sensor_values、transport_samples", "同一事件驱动告警、热区、视频框、链路点和回放时间轴"], { size: 19, fill: `#${C.ink}`, anchor: "middle", lineHeight: 32 });
  figures.eventFlow = await writeFigure("fig07_event_evidence_flow", 1200, 650, figureTitle(b, "图 7  多源火情事件的数据流与证据闭环", "先由传感器触发，视觉模块作为复核证据参与；模型失效时进入 VISION_FAULT，不生成虚假视觉 P3。"), "事件数据流");

  b = "";
  const lobster = [
    ["语音 / 文字", 60, C.paleCyan, C.cyan],
    ["ASR / 文本", 282, C.paleBlue, C.blue],
    ["DeepSeek / 本地规则", 504, C.paleOrange, C.orange],
    ["结构化 TaskPlan", 726, C.paleGreen, C.green],
    ["SafetyArbiter", 948, C.paleRed, C.red],
  ];
  lobster.forEach(([label, x, fill, stroke], i) => {
    b += rect(x, 220, 176, 128, `#${fill}`, `#${stroke}`, 14, 2);
    b += svgMultiline(x + 88, 273, String(label).split(" / "), { size: 18, fill: `#${stroke}`, weight: 700, anchor: "middle", lineHeight: 28 });
    if (i < lobster.length - 1) b += arrow(x + 178, 284, x + 214, 284, `#${stroke}`, 4);
  });
  b += rect(282, 430, 398, 88, `#${C.paleRed}`, `#${C.red}`, 12, 2);
  b += svgMultiline(481, 466, ["拒绝路径", "急停、速度、未知动作不进入 AI 控制"], { size: 18, fill: `#${C.red}`, weight: 700, anchor: "middle", lineHeight: 28 });
  b += arrow(592, 348, 481, 430, `#${C.red}`, 3, "7 5");
  b += rect(760, 430, 348, 88, `#${C.paleGreen}`, `#${C.green}`, 12, 2);
  b += svgMultiline(934, 466, ["ROS 2 执行", "限速、避障、失联停车、零速度"], { size: 18, fill: `#${C.green}`, weight: 700, anchor: "middle", lineHeight: 28 });
  b += arrow(1036, 348, 934, 430, `#${C.green}`, 3);
  b += rect(364, 574, 472, 44, `#${C.light}`, `#${C.line}`, 8, 1);
  b += svgText(600, 603, "START_PATROL / GO_TO_POINT / RETURN_HOME / PAUSE / RESUME / STOP", { size: 15, fill: `#${C.ink}`, anchor: "middle" });
  figures.agent = await writeFigure("fig08_cognitive_mission_agent", 1200, 680, figureTitle(b, "图 8  玄巡认知任务智能体的安全执行链", "智能体只负责自然语言到受控意图；运动控制、急停和安全降级由 ROS 2/Edge 固定逻辑完成。"), "认知任务智能体安全链");

  b = "";
  const states = [
    ["固定循迹", 100, 230, C.paleBlue, C.blue],
    ["手动控制", 430, 230, C.paleCyan, C.cyan],
    ["认知任务智能体", 760, 230, C.paleOrange, C.orange],
    ["暂停 / 急停", 430, 470, C.paleRed, C.red],
  ];
  states.forEach(([label, x, y, fill, stroke]) => {
    b += rect(x, y, 220, 100, `#${fill}`, `#${stroke}`, 16, 3);
    b += svgText(x + 110, y + 46, label, { size: 22, fill: `#${stroke}`, weight: 700, anchor: "middle" });
    b += svgText(x + 110, y + 76, label === "固定循迹" ? "route + scan" : label === "手动控制" ? "Web / App" : label === "认知任务智能体" ? "TaskPlan" : "zero velocity", { size: 15, fill: `#${C.gray}`, anchor: "middle" });
  });
  b += arrow(320, 280, 430, 280, `#${C.blue}`, 4);
  b += arrow(650, 280, 760, 280, `#${C.orange}`, 4);
  b += arrow(870, 330, 650, 470, `#${C.red}`, 4);
  b += arrow(540, 330, 540, 470, `#${C.red}`, 4);
  b += arrow(430, 520, 320, 330, `#${C.red}`, 3, "7 5");
  b += arrow(650, 520, 760, 330, `#${C.red}`, 3, "7 5");
  b += svgText(600, 620, "所有状态共享：限速 0.25 m/s、角速度 0.80 rad/s、前方 0.45 m 停车、急停锁存", { size: 17, fill: `#${C.ink}`, anchor: "middle" });
  figures.modes = await writeFigure("fig09_control_mode_state_machine", 1200, 680, figureTitle(b, "图 9  四种运行模式与安全状态机", "普通暂停可恢复；急停为锁存状态，不能由 AI 或移动端解除。"), "运行模式状态机");

  b = "";
  b += rect(36, 118, 548, 510, "#F8FAFC", `#${C.line}`, 18, 2);
  b += pill(58, 140, "俯视结构", `#${C.blue}`, 130);
  b += rect(164, 272, 300, 210, "#DCE8F2", `#${C.blue}`, 34, 4);
  b += rect(122, 298, 56, 158, "#263746", `#${C.ink}`, 24, 2);
  b += rect(450, 298, 56, 158, "#263746", `#${C.ink}`, 24, 2);
  b += circle(314, 236, 34, "#222B33", `#${C.orange}`, 3);
  b += svgText(314, 243, "L", { size: 22, fill: "#FFFFFF", weight: 700, anchor: "middle" });
  b += rect(266, 188, 96, 42, "#B6C7D6", `#${C.blue}`, 8, 2);
  b += svgText(314, 216, "camera", { size: 16, fill: `#${C.ink}`, weight: 700, anchor: "middle" });
  b += rect(280, 336, 68, 48, "#556B7A", `#${C.ink}`, 7, 2);
  b += svgText(314, 367, "IMU", { size: 15, fill: "#FFFFFF", weight: 700, anchor: "middle" });
  b += arrow(314, 176, 314, 128, `#${C.red}`, 4);
  b += svgText(330, 144, "+x 前进", { size: 17, fill: `#${C.red}`, weight: 700 });
  b += svgText(86, 556, "L = 激光雷达；相机支架可能进入水平扫描面", { size: 17, fill: `#${C.gray}` });
  b += rect(618, 118, 548, 510, "#F8FAFC", `#${C.line}`, 18, 2);
  b += pill(640, 140, "扫描面诊断", `#${C.red}`, 146);
  b += rect(690, 310, 380, 150, "#DCE8F2", `#${C.blue}`, 26, 4);
  b += circle(780, 470, 54, "#263746", `#${C.ink}`, 3);
  b += circle(980, 470, 54, "#263746", `#${C.ink}`, 3);
  b += circle(880, 244, 30, "#222B33", `#${C.orange}`, 3);
  b += svgText(880, 251, "L", { size: 20, fill: "#FFFFFF", weight: 700, anchor: "middle" });
  b += rect(828, 270, 104, 62, "#B6C7D6", `#${C.blue}`, 8, 2);
  b += svgText(880, 307, "camera", { size: 16, fill: `#${C.ink}`, weight: 700, anchor: "middle" });
  b += `<path d="M880 244 L650 570 A390 390 0 0 0 1110 570 Z" fill="#D17A16" opacity="0.12" stroke="#D17A16" stroke-width="2" stroke-dasharray="8 6"/>`;
  b += line(680, 560, 1080, 560, `#${C.orange}`, 3, "9 6");
  b += svgMultiline(650, 596, ["检查项：支架不应进入扫描面", "0.12 m 接近 range_min 时先核对 /scan 发布者"], { size: 16, fill: `#${C.gray}`, lineHeight: 25 });
  figures.robot = await writeFigure("fig10_robot_2d_and_scan_plane", 1200, 690, figureTitle(b, "图 10  小车二维结构与激光扫描面诊断示意", "项目绘制的说明图，不替代厂家机械图；用于解释“相机支架遮挡雷达”的现场排查假设。"), "机器人二维结构");

  b = "";
  b += rect(36, 120, 724, 486, "#F8FAFC", `#${C.line}`, 18, 2);
  for (let x = 80; x <= 720; x += 80) b += line(x, 162, x, 566, `#${C.line}`, 1);
  for (let y = 162; y <= 566; y += 80) b += line(80, y, 720, y, `#${C.line}`, 1);
  b += rect(170, 250, 210, 140, "#DCE8F2", `#${C.blue}`, 24, 3);
  b += circle(276, 220, 24, `#${C.blue}`, `#${C.blue}`, 1);
  b += svgText(276, 228, "R01", { size: 14, fill: "#FFFFFF", weight: 700, anchor: "middle" });
  b += circle(560, 370, 90, "#F5BD65", `#${C.orange}`, 2);
  b += circle(560, 370, 58, "#F9D89A", "#FFFFFF", 1);
  b += svgText(560, 365, "热区", { size: 22, fill: `#${C.orange}`, weight: 700, anchor: "middle" });
  b += svgText(560, 392, "P2 / 50%", { size: 16, fill: `#${C.ink}`, anchor: "middle" });
  b += rect(420, 180, 170, 70, "#E9F6EE", `#${C.green}`, 10, 2);
  b += svgText(505, 222, "B 区设备通道", { size: 18, fill: `#${C.green}`, weight: 700, anchor: "middle" });
  b += svgText(114, 594, "SLAM 2D 栅格 / 机器人位姿 / 风险分区 / 事件点加权", { size: 16, fill: `#${C.gray}` });
  b += rect(800, 120, 366, 486, `#${C.paleCyan}`, `#${C.cyan}`, 18, 2);
  b += pill(822, 142, "热区计算", `#${C.cyan}`, 122);
  b += svgMultiline(836, 230, ["等级权重", "P1 0.35 / P2 0.65 / P3 1.0", "", "视觉置信度参与权重", "空间半径 1.5 m", "时间半衰期 300 s", "手工区 0.2 / 0.5 / 0.8"], { size: 18, weight: 700, lineHeight: 40 });
  figures.twin = await writeFigure("fig11_digital_twin_heatmap", 1200, 660, figureTitle(b, "图 11  2.5D 时空数字孪生与风险热区", "只呈现真实 SLAM 2D 地图上的风险浮层，不伪造完整 BIM/三维模型。"), "数字孪生热区");

  b = "";
  b += line(140, 240, 1100, 240, `#${C.line}`, 3);
  const tracks = [["传感器", 300, C.orange], ["视觉", 390, C.blue], ["链路", 480, C.cyan], ["操作", 570, C.red]];
  tracks.forEach(([label, y, color]) => {
    b += svgText(50, y + 7, label, { size: 18, fill: color, weight: 700 });
    b += line(140, y, 1100, y, `#${C.line}`, 2);
  });
  [250, 430, 610, 790, 970].forEach((x, i) => {
    b += line(x, 170, x, 620, `#${C.gray}`, 2, "5 5");
    b += svgText(x, 150, `T${i + 1}`, { size: 16, fill: `#${C.gray}`, anchor: "middle" });
  });
  b += circle(250, 300, 10, `#${C.orange}`, `#${C.orange}`, 1);
  b += circle(430, 300, 10, `#${C.orange}`, `#${C.orange}`, 1);
  b += circle(610, 300, 10, `#${C.orange}`, `#${C.orange}`, 1);
  b += rect(430, 365, 112, 48, `#${C.paleBlue}`, `#${C.blue}`, 8, 2);
  b += svgText(486, 395, "smoke 0.82", { size: 15, fill: `#${C.blue}`, weight: 700, anchor: "middle" });
  b += circle(430, 480, 10, `#${C.cyan}`, `#${C.cyan}`, 1);
  b += circle(610, 480, 10, `#${C.cyan}`, `#${C.cyan}`, 1);
  b += circle(790, 480, 10, `#${C.cyan}`, `#${C.cyan}`, 1);
  b += rect(610, 548, 150, 48, `#${C.paleRed}`, `#${C.red}`, 8, 2);
  b += svgText(685, 578, "人工确认 / 暂停", { size: 15, fill: `#${C.red}`, weight: 700, anchor: "middle" });
  b += arrow(250, 300, 610, 300, `#${C.orange}`, 3);
  b += arrow(430, 480, 790, 480, `#${C.cyan}`, 3);
  b += svgText(610, 660, "拖动统一时间轴：地图位姿、热区、视觉框、传输点和安全操作同步变化", { size: 18, fill: `#${C.navy}`, weight: 700, anchor: "middle" });
  figures.replay = await writeFigure("fig12_replay_timeline", 1200, 720, figureTitle(b, "图 12  统一时间轴证据回放模型", "SQLite 保存结构化索引，JSONL 保存原始帧；回放以统一 timestamp 对齐多源证据。"), "证据回放");

  b = "";
  b += rect(70, 220, 210, 128, `#${C.paleGreen}`, `#${C.green}`, 14, 2);
  b += svgMultiline(175, 272, ["同一 event_id", "t0 / payload"], { size: 20, fill: `#${C.green}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(280, 284, 410, 220, `#${C.red}`, 4);
  b += arrow(280, 284, 410, 370, `#${C.blue}`, 4);
  b += rect(410, 156, 230, 128, `#${C.paleRed}`, `#${C.red}`, 14, 2);
  b += svgMultiline(525, 208, ["SLE / C-SF", "t2、ACK、retry"], { size: 20, fill: `#${C.red}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += rect(410, 348, 230, 128, `#${C.paleBlue}`, `#${C.blue}`, 14, 2);
  b += svgMultiline(525, 400, ["Wi-Fi / C-WIFI", "t2、ACK、retry"], { size: 20, fill: `#${C.blue}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(640, 220, 780, 284, `#${C.red}`, 4);
  b += arrow(640, 412, 780, 284, `#${C.blue}`, 4);
  b += rect(780, 220, 340, 128, `#${C.paleOrange}`, `#${C.orange}`, 14, 2);
  b += svgMultiline(950, 270, ["配对汇总", "mean / P95 / 胜出数"], { size: 20, fill: `#${C.orange}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += rect(120, 540, 960, 70, `#${C.light}`, `#${C.line}`, 10, 1);
  b += svgText(600, 583, "当前真实配对样本 = 0；正式结论必须在完成 R-SENSE→R-SF/R-WIFI 跳线后采集。", { size: 18, fill: `#${C.red}`, weight: 700, anchor: "middle" });
  figures.ab = await writeFigure("fig13_ab_experiment", 1200, 690, figureTitle(b, "图 13  严格 SLE/Wi-Fi A/B 实验流程", "仅纳入同一 event_id 同时出现在 C-SF 与 C-WIFI 的自然事件；演示注入不进入正式统计。"), "A/B 实验");

  b = "";
  const gates = [["G1 构建", "Edge 55 passed / Web build", C.paleBlue, C.blue], ["G2 软件闭环", "控制、视觉门控、回放、热区", C.paleCyan, C.cyan], ["G3 实体硬件", "五包写入与颜色/身份", C.paleOrange, C.orange], ["G4 现场验收", "自然双链路、运动、视觉、A/B", C.paleRed, C.red]];
  gates.forEach((item, i) => {
    const y = 126 + i * 112;
    b += rect(110 + i * 45, y, 900 - i * 90, 78, `#${item[2]}`, `#${item[3]}`, 12, 2);
    b += svgText(150 + i * 45, y + 33, item[0], { size: 21, fill: `#${item[3]}`, weight: 700 });
    b += svgText(410 + i * 45, y + 33, item[1], { size: 18, fill: `#${C.ink}` });
  });
  b += rect(164, 590, 872, 48, `#${C.light}`, `#${C.line}`, 8, 1);
  b += svgText(600, 621, "本报告只把有证据支撑的层级标记为已验证；现场未完成项继续保持待验证。", { size: 17, fill: `#${C.ink}`, anchor: "middle" });
  figures.accept = await writeFigure("fig14_acceptance_gates", 1200, 690, figureTitle(b, "图 14  项目验收门与证据等级", "从软件构建到现场自然事件，逐级增加外部依赖；任何一层未通过都不应越级宣称系统完成。"), "验收门");

  b = "";
  const mapStages = [
    ["1 传感器准备", "/scan /odom /imu\n时间戳、frame_id、QoS", C.paleBlue, C.blue],
    ["2 数据清洗", "范围裁剪、无效值过滤\n运动畸变与安装偏差检查", C.paleCyan, C.cyan],
    ["3 状态估计", "轮速里程计 + IMU\nodom -> base_footprint", C.paleOrange, C.orange],
    ["4 SLAM 建图", "scan + pose\nmap -> odom、占据栅格", C.paleGreen, C.green],
    ["5 地图固化", "map.yaml + image.pgm\n版本、坐标原点、分辨率", C.paleRed, C.red],
    ["6 定位导航", "AMCL/SLAM 定位\n目标点 -> 路径 -> /cmd_vel", "EEF5F6", C.navy],
  ];
  mapStages.forEach(([title, body, fill, stroke], i) => {
    const x = 50 + (i % 3) * 382;
    const y = 140 + Math.floor(i / 3) * 220;
    b += rect(x, y, 330, 142, `#${fill}`, `#${stroke}`, 14, 2);
    b += svgText(x + 22, y + 34, title, { size: 19, fill: `#${stroke}`, weight: 700 });
    b += svgMultiline(x + 22, y + 76, body.split("\n"), { size: 17, fill: `#${C.ink}`, lineHeight: 30 });
    if (i < mapStages.length - 1 && i !== 2) b += arrow(x + 334, y + 71, x + 372, y + 71, `#${stroke}`, 3);
  });
  b += arrow(380, 282, 380, 352, `#${C.gray}`, 3);
  b += arrow(762, 282, 762, 352, `#${C.gray}`, 3);
  b += rect(150, 594, 900, 48, `#${C.light}`, `#${C.line}`, 8, 1);
  b += svgText(600, 625, "地图质量不是“能显示”即可：必须检查闭环误差、墙体连续性、雷达安装方向、坐标原点和版本号。", { size: 17, fill: `#${C.ink}`, anchor: "middle" });
  figures.mapping = await writeFigure("fig15_mapping_localization_pipeline", 1200, 700, figureTitle(b, "图 15  小车建图、定位与导航的完整技术流水线", "从传感器时间戳和坐标系开始，经过清洗、状态估计、SLAM、地图固化，最终进入定位与路径规划。"), "建图定位流水线");

  b = "";
  b += rect(44, 126, 520, 496, "#F8FAFC", `#${C.line}`, 18, 2);
  b += pill(68, 148, "TF2 坐标关系", `#${C.blue}`, 150);
  const tfNodes = [["map", 270, 235, C.orange], ["odom", 270, 330, C.cyan], ["base_footprint", 270, 425, C.blue], ["base_link", 270, 520, C.green]];
  tfNodes.forEach(([label, x, y, color]) => { b += rect(x - 105, y - 28, 210, 56, "#FFFFFF", `#${color}`, 10, 2) + svgText(x, y + 7, label, { size: 18, fill: `#${color}`, weight: 700, anchor: "middle" }); });
  b += arrow(270, 265, 270, 300, `#${C.orange}`, 3);
  b += arrow(270, 360, 270, 395, `#${C.cyan}`, 3);
  b += arrow(270, 455, 270, 490, `#${C.blue}`, 3);
  b += line(375, 520, 500, 520, `#${C.green}`, 3);
  b += svgText(502, 514, "laser_frame / camera_link / imu_link", { size: 15, fill: `#${C.green}` });
  b += rect(612, 126, 554, 496, `#${C.paleCyan}`, `#${C.cyan}`, 18, 2);
  b += pill(636, 148, "ROS 2 QoS 契约", `#${C.cyan}`, 150);
  const qosRows = [["/scan", "sensor_data", "BEST_EFFORT / VOLATILE", "实时传感"], ["/odom", "queue 10", "按底盘发布契约", "位姿反馈"], ["/cmd_vel", "短时脉冲", "控制桥 QoS", "运动控制"], ["/camera", "图像流", "按驱动配置", "视觉复核"]];
  qosRows.forEach((row, i) => {
    const y = 220 + i * 78;
    b += line(636, y + 42, 1136, y + 42, `#${C.line}`, 1);
    b += svgText(646, y + 25, row[0], { size: 17, fill: `#${C.navy}`, weight: 700 });
    b += svgText(770, y + 25, row[1], { size: 16, fill: `#${C.ink}` });
    b += svgText(916, y + 25, row[2], { size: 14, fill: `#${C.cyan}`, weight: 700 });
    b += svgText(646, y + 58, row[3], { size: 14, fill: `#${C.gray}` });
  });
  b += svgText(636, 566, "排错顺序：topic list -> publisher count -> QoS -> frame_id -> 时间戳 -> TF 连通性", { size: 16, fill: `#${C.ink}`, weight: 700 });
  figures.tfQos = await writeFigure("fig16_tf_and_qos_contract", 1200, 700, figureTitle(b, "图 16  TF2 坐标树与 ROS 2 QoS 契约", "运动、建图和视觉问题往往不是算法本身，而是 frame_id、QoS、时间戳或坐标变换不一致。"), "TF 与 QoS");

  b = "";
  b += rect(36, 128, 200, 126, `#${C.paleCyan}`, `#${C.cyan}`, 14, 2);
  b += svgMultiline(136, 182, ["目标点 / 固定路线", "TaskPlan / route"], { size: 18, fill: `#${C.cyan}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(236, 191, 310, 191, `#${C.cyan}`, 4);
  b += rect(310, 128, 220, 126, `#${C.paleBlue}`, `#${C.blue}`, 14, 2);
  b += svgMultiline(420, 182, ["全局规划", "地图 / 路网 / Nav2"], { size: 18, fill: `#${C.blue}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(530, 191, 604, 191, `#${C.blue}`, 4);
  b += rect(604, 128, 220, 126, `#${C.paleOrange}`, `#${C.orange}`, 14, 2);
  b += svgMultiline(714, 182, ["局部控制", "航向误差 / 速度限幅"], { size: 18, fill: `#${C.orange}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(824, 191, 898, 191, `#${C.orange}`, 4);
  b += rect(898, 128, 260, 126, `#${C.paleRed}`, `#${C.red}`, 14, 2);
  b += svgMultiline(1028, 182, ["安全门", "scan / watchdog / E-stop"], { size: 18, fill: `#${C.red}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(1028, 254, 1028, 360, `#${C.red}`, 4);
  b += rect(898, 360, 260, 126, `#${C.paleGreen}`, `#${C.green}`, 14, 2);
  b += svgMultiline(1028, 414, ["/cmd_vel", "底盘执行与反馈"], { size: 18, fill: `#${C.green}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(898, 423, 824, 423, `#${C.green}`, 3, "7 5");
  b += rect(604, 360, 220, 126, "#F8FAFC", `#${C.line}`, 14, 2);
  b += svgMultiline(714, 414, ["/scan + /odom", "障碍距离 / 位姿"], { size: 18, fill: `#${C.navy}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(604, 423, 530, 423, `#${C.cyan}`, 3);
  b += rect(310, 360, 220, 126, `#${C.paleCyan}`, `#${C.cyan}`, 14, 2);
  b += svgMultiline(420, 414, ["巡检控制器", "距离误差 / 角度误差"], { size: 18, fill: `#${C.cyan}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(420, 360, 420, 254, `#${C.cyan}`, 3, "7 5");
  b += rect(170, 562, 860, 56, `#${C.light}`, `#${C.line}`, 10, 1);
  b += svgText(600, 597, "当前工程策略：激光数据缺失、前方距离 < 0.45 m、Edge 超时均优先输出零速度。", { size: 17, fill: `#${C.red}`, weight: 700, anchor: "middle" });
  figures.navigation = await writeFigure("fig17_navigation_and_safety_control", 1200, 690, figureTitle(b, "图 17  路径规划、局部控制与安全门", "高层目标经过全局/局部控制后仍需进入安全门；安全门拥有最终零速度优先权。"), "导航与安全控制");

  b = "";
  const fusion = [["温度", 80, C.orange], ["烟雾/气体", 310, C.cyan], ["视觉 fire/smoke", 540, C.blue]];
  fusion.forEach(([label, x, color]) => {
    b += rect(x, 170, 190, 100, "#FFFFFF", `#${color}`, 12, 2);
    b += svgText(x + 95, 228, label, { size: 20, fill: `#${color}`, weight: 700, anchor: "middle" });
    b += arrow(x + 190, 220, 760, 320, `#${color}`, 3);
  });
  b += rect(760, 260, 300, 120, `#${C.paleBlue}`, `#${C.blue}`, 14, 2);
  b += svgMultiline(910, 310, ["候选事件", "event_id + pose + timestamp"], { size: 19, fill: `#${C.blue}`, weight: 700, anchor: "middle", lineHeight: 32 });
  b += arrow(910, 380, 910, 454, `#${C.blue}`, 4);
  b += rect(690, 454, 440, 120, `#${C.paleGreen}`, `#${C.green}`, 14, 2);
  b += svgMultiline(910, 504, ["时空与证据融合", "7 帧窗口 / 5 帧命中 / 置信度 >= 0.75"], { size: 18, fill: `#${C.green}`, weight: 700, anchor: "middle", lineHeight: 30 });
  b += arrow(690, 514, 540, 514, `#${C.green}`, 3);
  b += rect(70, 454, 470, 120, `#${C.paleOrange}`, `#${C.orange}`, 14, 2);
  b += svgMultiline(305, 504, ["分级输出", "P1 预警 / P2 告警 / P3 视觉确认"], { size: 18, fill: `#${C.orange}`, weight: 700, anchor: "middle", lineHeight: 30 });
  b += rect(160, 622, 880, 44, `#${C.light}`, `#${C.line}`, 8, 1);
  b += svgText(600, 651, "注意：当前版本温度、烟雾、气体仍作为事件证据展示，不参与机器学习评分。", { size: 16, fill: `#${C.ink}`, anchor: "middle" });
  figures.fusion = await writeFigure("fig18_multisensor_fire_fusion", 1200, 730, figureTitle(b, "图 18  多源火情候选、视觉复核与分级输出", "采用“传感器触发 + 摄像头复核”策略，先保证可解释闭环，再逐步引入专用数据集模型。"), "多源火情融合");

  return figures;
}

function run(text, options = {}) {
  return new TextRun({
    text: String(text),
    font: options.font || "Microsoft YaHei",
    size: options.size || 22,
    bold: options.bold || false,
    color: options.color || C.ink,
    italics: options.italics || false,
  });
}

function para(text, options = {}) {
  const children = Array.isArray(text) ? text : [run(text, options)];
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: { before: options.before || 0, after: options.after || 120, line: options.line || 360 },
    indent: options.indent === false ? undefined : { firstLine: options.firstLine || 420 },
    children,
  });
}

function heading(text, level = 1, pageBreak = false) {
  const options = {
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 260 : 180, after: 160 },
    children: [run(text, { size: level === 1 ? 30 : level === 2 ? 25 : 22, bold: true, color: level === 1 ? C.navy : C.blue })],
  };
  if (pageBreak) options.pageBreakBefore = true;
  return new Paragraph(options);
}

function caption(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 180 }, children: [run(text, { size: 18, color: C.gray })] });
}

function imageParagraph(filePath, width, height, alt) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new ImageRun({
      type: path.extname(filePath).toLowerCase() === ".jpg" ? "jpg" : "png",
      data: fs.readFileSync(filePath),
      transformation: { width, height },
      altText: { title: alt, description: alt, name: alt },
    })],
  });
}

function figureParagraph(figure, width = 650) {
  const height = Math.round(width * figure.height / figure.width);
  return imageParagraph(figure.pngPath, width, height, figure.name);
}

function cell(content, width, options = {}) {
  const list = Array.isArray(content) ? content : [String(content)];
  const children = list.map((item) => {
    if (item instanceof Paragraph) return item;
    return new Paragraph({
      spacing: { before: 0, after: 0, line: 300 },
      children: [run(item, { size: options.size || 18, bold: options.header || false, color: options.color || C.ink })],
    });
  });
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    shading: { fill: options.fill || (options.header ? C.navy : C.white), type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children,
  });
}

function makeTable(headers, rows, widths, theme = C.blue) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: C.line };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const tableRows = [
    new TableRow({ children: headers.map((value, index) => cell(value, widths[index], { header: true, color: C.white })) }),
    ...rows.map((row) => new TableRow({ children: row.map((value, index) => cell(value, widths[index])) })),
  ];
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: tableRows,
  });
}

function bulletList(items) {
  return items.map((item) => new Paragraph({ numbering: { reference: "bulletList", level: 0 }, spacing: { after: 80, line: 330 }, children: [run(item, { size: 20 })] }));
}

function numberList(items, reference = "numberList") {
  return items.map((item) => new Paragraph({ numbering: { reference, level: 0 }, spacing: { after: 80, line: 330 }, children: [run(item, { size: 20 })] }));
}

function codeBlock(lines) {
  return lines.map((line) => new Paragraph({
    spacing: { before: 0, after: 0, line: 260 },
    shading: { fill: "F1F4F6", type: ShadingType.CLEAR },
    indent: { left: 240, right: 240 },
    children: [run(line, { size: 16, font: "Consolas", color: C.navy })],
  }));
}

function statusTable() {
  return makeTable(["状态等级", "含义", "本报告使用方式"], [
    ["已验证", "本轮在本机或已保存证据中有可复核输出", "可写为已完成，但注明时间、命令或证据来源"],
    ["部分验证", "软件闭环或单链路已验证，外部设备/现场条件未完整满足", "写清已验证边界，不外推为系统性能"],
    ["待现场验证", "依赖真实车辆、五板接线、自然事件、环境或设备签名", "列入验收清单，不写成已达标结论"],
  ], [1700, 3900, 3940], C.cyan);
}

async function build() {
  const figs = await makeFigures();
  const children = [];

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 260 }, children: [run("玄巡·星盾", { size: 48, bold: true, color: C.navy })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 }, children: [run("基于 MicroROS V2 与 HH-D02 星闪双链路的地下空间移动消防巡检系统", { size: 27, bold: true, color: C.blue })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 720 }, children: [run("项目技术文档（架构、实现、实验与验收版）", { size: 24, color: C.gray })] }));
  children.push(figureParagraph(figs.arch, 610));
  children.push(caption("封面图：项目端到端架构（项目绘制）"));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 430, after: 120 }, children: [run("文档版本：V1.0 · 2026 年 9 月 21 日", { size: 20, color: C.gray })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run("项目目录：D:\\table\\ros_car\\xuanxun-starshield", { size: 18, color: C.gray })] }));
  children.push(heading("摘要", 1, true));
  children.push(para("玄巡·星盾面向地下车库、设备间和管廊等 GPS 拒止、光照不稳定、通道狭窄的环境，构建一套以 MicroROS V2 轮式机器人为移动载体、以 Ubuntu ROS 2 主机为计算与安全控制中心、以五块 HH-D02 星闪板构成双链路告警通道、以 Windows Web 与鸿蒙原生 ArkUI 作为操作终端的移动消防巡检原型系统。系统重点解决固定传感器存在空间盲区、人工巡检难以持续、网络链路缺少可比证据以及 AI 控制缺少安全边界等问题。"));
  children.push(para("本版本的核心交付不是单一算法或单块硬件，而是一条可解释、可回放、可做对照实验的工程链：传感器触发火情候选事件，摄像头对候选事件进行复核，Edge 服务为事件分配统一 event_id，SLE 与 Wi-Fi 两路分别记录 t0、t2、ACK 和 retry，数字孪生以 SLAM 2D 地图叠加风险热区，Web/App 展示告警和安全操作，最终通过统一时间轴还原全部证据。玄巡认知任务智能体只把语音或文字转换为受控任务意图，ROS 2 负责速度限幅、激光避障、失联停车和急停锁存。"));
  children.push(para("截至本报告编制时，Edge 服务单元测试 55 项通过，Web 生产构建通过，五种星闪角色包已经构建并完成实体写入证据，Ubuntu 侧 /odom、/scan 与 /cmd_vel 原生控制桥有现场记录。自然双链路事件尚未完成板间 UART 跳线，因此正式 SLE/Wi-Fi 配对样本仍为 0；视觉模型为外部 ONNX 配置，鸿蒙 HAP 为未签名调试包。报告将已验证、部分验证和待现场验证严格分开。"));
  children.push(para([run("关键词：", { bold: true, color: C.navy }), run("移动消防巡检；MicroROS V2；ROS 2；HH-D02；星闪；双链路 A/B；数字孪生；视觉复核；认知任务智能体；鸿蒙 ArkUI", { color: C.ink })]));

  children.push(heading("文档控制与证据口径", 1, true));
  children.push(makeTable(["项目", "内容"], [
    ["项目名称", "玄巡·星盾——基于 MicroROS V2 与 HH-D02 星闪双链路的地下空间移动消防巡检系统"],
    ["文档用途", "立项汇报、技术答辩、后续开发、现场联调和验收记录的统一基线"],
    ["文档范围", "车端、五板星闪链路、Ubuntu ROS 2/Edge、Windows Web、鸿蒙 App、实验与部署"],
    ["不包含", "正式消防产品认证、真实消防值守授权、未提供的完整 BIM 三维模型、未采集的性能结论"],
    ["数据原则", "实测证据优先；模拟演示与自然事件分栏；动态 IP、端口和环境变量以现场回读为准"],
  ], [2200, 7340], C.navy));
  children.push(statusTable());
  children.push(para("图像说明：报告中的架构图、时序图、接线图、状态机和二维机器人图均为本项目绘制的说明性插图；Web 页面截图为本机启动后的实测截图；MicroROS V2 产品图为外部参考图，不冒充本项目实体照片。原始微信附件中的小车实物照片在当前工作区路径不可访问，因此本版未将其伪造或替换为不确定图片，后续可直接替换报告资源目录中的实物图位。", { color: C.red }));

  children.push(heading("目录", 1, true));
  children.push(new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" }));
  children.push(heading("1 项目概述", 1, true));
  children.push(heading("1.1 项目背景", 2));
  children.push(para("地下车库和管廊具有空间封闭、无线反射多、设备遮挡强、车辆类型复杂等特点。传统固定烟感或单点传感器能够提供局部阈值告警，但难以持续确认火源位置和现场可达性；人工巡检能够发现部分异常，却受到人员频次、视线和风险暴露的限制。移动机器人可以将传感器带到固定设备覆盖不到的位置，并把地图、视频、传感器和通信证据统一送达操作者。"));
  children.push(figureParagraph(figs.pain, 650));
  children.push(caption("图 1  地下空间消防巡检痛点与项目价值（项目绘制）"));
  children.push(heading("1.2 项目定位", 2));
  children.push(para("本项目定位为面向竞赛展示和工程原型验证的移动消防巡检系统，而不是已经完成消防认证的商用设备。系统首要验收目标是“发现—告警—定位—确认—回放”闭环；初期灭火执行机构可在后续阶段以受控模拟装置接入。软件架构围绕可复现、可解释和可对比展开，优先确保故障时停车和证据完整。"));
  children.push(makeTable(["目标层", "目标内容", "本版本边界"], [
    ["感知", "温度、烟雾/可燃气体、摄像头、激光雷达形成多源输入", "传感器真实型号和量程以现场接入记录为准；视觉权重不替代消防判定"],
    ["移动", "沿固定路线巡检，支持手动和任务式控制", "ROS 2 原生桥已实现；长距离自主导航需现场标定和重复测试"],
    ["通信", "SLE 与 Wi-Fi 双链路同源事件传输与严格 A/B", "协议和接收网关已实现；自然配对样本待 UART 跳线"],
    ["交互", "Windows Web + 鸿蒙原生 App", "Web 可启动实测；HAP 已构建但未配置正式签名"],
    ["智能", "视觉复核与认知任务智能体", "智能体只输出结构化任务，不直接输出速度流"],
  ], [1600, 3900, 4040], C.blue));
  children.push(heading("1.3 建设目标", 2));
  children.push(...numberList([
    "建立一台能在室内/地下环境运行的 MicroROS V2 移动机器人原型，接入摄像头、激光雷达、里程计和 IMU。",
    "使用五块 HH-D02 构建车端采样、SLE 传输、Wi-Fi 对照和中控接收角色，形成可追踪的同源事件链。",
    "实现 Edge 服务统一接入、风险热区、视觉复核、回放索引和安全控制仲裁。",
    "提供 Web 与鸿蒙移动端的告警确认、视频/证据查看、普通暂停和急停操作。",
    "通过严格 A/B 测试输出实测数据，区别演示指标、单链路验证和自然双链路正式样本。",
  ], "numberListGoals"));

  children.push(heading("2 项目现状与交付边界", 1, true));
  children.push(heading("2.1 当前软硬件组成", 2));
  children.push(figureParagraph(figs.boards, 650));
  children.push(caption("图 3  五块 HH-D02 星闪板角色与端口映射（项目绘制）"));
  children.push(makeTable(["层级", "组件", "当前状态", "证据/备注"], [
    ["车体", "MicroROS V2 小车、ESP32-S3 厂家固件", "已具备，固件非开源", "通过厂家配置工具设置 Agent、Domain；不修改底盘固件"],
    ["车端传感", "摄像头、激光雷达、温度/烟雾/气体传感器接口", "部分接入", "ROS 侧 /odom、/scan 有记录；摄像头地址曾不可达，传感器实物接线待复核"],
    ["星闪", "5 块 HH-D02，R-SENSE/R-SF/R-WIFI/C-SF/C-WIFI", "包构建与实体写入有证据", "LED 角色与启动身份部分已核验；自然事件链路待接线"],
    ["ROS 2", "Ubuntu 虚拟机、micro-ROS Agent、原生 HTTP 控制桥", "部分现场验证", "/odom 约 20 Hz；/scan 曾有真实消息；近障时安全零速度生效"],
    ["Edge", "FastAPI、串口网关、SafetyArbiter、TwinState、ReplayStore", "已实现", "55 项 pytest 通过；监听 8787"],
    ["Web", "React + TypeScript + Vite", "已实现并启动验证", "npm run build 通过；监听 5173"],
    ["鸿蒙", "原生 ArkUI、CoreSpeechKit、AudioKit、EdgeClient", "代码和 HAP 已构建", "未签名调试包；真实手机安装需签名与现场 API 地址"],
  ], [1300, 2600, 2000, 3640], C.navy));
  children.push(heading("2.2 五板身份与现场端口", 2));
  children.push(makeTable(["现场颜色", "角色", "当前枚举", "功能", "身份状态"], [
    ["绿色", "R-SENSE", "COM12", "采集/生成统一事件并向两路 UART 输出", "启动身份与绿色灯已记录"],
    ["红色", "R-SF", "COM13", "UART1 接收并通过 SLE 转发", "启动身份与红色灯已记录"],
    ["黄色", "C-SF", "COM14", "SLE 接收并通过 UART0 输出到 Edge", "SLE Server/配对日志已记录"],
    ["蓝色", "R-WIFI", "COM15", "UART2 接收并向局域网 UDP 广播", "STA 入网日志已记录"],
    ["品红", "C-WIFI", "COM16", "UDP 接收并通过 UART0 输出到 Edge", "写入成功；需补抓完整身份日志"],
  ], [1300, 1500, 1200, 3550, 1990], C.cyan));
  children.push(para("串口号是当前 Windows 枚举结果，不是固定硬件属性。USB 重插、系统重启和串口占用都会改变可用状态；文档和脚本应以端口标签、板卡颜色和启动身份行三者共同确认。"));
  children.push(heading("2.3 完成度矩阵", 2));
  children.push(makeTable(["能力", "已完成", "部分完成", "待现场验证"], [
    ["软件工程", "Edge API、Web 页面、ArkUI 页面、协议解析、回放索引", "视觉模型真实推理预处理/后处理", "无"],
    ["运动控制", "模式、任务、限速、前方阈值、失联停车、急停锁存", "固定路线与手动运动依赖真实 ROS 状态", "连续路线、避障和低速实车重复性"],
    ["星闪硬件", "五种角色包、构建、烧录记录、Wi-Fi 单帧主机接收", "C-WIFI 身份日志补齐", "UART1/UART2/GND 跳线后的自然同源事件"],
    ["A/B 实验", "配对算法、接口、Web 展示和统计规则", "单链路诊断样本", "自然配对样本与正式均值/P95"],
    ["火情识别", "VisionGate 7 帧/5 帧/0.75 单元逻辑、模拟视觉事件", "模型外部加载接口", "真实摄像头、专用数据集、现场误报率"],
  ], [1800, 3100, 2450, 3190], C.orange));

  children.push(heading("3 需求分析与安全边界", 1, true));
  children.push(heading("3.1 典型用户与使用场景", 2));
  children.push(makeTable(["角色", "关心的问题", "系统提供的能力"], [
    ["现场操作员", "能否快速确认、暂停、急停", "Web/App 告警、证据、普通暂停、急停锁存"],
    ["项目开发者", "链路在哪一层失败", "ROS 话题、串口网关、链路状态、日志和回放"],
    ["评委/验收人员", "创新是否可验证", "双链路严格 A/B、统一 event_id、时序指标和证据导出"],
    ["后续维护人员", "换设备是否需要重写系统", "协议模型、模式契约、设备角色和 API 分层"],
  ], [1900, 3600, 5040], C.blue));
  children.push(heading("3.2 功能需求", 2));
  children.push(makeTable(["编号", "需求", "验收口径"], [
    ["F-01", "多源传感器采样与事件生成", "事件包含 event_id、传感器值、时间戳和位置"],
    ["F-02", "SLE/Wi-Fi 同源传输", "两路中控接收帧可按 event_id 配对"],
    ["F-03", "ROS 2 运动控制", "所有运动经过安全仲裁，障碍/失联时零速度"],
    ["F-04", "传感器触发 + 摄像头复核", "视觉连续 7 帧至少 5 帧且置信度 >= 0.75 才确认 P3"],
    ["F-05", "数字孪生与回放", "地图、轨迹、热区、检测框、链路、操作共享时间轴"],
    ["F-06", "认知任务智能体模式", "语音/文本仅转换为 START/GO/RETURN/PAUSE/RESUME/STOP"],
    ["F-07", "移动安全端", "鸿蒙端显示告警和证据，可暂停/急停，不可解除急停或改规则"],
  ], [1000, 3700, 5840], C.cyan));
  children.push(heading("3.3 安全边界", 2));
  children.push(figureParagraph(figs.agent, 650));
  children.push(caption("图 8  玄巡认知任务智能体的安全执行链（项目绘制）"));
  children.push(makeTable(["安全项", "规则", "理由"], [
    ["AI 输出", "只能输出结构化 TaskPlan，不能输出线速度、角速度或急停动作", "避免云端模型绕过底盘安全控制"],
    ["急停", "急停按钮/接口置为 ESTOP_LATCHED，不能由 AI 或 App 解除", "解除动作必须由现场授权流程完成"],
    ["避障", "前方距离小于 0.45 m 或激光失效时输出零速度", "减少摄像头遮挡、近距回波或数据中断导致的撞击风险"],
    ["失联", "Edge/ROS 桥超过约 2 s 无有效状态时停车", "通信故障不能转化为持续运动"],
    ["火警播报", "P3/急停使用本地固定提示，不依赖 LLM", "告警链路必须在云端不可用时仍可提示"],
  ], [1600, 4800, 4140], C.red));

  children.push(heading("4 总体系统架构", 1, true));
  children.push(figureParagraph(figs.arch, 650));
  children.push(caption("图 2  玄巡·星盾端到端总体架构（项目绘制）"));
  children.push(heading("4.1 部署拓扑", 2));
  children.push(makeTable(["节点", "运行内容", "网络接口", "部署说明"], [
    ["MicroROS V2 小车", "ESP32-S3 固件、底盘、传感器、摄像头", "Wi-Fi / micro-ROS UDP", "厂家固件不改源，Agent 目标通过配置工具设置"],
    ["HH-D02 车端板", "R-SENSE、R-SF、R-WIFI", "板间 UART、SLE、Wi-Fi", "绿色板生成同源事件；红/蓝板承担两路发送"],
    ["Windows 中控", "Edge、Web、五板 USB 串口网关", "8787、5173、COM14/COM16", "运行启动 bat；IP 由 DHCP 决定"],
    ["Ubuntu ROS 2 主机", "micro-ROS Agent、bringup、原生控制桥", "8090、HTTP Edge API、ROS Domain 40", "通过 HTTP 命令队列与 Windows Edge 协同"],
    ["鸿蒙手机/平板", "原生 ArkUI App、ASR/TTS、告警操作", "同一现场 LAN 访问 Edge/Web", "需签名安装，权限需用户授权"],
  ], [1900, 3300, 2300, 3040], C.navy));
  children.push(heading("4.2 网络与地址策略", 2));
  children.push(para("Windows、Ubuntu ROS 2 主机、鸿蒙设备和小车必须处于同一现场局域网，但本项目不把 DHCP 地址固化为产品配置。启动前使用 Windows 的 Get-NetIPAddress、Ubuntu 的 ip -brief addr 和设备配置回读确认真实地址，并把 Ubuntu 桥的 XUANXUN_EDGE_URL 指向当前 Windows 地址。"));
  children.push(makeTable(["链路", "默认端口/域", "用途", "动态项"], [
    ["micro-ROS", "UDP 8090 / ROS_DOMAIN_ID=40", "ESP32-S3 与 Ubuntu Agent", "Ubuntu VM IP 会随 DHCP 变化"],
    ["Edge API", "TCP 8787", "REST、WebSocket、ROS HTTP 桥", "Windows WLAN IP"],
    ["Web", "TCP 5173", "浏览器控制台", "Vite 监听 0.0.0.0；LAN 地址动态"],
    ["Wi-Fi 对照", "UDP 6789 广播", "R-WIFI 到 C-WIFI", "广播地址按现场子网计算/构建参数注入"],
    ["ROS", "Domain 40", "话题发现与 QoS", "与车端配置保持一致"],
  ], [1800, 2500, 3300, 2940], C.blue));

  children.push(heading("5 硬件与双链路通信设计", 1, true));
  children.push(heading("5.1 机器人结构与传感器布局", 2));
  children.push(figureParagraph(figs.robot, 650));
  children.push(caption("图 10  小车二维结构与激光扫描面诊断示意（项目绘制，非加工图纸）"));
  children.push(para("车端是现有 MicroROS V2 轮式小车，具备摄像头和激光雷达。项目软件将摄像头作为视觉复核输入，将激光雷达作为运动安全与地图输入，将底盘的 /odom、/imu 等作为位姿估计输入。现场曾出现页面前方距离约 0.12 m 的状态，该值恰好接近雷达 range_min；因此必须在 /scan Publisher count、消息时间戳和实际扫描面三者同时成立时才把它解释为真实障碍。"));
  children.push(heading("5.2 HH-D02 角色固件", 2));
  children.push(makeTable(["角色", "输入", "处理", "输出", "板载灯"], [
    ["R-SENSE", "温度/烟雾/气体或模拟触发", "采样、阈值判断、生成 event_id、CRC 帧", "UART1 + UART2 同源 JSON 帧", "绿色"],
    ["R-SF", "UART1", "帧校验、SLE 发送", "SLE 链路", "红色"],
    ["C-SF", "SLE", "接收、输出主机串口", "COM14 -> Edge", "黄色"],
    ["R-WIFI", "UART2", "STA 入网、UDP 广播", "Redmi K70/现场 LAN", "蓝色"],
    ["C-WIFI", "UDP 广播", "接收、输出主机串口", "COM16 -> Edge", "品红"],
  ], [1500, 2200, 3200, 2200, 1440], C.orange));
  children.push(heading("5.3 接线与电气约束", 2));
  children.push(figureParagraph(figs.wiring, 650));
  children.push(caption("图 4  两路事件传输的 UART 接线约束（项目绘制）"));
  children.push(...bulletList([
    "绿色 R-SENSE GPIO15/UART1_TX 接红色 R-SF GPIO16/UART1_RX。",
    "绿色 R-SENSE GPIO8/UART2_TX 接蓝色 R-WIFI GPIO7/UART2_RX。",
    "两组信号必须共地；五块板分别 USB 供电，不连接两板 5V，避免电源反灌。",
    "正式测试前停止 Edge 对应串口占用，按颜色和角色复位，观察启动身份行后再接入事件链路。",
  ]));
  children.push(heading("5.4 协议帧", 2));
  children.push(para("StarShield 主机协议采用固定帧头 FA CE、版本号、标志位、little-endian payload_len、UTF-8 JSON payload 和 CRC16-CCITT-FALSE。主机侧已经覆盖字段保留、转义 JSON、长度限制、分片重组、CRC 和版本校验。统一事件字段包含 event_id、device_time_ms、sensor_values、pose、trigger_bits 和 transport metadata。"));
  children.push(...codeBlock([
    "FA CE | version:u8 | flags:u8 | payload_len:le16 | JSON payload | CRC16:le16",
    "{event_id, device_time_ms, sensor_values, trigger_bits, pose, source_role}",
  ]));

  children.push(heading("6 软件系统设计", 1, true));
  children.push(figureParagraph(figs.software, 650));
  children.push(caption("图 6  软件分层与安全依赖方向（项目绘制）"));
  children.push(heading("6.1 Edge 服务模块", 2));
  children.push(makeTable(["模块", "职责", "关键行为", "持久化/接口"], [
    ["app.py", "FastAPI 生命周期、路由和广播", "统一挂载串口、ROS、WebSocket、控制与实验接口", "REST /ws"],
    ["serial_gateway", "COM14/COM16 帧接收", "解析、CRC、分片、统计坏帧和在线状态", "/api/v1/transport/status"],
    ["control + safety_controller", "四模式与安全仲裁", "任务解析、速度限幅、障碍停车、急停锁存", "/api/v1/control/*"],
    ["ros_adapter / ros_bridge", "ROS 2 数据和命令适配", "读取 /odom、/scan，发送结构化任务/速度", "/api/v1/ros/*"],
    ["vision_worker", "ONNX 外部模型适配", "模型不可用时 VISION_FAULT，不生成视觉 P3", "/api/v1/vision/status"],
    ["twin_state", "2.5D 状态与热区", "维护位姿、轨迹、风险区、热区和链路状态", "/api/v1/digital-twin/snapshot"],
    ["replay_store", "证据持久化", "SQLite 索引 + JSONL 原始帧，支持按事件回放", "/api/v1/events/*"],
  ], [1800, 2800, 3200, 2700], C.navy));
  children.push(heading("6.2 视觉确认门控", 2));
  children.push(para("视觉模块采用可替换的 ONNX Runtime CPU 适配层，模型路径由 VISION_MODEL_PATH 外部配置，权重不提交仓库。对 fire/smoke 检测结果按 label 建立 7 帧滑动窗口，只有至少 5 帧置信度不低于 0.75 才产生视觉确认。重复 frame_id 不重复计入；模型文件缺失或推理异常时记录故障并禁止视觉 P3。"));
  children.push(figureParagraph(figs.eventFlow, 650));
  children.push(caption("图 7  多源火情事件的数据流与证据闭环（项目绘制）"));
  children.push(heading("6.3 数字孪生与风险热区", 2));
  children.push(figureParagraph(figs.twin, 650));
  children.push(caption("图 11  2.5D 时空数字孪生与风险热区（项目绘制）"));
  children.push(para("热区不是完整 BIM 或三维物理仿真，而是对真实 SLAM 2D 地图的可解释浮层。事件按 P1/P2/P3 使用 0.35/0.65/1.0 权重，视觉置信度参与权重，空间影响半径默认 1.5 m，时间半衰期默认 300 s。手工风险区按低/中/高使用 0.2/0.5/0.8。"));
  children.push(heading("6.4 回放与数据模型", 2));
  children.push(figureParagraph(figs.replay, 650));
  children.push(caption("图 12  统一时间轴证据回放模型（项目绘制）"));
  children.push(makeTable(["对象", "核心字段", "用途"], [
    ["VisionDetection", "event_id、frame_id、label、confidence、bbox、model_version、timestamp", "记录视觉框和模型版本"],
    ["TwinSnapshot", "map_version、robot_pose、trail、risk_zones、heat_points、active_alerts、link_status", "驱动数字孪生实时页面"],
    ["ReplayFrame", "timestamp、pose、sensor_values、vision_detections、heat_points、transport_samples、safety_state", "按统一时间轴还原事件"],
    ["TransportSample", "transport、t0、t2、ACK、retry、event_id", "A/B 配对与延迟统计"],
  ], [1900, 5200, 3400], C.cyan));

  children.push(heading("7 移动机器人基础能力与算法链路", 1, true));
  children.push(para("玄巡·星盾不是把“扫图、避障、导航”当作一个黑盒按钮，而是把它们拆成传感器输入、时间与坐标一致性、状态估计、地图构建、定位、路径规划、局部控制和安全门八个可诊断环节。任何环节出现异常，系统都应能够回答三个问题：数据从哪里来、当前算法输出是什么、为什么最终允许或禁止运动。"));

  children.push(heading("7.1 MicroROS V2 与 ROS 2 数据平面", 2));
  children.push(para("车端 ESP32-S3 运行厂家提供的 MicroROS V2 固件，负责底盘执行、基础传感器发布和 Wi-Fi 网络接入；Ubuntu 主机运行 micro-ROS Agent，将车端会话接入 ROS 2 图。micro-ROS 端不承担复杂 SLAM 或大模型推理，主机侧可以使用 rclpy、TF2、Nav2、RViz2 和 rosbag2 等工具完成计算与复现。"));
  children.push(para("在本项目中，Edge 不直接假设底盘固件内部实现，而通过 ROS 2 标准消息和 Ubuntu 原生控制桥工作。Windows Edge 把高层命令放入带 sequence 的 HTTP 命令队列，Ubuntu 桥按游标消费命令并将 ROS 遥测回传；这样可以把 Web/App 的网络抖动与车端 ROS 话题隔离。"));
  children.push(figureParagraph(figs.tfQos, 650));
  children.push(caption("图 16  TF2 坐标树与 ROS 2 QoS 契约（项目绘制）"));
  children.push(makeTable(["话题/接口", "消息或语义", "当前使用方式", "故障表现"], [
    ["/scan", "sensor_msgs/LaserScan", "桥使用 sensor_data QoS，提取前方扇区最小有效距离", "无 publisher、时间戳停止或安装遮挡会触发保守停车"],
    ["/odom", "nav_msgs/Odometry", "提取 x/y 与四元数 yaw，回传 Edge 更新位姿", "位姿不更新，固定路线无法闭环"],
    ["/imu", "传感器姿态/角速度", "参与状态估计和方向诊断", "yaw 漂移、坐标方向错误或融合不稳定"],
    ["/cmd_vel", "geometry_msgs/Twist", "安全桥最终发布速度，短时脉冲自动失效", "QoS 不匹配或桥失联时必须归零"],
    ["/camera/image_raw", "sensor_msgs/Image", "进入视觉复核/ONNX 适配层", "模型无输入或只显示 VISION_FAULT"],
    ["/xuanxun/task", "结构化任务 JSON", "高层任务交给 ROS 侧任务执行器", "任务不能被解释为速度流"],
  ], [1900, 2500, 3900, 2400], C.blue));
  children.push(...codeBlock([
    "micro_ros_agent udp4 --port 8090",
    "ros2 topic list",
    "ros2 topic hz /odom",
    "ros2 topic echo /scan --qos-reliability best_effort --qos-durability volatile --once",
  ]));

  children.push(heading("7.2 URDF、TF2 与传感器坐标系", 2));
  children.push(para("建图和避障的前提不是“雷达能发数据”，而是每一束激光都能被正确解释到机器人坐标系。系统至少需要保持 map、odom、base_footprint、base_link、laser_frame、camera_link 和 imu_link 之间的变换关系稳定。map 表示全局地图，odom 表示连续但可能漂移的里程计坐标，base_link 表示车体，laser_frame 和 camera_link 表示传感器安装坐标。"));
  children.push(makeTable(["坐标系", "语义", "来源/责任", "检查方法"], [
    ["map", "全局地图坐标", "SLAM 或定位节点", "RViz Fixed Frame、地图原点和方向"],
    ["odom", "连续局部里程计坐标", "底盘/状态估计", "原地旋转、直线漂移、时间戳"],
    ["base_footprint", "二维运动投影", "机器人模型", "z 轴归零、底盘接触面"],
    ["base_link", "车体三维中心", "URDF/Xacro", "车体朝向与实际前进方向"],
    ["laser_frame", "激光雷达原点与扫描平面", "安装标定", "雷达前方是否与 +x 一致"],
    ["camera_link", "相机光学/机械坐标", "相机驱动与标定", "图像方向、内参和外参"],
  ], [1900, 2700, 2900, 3200], C.cyan));
  children.push(para("现场“前方距离 0.12 m”不能单独证明雷达被遮挡。必须同时检查 `/scan` 的 publisher 数量、LaserScan 的 range_min/range_max、有效束数量、frame_id、雷达安装高度和相机支架是否进入水平扫描面。图 10 的扫描扇区用于解释排查假设，不替代实测。"));

  children.push(heading("7.3 里程计、IMU 与状态估计", 2));
  children.push(para("移动机器人需要同时面对轮速积分漂移、IMU 噪声和短时通信抖动。底盘提供的 /odom 适合表达连续局部运动，但长时间运行会积累误差；IMU 能改善短时角速度和姿态变化，但存在偏置和磁/振动干扰。工程上通过 robot_localization 的 EKF 或等效状态估计节点，把不同频率、不同噪声模型的数据变换到统一时间轴。"));
  children.push(...codeBlock([
    "状态向量示意：x = [px, py, yaw, vx, vy, wz, ...]^T",
    "预测：x(k|k-1) = f(x(k-1), u(k), dt)",
    "校正：x(k) = x(k|k-1) + K(k) [z(k) - h(x(k|k-1))]",
  ]));
  children.push(makeTable(["检查项", "正常表现", "异常表现", "当前工程动作"], [
    ["时间戳", "单调递增，与 ROS time/设备时间可解释", "倒退、跳变、长期不更新", "记录 header.stamp，先排时间同步"],
    ["直线运动", "x/y 连续、左右轮方向一致", "横向漂移、前进方向反了", "核对 base_link 与 odom 方向"],
    ["原地旋转", "yaw 变化连续，角速度符号正确", "角度跳变、累积漂移过大", "检查 IMU yaw 与底盘编码器"],
    ["融合输出", "odom->base_footprint 稳定", "TF 断裂或多个节点争夺同一变换", "保留唯一发布者并检查 TF tree"],
  ], [1900, 3000, 2600, 3200], C.orange));

  children.push(heading("7.4 激光建图：从扫描到栅格地图", 2));
  children.push(para("“扫图”在本项目中指基于 LaserScan、里程计和 TF 的二维 SLAM 建图，而不是简单地把激光点画在网页上。每一帧扫描都带有角度范围、角度增量、最小/最大量程和时间戳；SLAM 后端先根据 odom 给出运动先验，再通过扫描匹配修正位姿，并把障碍占据概率写入栅格地图。"));
  children.push(...numberList([
    "基础检查：确认 /scan、/odom、TF、传感器 QoS 和时间戳持续更新；确认雷达前方与 base_link +x 一致。",
    "空旷区测试：让小车低速直行和原地旋转，观察扫描轮廓是否连续，排除支架、线束和车体自反射。",
    "建图采集：沿外圈和关键通道缓慢行驶，尽量形成闭环，避免在玻璃、反光金属和动态车辆旁快速转弯。",
    "闭环检查：观察墙体是否重合、走廊是否变宽、立柱是否重复、起点回到终点时地图是否错位。",
    "固化版本：保存 map.yaml、栅格图、地图原点、分辨率、采集日期、ROS 参数和车辆安装状态。",
    "定位复用：加载已保存地图后，先用 RViz 设定初始位姿，再验证 AMCL/SLAM 定位和局部避障。",
  ], "numberListMapping"));
  children.push(figureParagraph(figs.mapping, 650));
  children.push(caption("图 15  小车建图、定位与导航的完整技术流水线（项目绘制）"));
  children.push(makeTable(["质量维度", "检查内容", "建议记录"], [
    ["几何一致性", "墙体连续、立柱不重复、闭环无明显错层", "闭环前后位置偏差、地图截图"],
    ["可导航性", "通道宽度、障碍膨胀和机器人 footprint 合理", "最窄通道、规划失败点"],
    ["时间一致性", "scan、odom、TF 时间戳关联正确", "topic hz、延迟、丢帧"],
    ["版本可复现", "地图与参数、车体安装状态绑定", "map_version、参数文件、日期"],
  ], [2100, 4300, 4300], C.green));

  children.push(heading("7.5 定位、全局规划与局部控制", 2));
  children.push(figureParagraph(figs.navigation, 650));
  children.push(caption("图 17  路径规划、局部控制与安全门（项目绘制）"));
  children.push(para("任务点或固定路线进入 ROS 2 后，不应直接变成速度指令。全局规划器根据地图和代价地图生成可行路径；局部控制器根据当前位置、目标航向和障碍距离计算短时控制量；安全门再检查激光是否新鲜、前方是否有障碍、Edge 是否在线、急停是否锁存，最终决定是否允许发布 /cmd_vel。"));
  children.push(makeTable(["控制层", "输入", "输出", "本项目边界"], [
    ["任务层", "TaskPlan、巡检点、HOME、固定路线", "目标点或路线段", "不生成连续速度"],
    ["全局规划", "map、目标点、footprint、代价地图", "全局路径", "可接 Nav2 或路线图后端"],
    ["局部控制", "odom、scan、局部路径", "Twist 候选值", "需要限速和丢失策略"],
    ["安全门", "scan 新鲜度、障碍距离、ROS/Edge 状态、急停", "/cmd_vel 或零速度", "零速度优先"],
    ["底盘执行", "厂家固件接收的 ROS 控制消息", "电机与 /odom", "固件源码不可修改"],
  ], [1900, 3600, 2700, 2500], C.red));
  children.push(para("当前桥接器保留一个确定性的 odom-frame 巡检控制器：根据当前位置到路线点的距离和航向误差生成候选速度；生产化阶段可以把该模块替换为 Nav2，不改变 Edge 的任务契约和安全状态接口。"));

  children.push(heading("7.6 激光避障与失联停车", 2));
  children.push(para("安全桥从 LaserScan 的前方角度窗口中选取有效量程最小值，忽略 NaN、无穷值和超出 range_min/range_max 的无效数据。当前工程阈值为 0.45 m：前方距离小于阈值时禁止前进；如果 /scan 超过约 1 s 未更新，视为传感器失效并停车；如果 Edge 超过约 2 s 未有有效状态，Ubuntu 桥进入失联降级并发送零速度。"));
  children.push(makeTable(["条件", "安全动作", "恢复条件"], [
    ["前方距离 < 0.45 m", "线速度置零，允许有限原地转向需由策略明确", "障碍距离恢复且模式仍有效"],
    ["/scan 无 publisher/超时", "零速度并上报 obstacle_blocked 或传感器故障", "/scan 持续更新并通过新鲜度检查"],
    ["Edge/HTTP 桥超时", "桥本地持续发布零速度", "通信恢复且命令游标重新对账"],
    ["ESTOP_LATCHED", "所有普通任务和手动速度拒绝", "现场授权解除流程，不由 App/AI 解除"],
  ], [2900, 4100, 3700], C.red));

  children.push(heading("7.7 摄像头输入与视觉复核", 2));
  children.push(para("摄像头链路分为采集、传输、预处理、推理、后处理和决策门控。采集侧提供 image_raw，预处理负责颜色空间、缩放和归一化，ONNX Runtime CPU 执行 fire/smoke 检测，后处理把模型输出转换为类别、置信度和 bbox，VisionGate 再执行 7 帧/5 帧/0.75 的时间一致性确认。模型只提供证据，不绕过传感器候选事件和安全仲裁。"));
  children.push(figureParagraph(figs.fusion, 650));
  children.push(caption("图 18  多源火情候选、视觉复核与分级输出（项目绘制）"));
  children.push(makeTable(["阶段", "输入", "输出", "失败处理"], [
    ["采集", "camera/image_raw", "带时间戳的图像帧", "无帧则记录 camera fault"],
    ["推理", "图像张量、外部 ONNX 模型", "fire/smoke + confidence + bbox", "模型不存在或异常进入 VISION_FAULT"],
    ["门控", "连续检测帧", "视觉确认/未确认", "低置信度或命中不足不生成视觉 P3"],
    ["证据", "检测框、位姿、传感器值", "AlertEvent/ReplayFrame", "保留原始帧和模型版本"],
  ], [1600, 3600, 3100, 2400], C.blue));

  children.push(heading("7.8 基础能力验收指标", 2));
  children.push(makeTable(["指标", "采集方法", "当前工程口径", "不能直接宣称的内容"], [
    ["里程计频率", "ros2 topic hz /odom", "历史现场约 20 Hz", "不等于定位精度已达标"],
    ["IMU 频率", "ros2 topic hz /imu", "历史现场约 26 Hz", "需结合时间戳和噪声评估"],
    ["激光有效性", "publisher、range、有效束、时间戳", "曾有真实 /scan 记录，需按当前现场复核", "0.12 m 不自动等于真实障碍"],
    ["地图质量", "闭环、墙体、立柱、通道、可导航性", "需现场建立地图版本", "不能用示意地图代替现场地图"],
    ["控制安全", "障碍、断流、断网、急停重复测试", "阈值与停车逻辑已实现", "仍需实车重复测试"],
  ], [2000, 3600, 3300, 2400], C.orange));

  children.push(heading("7.9 基础故障诊断顺序", 2));
  children.push(makeTable(["现象", "第一检查点", "第二检查点", "不要直接做的事"], [
    ["小车不动", "ROS connected、急停、/cmd_vel publisher", "/scan 新鲜度、前方距离、命令游标", "不要先提高速度或关闭安全门"],
    ["页面距离 0.12 m", "/scan Publisher count 与时间戳", "range_min、安装面、相机支架遮挡", "不要把缓存值写成现场障碍"],
    ["地图扭曲", "TF tree、odom 方向、时间戳", "雷达外参、动态障碍、闭环路线", "不要先修改 SLAM 参数"],
    ["任务无反应", "当前模式是否为 CMA、HTTP 200/409", "TaskPlan、ROS 命令序列、桥回执", "不要让模型直接生成速度"],
    ["视觉不告警", "VISION_MODEL_PATH 和 image_raw", "7 帧命中、置信度、重复 frame_id", "不要降低阈值冒充识别率"],
  ], [2100, 3600, 3300, 2300], C.navy));

  children.push(heading("8 四种运行模式与认知任务智能体", 1, true));
  children.push(figureParagraph(figs.modes, 650));
  children.push(caption("图 9  四种运行模式与安全状态机（项目绘制）"));
  children.push(heading("8.1 固定循迹 + 激光避障", 2));
  children.push(para("固定循迹模式面向第一阶段现场演示：路线和巡检点由 ROS 2 侧定义，Edge 仅下发结构化任务，Ubuntu 控制桥订阅 /scan 和 /odom，按前方距离阈值输出安全速度。激光数据丢失时采取保守策略停车，不能由视觉或语言模型绕开。"));
  children.push(heading("8.2 Web/App 手动控制", 2));
  children.push(para("手动控制只在 MANUAL 模式开放，前端方向按钮产生短时速度脉冲，后端再次限幅并检查 ROS 连接、急停锁存和障碍距离。普通暂停执行零速度脉冲后进入 PAUSED；急停进入 ESTOP_LATCHED，移动端不能解除。"));
  children.push(heading("8.3 认知任务智能体模式", 2));
  children.push(para("玄巡认知任务智能体（Cognitive Mission Agent，CMA）接收“去巡检点、开始巡检、暂停、返回起点”等语音或文字。Edge 先执行本地中文规则解析，无法识别时才调用 DeepSeek；模型返回必须符合 TaskPlan 枚举契约。密钥只从进程环境变量读取，不写入源代码、前端、鸿蒙包或报告。该名称强调它是任务编排与意图理解模块，而不是直接控制底盘的聊天机器人。"));
  children.push(figureParagraph(figs.agent, 650));
  children.push(caption("图 8  玄巡认知任务智能体的安全执行链（项目绘制）"));
  children.push(makeTable(["意图", "示例输入", "执行结果", "限制"], [
    ["START_PATROL", "开始巡检", "选择固定路线并提交 ROS 任务", "不能直接指定连续速度"],
    ["GO_TO_PATROL_POINT", "去 B 区巡检点", "转成目标点任务", "点位必须在配置/地图范围内"],
    ["RETURN_HOME", "返回起点", "提交 HOME 目标", "遇障碍仍由安全层停车"],
    ["PAUSE / RESUME", "暂停 / 继续", "切换安全状态", "急停不等于普通暂停"],
    ["STOP", "结束任务", "停止当前任务并置零速度", "不能解除急停锁存"],
  ], [1900, 2900, 3300, 2400], C.orange));
  children.push(heading("8.4 语音输入与输出", 2));
  children.push(para("Web 使用浏览器 SpeechRecognition（可用时）和 speechSynthesis；鸿蒙 App 使用 CoreSpeechKit 语音识别、AudioKit 麦克风采集与系统 TTS。火情、急停和普通暂停的固定播报不调用大模型，保证安全提示不受网络模型延迟影响。"));

  children.push(heading("9 Web 控制台与鸿蒙 App", 1, true));
  children.push(heading("9.1 Web 控制台功能", 2));
  children.push(makeTable(["页面", "展示/操作", "当前证据"], [
    ["总览/演示", "KPI、地图、风险热区、链路摘要、P2/视觉 P3 演示", "本次本机启动截图"],
    ["任务驾驶台", "固定循迹、手动、认知任务智能体、文字/语音任务、暂停、急停", "本次本机启动截图；ROS 是否在线随环境"],
    ["数字孪生", "2.5D SLAM 图层、轨迹、手工区、动态热区", "本次本机启动截图"],
    ["链路实验", "同一 event_id 配对、均值/P95、SLE/Wi-Fi 胜出", "当前页面真实显示配对事件 0"],
    ["证据回放", "地图、视觉、传感器、链路、操作统一时间轴", "接口和页面已实现，现场数据待补齐"],
    ["视觉诊断", "模型状态、7 帧窗口、模拟视觉 P3", "当前模型未配置时显示 VISION_MODEL_PATH 未配置"],
  ], [1800, 4900, 3800], C.blue));
  children.push(heading("9.2 本次启动截图", 2));
  const screenshotRows = [
    ["web-overview-live.png", "系统总览", "实测截图：Edge 在线，五板串口当前显示 0/5"],
    ["web-overview-alert-live.png", "告警演示", "实测截图：触发 P2 演示后地图和告警带更新"],
    ["web-control-live.png", "任务驾驶台", "实测截图：固定循迹卡片、认知任务智能体输入和安全状态"],
    ["web-twin-live.png", "数字孪生", "实测截图：2.5D 地图与 B 区热区"],
    ["web-ab-live.png", "链路实验", "实测截图：配对样本为 0，未伪造统计结果"],
    ["web-vision-live.png", "视觉诊断", "实测截图：7 帧门控与模型未配置状态"],
  ];
  for (const [file, title, note] of screenshotRows) {
    const p = path.join(ASSETS, file);
    if (fs.existsSync(p)) {
      children.push(imageParagraph(p, 640, 388, title));
      children.push(caption(`${title}：${note}`));
    }
  }
  children.push(heading("9.3 鸿蒙 App 权限与操作边界", 2));
  children.push(para("鸿蒙端不复制完整数字孪生页面，而聚焦移动安全操作：当前 P3 视觉告警、截图与置信度、简化位置、模型状态、告警证据时间、普通暂停和急停锁存。App 不解除急停、不修改模型阈值、不启动实验、不修改风险区和告警规则。真实设备运行需要 DevEco Studio 项目签名和与现场 Edge 地址一致的配对配置。"));
  const mobileShot = path.join(ASSETS, "web-mobile-history.png");
  if (fs.existsSync(mobileShot)) {
    children.push(imageParagraph(mobileShot, 440, 360, "历史移动端截图"));
    children.push(caption("移动端/历史操作截图：仅作为已有界面证据，正式鸿蒙真机验收需补充设备截图。"));
  }

  children.push(heading("10 正式 SLE/Wi-Fi A/B 实验", 1, true));
  children.push(figureParagraph(figs.sequence, 650));
  children.push(caption("图 5  SLE/Wi-Fi 双链路事件时序与正式配对规则（项目绘制）"));
  children.push(figureParagraph(figs.ab, 650));
  children.push(caption("图 13  严格 SLE/Wi-Fi A/B 实验流程（项目绘制）"));
  children.push(heading("10.1 实验变量与测量点", 2));
  children.push(makeTable(["字段", "定义", "采集位置"], [
    ["event_id", "同一传感器事件的全局关联键", "R-SENSE 生成，C-SF/C-WIFI 保留"],
    ["t0", "车端生成/发送时间", "payload 中 device_time_ms 或车端发送记录"],
    ["t2", "中控 Edge 收到完整帧时间", "串口网关/UDP 接收时钟"],
    ["ACK", "中控确认或应用层回执", "C-SF/C-WIFI 与 Edge 日志"],
    ["retry", "重传次数", "传输样本字段和链路固件计数"],
    ["paired", "SLE 与 Wi-Fi 均有相同 event_id", "Edge transport_experiment 汇总"],
  ], [1900, 4700, 3940], C.orange));
  children.push(heading("10.2 实验方法", 2));
  children.push(...numberList([
    "停止可能占用 COM14/COM16 的旧 Edge 实例，确认黄色 C-SF、品红 C-WIFI 的在线状态。",
    "确认绿色 R-SENSE 到红色 R-SF 的 UART1 TX/RX/GND，以及绿色 R-SENSE 到蓝色 R-WIFI 的 UART2 TX/RX/GND。",
    "分别复位 C-SF、R-SF、R-WIFI、C-WIFI，再复位 R-SENSE，记录启动身份、LED 颜色、时间和网络地址。",
    "使用真实温度/烟雾/气体变化或受控模拟输入触发 N 个事件，确保同一事件从 R-SENSE 同时发往两路。",
    "导出 transport samples，按 event_id 配对，计算 SLE/Wi-Fi 到达差值的均值、P95、最大值、丢失率和重试率。",
    "重复至少三轮不同空间位置/干扰条件，并保留原始 JSONL、SQLite、终端日志和现场视频。",
  ], "numberListExperiment"));
  children.push(heading("10.3 当前结果与禁止结论", 2));
  children.push(makeTable(["项目", "当前状态", "解释"], [
    ["正式配对事件", "0", "Web 页面和 API 已真实显示 0；自然同源事件待接线"],
    ["SLE/Wi-Fi P95", "未形成正式统计值", "页面中的演示摘要不能替代现场 paired 样本"],
    ["Wi-Fi 单帧接收", "已通过主机广播帧验证", "只能证明 C-WIFI 接收路径，不等于自然车端事件"],
    ["SLE 配对", "曾有 C-SF SLE server/配对日志", "尚未与 R-SENSE 同源事件进入 Edge 配对统计"],
  ], [2500, 2400, 5640], C.red));

  children.push(heading("11 项目启动与部署", 1, true));
  children.push(heading("11.1 Windows 一键启动", 2));
  children.push(...codeBlock([
    "cd /d D:\\table\\ros_car\\xuanxun-starshield",
    "start_xuanxun_starshield.bat",
    "浏览器： http://127.0.0.1:5173",
    "局域网： http://<Windows-WLAN-IP>:5173",
    "Edge：   http://127.0.0.1:8787",
  ]));
  children.push(para("启动脚本动态读取 Windows IPv4，不把当前 DHCP 地址写死；DeepSeek 配置从用户环境变量读取。报告、代码和前端均不保存密钥。正式交付前应轮换已在聊天中暴露过的密钥。" , { color: C.red }));
  children.push(heading("11.2 Ubuntu ROS 2 侧", 2));
  children.push(...codeBlock([
    "source /opt/ros/humble/setup.bash",
    "export ROS_DOMAIN_ID=40",
    "export CAR_TYPE=no_ptz   # 以实际车型配置为准",
    "ros2 run micro_ros_agent micro_ros_agent udp4 --port 8090",
    "python3 /home/yahboom/ros_control_bridge.py",
    "ros2 topic list",
    "ros2 topic hz /odom",
    "ros2 topic echo /scan --qos-reliability best_effort --qos-durability volatile --once",
  ]));
  children.push(heading("11.3 启动前检查", 2));
  children.push(makeTable(["检查层", "命令/动作", "通过条件"], [
    ["网络", "Windows Get-NetIPAddress；Ubuntu ip -brief addr", "Windows/Ubuntu/设备处于同一可达子网"],
    ["Edge", "Invoke-WebRequest http://127.0.0.1:8787/api/v1/health", "HTTP 200，service= xuanxun-fire-edge"],
    ["Web", "浏览器打开 5173", "页面加载且 WebSocket 不持续报错"],
    ["ROS", "ros2 topic list / hz", "/odom、/scan、/imu 等按现场配置出现"],
    ["雷达", "检查 Publisher count、时间戳和安装面", "数据持续且不被支架遮挡"],
    ["星闪", "按颜色复位并查看启动身份行", "角色、LED、串口和网络与表格一致"],
    ["安全", "低速、障碍、暂停、急停", "近障和失联时零速度；急停保持锁存"],
  ], [1800, 4700, 4040], C.navy));
  children.push(heading("11.4 现有启动截图与图源说明", 2));
  const ref = path.join(ASSETS, "microros-v2-reference.png");
  if (fs.existsSync(ref)) {
    children.push(imageParagraph(ref, 640, 354, "MicroROS V2 外部参考图"));
    children.push(caption("外部参考图：MicroROS V2 Robot 产品展示图；仅用于说明原始小车平台形态，不代表本项目当前实物装配。"));
  }
  children.push(para([run("图源说明：", { bold: true, color: C.navy }), run("本项目绘制图由 docs/report_assets/*.svg 生成；Web 截图由本机 http://127.0.0.1:5173 在 2026-09-21 启动后保存；外部产品参考图来自工作区已有资料。用户提及的 figmeme.app 可用于后续生成论文风格配图，本版优先使用可复现的本地 SVG，避免外部服务状态影响报告重建。", { color: C.ink })]));
  children.push(para([run("Fig.meme：", { bold: true, color: C.navy }), new ExternalHyperlink({ children: [run("https://figmeme.app/", { color: C.blue, underline: true })], link: "https://figmeme.app/" })]));

  children.push(heading("12 测试、验收与证据", 1, true));
  children.push(figureParagraph(figs.accept, 650));
  children.push(caption("图 14  项目验收门与证据等级（项目绘制）"));
  children.push(heading("12.1 软件测试结果", 2));
  children.push(makeTable(["组件", "命令", "本轮结果", "说明"], [
    ["Edge service", "uv run pytest -q", "55 passed", "仅有既有 httpx/Starlette 弃用警告"],
    ["Web console", "npm run build", "构建成功", "TypeScript + Vite 生产构建通过"],
    ["Web runtime", "浏览器打开 127.0.0.1:5173", "HTTP 200", "总览、驾驶台、数字孪生、A/B、视觉诊断截图已保存"],
    ["鸿蒙 App", "Hvigor test / assembleHap", "历史 BUILD SUCCESSFUL", "本轮环境命令已执行；正式手机仍需签名和设备验证"],
    ["硬件固件", "五角色构建/烧录记录", "有证据", "第三轮包与 flash-summary 保存于星闪硬件代码/evidence"],
  ], [1800, 3400, 1900, 3440], C.green));
  children.push(heading("12.2 关键验收用例", 2));
  children.push(makeTable(["编号", "测试内容", "通过标准", "当前结论"], [
    ["TC-01", "7 帧中 5 帧置信度 >= 0.75", "确认一次视觉事件", "软件单元逻辑已覆盖"],
    ["TC-02", "重复 frame_id", "不重复生成事件", "软件单元逻辑已覆盖"],
    ["TC-03", "模型文件缺失/推理异常", "VISION_FAULT，不生成视觉 P3", "接口逻辑已覆盖；真实模型待接入"],
    ["TC-04", "ROS 未连接时手动/任务运动", "请求拒绝或安全停车", "Web/Edge 已验证"],
    ["TC-05", "前方距离小于 0.45 m", "持续零速度", "Ubuntu 原生桥有现场证据；需排除 range_min 假回波"],
    ["TC-06", "急停后普通 App 操作", "不能解除急停锁存", "软件逻辑已验证"],
    ["TC-07", "自然同源事件双路到达", "同一 event_id 形成 paired 样本", "待板间 UART 跳线"],
    ["TC-08", "统一时间轴回放", "地图/视觉/链路/操作同步", "接口实现；待真实多源数据"],
  ], [1100, 3600, 3300, 2540], C.orange));
  children.push(heading("12.3 证据文件索引", 2));
  children.push(makeTable(["路径/文件", "内容", "用途"], [
    ["docs/report_assets/web-*-live.png", "本次 Web 运行截图", "报告插图与界面验收"],
    ["edge-service/tests/", "Edge 11 个测试文件", "软件回归"],
    ["星闪硬件代码/evidence/flash-20260919-final/", "五板烧录日志和摘要", "实体固件写入"],
    ["evidence/xuanxun_bringup_probe.txt", "ROS bringup 话题探测", "ROS 侧历史运行证据"],
    ["docs/DEVELOPMENT_LOG.md", "分阶段工程记录", "状态、风险和现场复盘"],
    ["start_xuanxun_starshield.bat", "Windows Edge/Web 启动脚本", "现场启动入口"],
  ], [3200, 3600, 3740], C.cyan));

  children.push(heading("13 风险、限制与后续计划", 1, true));
  children.push(heading("13.1 当前风险", 2));
  children.push(makeTable(["风险", "影响", "处理建议", "优先级"], [
    ["自然双链路事件未产生", "无法给出正式 SLE/Wi-Fi 对比结论", "完成 UART1/UART2/GND 跳线，重复自然事件并导出 paired 数据", "P0"],
    ["摄像头支架可能遮挡雷达", "虚假近距障碍或 SLAM 数据异常", "检查 /scan publisher、range_min、安装角度和支架扫描面", "P0"],
    ["视觉模型未配置", "真实视频不能进入推理闭环", "提供外部 ONNX 权重、固定预处理和后处理版本", "P1"],
    ["HAP 未签名", "无法直接作为正式真机安装包交付", "配置 DevEco signing profile，补真机截图", "P1"],
    ["DHCP/IP 变化", "ROS Agent、Edge 桥和手机访问地址失效", "启动前探测并回写配置，后续增加 preflight", "P1"],
    ["厂家底盘固件无源码", "无法深入修改底层电机和底盘安全", "保持 ROS 侧安全桥，运动指令统一限速和超时", "P1"],
  ], [2300, 3300, 3400, 1140], C.red));
  children.push(heading("13.2 分阶段路线", 2));
  children.push(makeTable(["阶段", "工作内容", "出口条件"], [
    ["S0 软件基线", "Edge/Web/App 构建、API、回放、控制安全", "软件测试和演示闭环稳定"],
    ["S1 五板自然链路", "接线、复位、角色/LED、同源事件", "C-SF/C-WIFI 收到相同 event_id"],
    ["S2 车辆闭环", "摄像头、雷达、/cmd_vel、固定路线、障碍停车", "低速实车重复通过 TC-04/05"],
    ["S3 视觉复核", "ONNX 模型、数据集、7 帧门控、误报场景", "受控场景 P3 与 VISION_FAULT 均可验证"],
    ["S4 严格 A/B", "多轮不同干扰条件，原始数据和统计", "正式报告包含 paired N、均值、P95、丢失和重试"],
    ["S5 展示交付", "鸿蒙签名、真机截图、视频、现场演示脚本", "Web + App + 机器人完整演示"],
  ], [1600, 4800, 3740], C.navy));
  children.push(heading("13.3 建议新增工具", 2));
  children.push(...bulletList([
    "preflight.ps1：检查 LAN IP、8787/5173、COM14/COM16、DeepSeek 环境变量、ROS Agent 地址和端口。",
    "starshield_wiring_check：读取或人工确认五板颜色、启动身份、UART 接线和 GND，共享一张验收表。",
    "ros_health_probe.py：持续输出 /odom、/scan、/imu、/cmd_vel 的频率、时间戳和 publisher 数量。",
    "event_replay_export.py：从 SQLite/JSONL 导出事件包、CSV 指标和一键回放索引。",
    "signed_demo_profile：将视觉模型路径、地图版本、点位、速度限值和测试网络做版本化。",
  ]));

  children.push(heading("14 结论", 1, true));
  children.push(para("玄巡·星盾已经形成一个有明确安全边界和实验口径的移动消防巡检原型：MicroROS V2 小车提供移动感知与 ROS 2 数据基础，五块 HH-D02 形成 SLE/Wi-Fi 双链路设计，Edge 将告警、视觉、孪生、回放和安全控制组织为统一服务，Windows Web 和鸿蒙 ArkUI 提供分层交互。项目的创新不止于“使用星闪和鸿蒙”，而在于把同一事件在两条链路上的传播过程变成可复核的测量对象，把视觉复核、风险热区和人工处置组织到同一时间轴，把 AI 限制在结构化任务规划而不是连续运动控制。"));
  children.push(para("当前软件基线和大部分硬件构建工作已有证据，但自然双链路配对、真实摄像头模型推理、持续运动与现场 A/B 仍需完成。后续开发应优先完成 R-SENSE 到 R-SF/R-WIFI 的 UART 跳线并采集自然 paired 事件，同时排查雷达扫描面和 /scan 实时性；在此基础上再补视觉模型和鸿蒙正式签名。只有经过这些现场出口条件，报告中的演示能力才可以升级为完整项目验收结论。"));

  children.push(heading("附录 A 主要接口", 1, true));
  children.push(makeTable(["接口", "方法", "用途"], [
    ["/api/v1/health", "GET", "Edge 健康检查"],
    ["/api/v1/control/state", "GET", "控制模式、安全状态、ROS 和障碍状态"],
    ["/api/v1/control/mode", "POST", "切换 FIXED_PATROL/MANUAL/LOBSTER_AI"],
    ["/api/v1/control/task", "POST", "提交文字/语音任务"],
    ["/api/v1/control/manual", "POST", "提交短时手动速度脉冲"],
    ["/api/v1/safety/pause", "POST", "普通暂停"],
    ["/api/v1/safety/estop", "POST", "急停锁存"],
    ["/api/v1/transport/status", "GET", "五板串口网关状态"],
    ["/api/v1/experiments/ab/summary", "GET", "严格 paired A/B 汇总"],
    ["/api/v1/digital-twin/snapshot", "GET", "2.5D 孪生快照"],
    ["/api/v1/events/{event_id}/replay", "GET", "事件回放帧"],
    ["/ws", "WebSocket", "control.state、alert.created、twin.snapshot、vision.detection 等"],
  ], [3600, 1500, 5040], C.blue));
  children.push(heading("附录 B 现场验收签字表", 1));
  children.push(makeTable(["项目", "记录", "结果/备注"], [
    ["时间与场地", "____________________________", "____________________________"],
    ["Windows WLAN IP", "____________________________", "____________________________"],
    ["Ubuntu ROS 2 IP", "____________________________", "____________________________"],
    ["五板颜色/端口", "绿色____ 红色____ 黄色____ 蓝色____ 品红____", "____________________________"],
    ["UART1/UART2/GND", "□ 已接  □ 未接", "____________________________"],
    ["/odom /scan /imu", "□ 持续  □ 异常", "____________________________"],
    ["双链路自然事件", "paired N = ______", "____________________________"],
    ["运动/避障/急停", "□ 通过  □ 待整改", "____________________________"],
    ["Web/App/视频", "□ 通过  □ 待整改", "____________________________"],
    ["验收人员", "____________________________", "日期：______________________"],
  ], [2800, 3300, 4040], C.cyan));

  const doc = new Document({
    creator: "玄巡·星盾项目组",
    title: "玄巡·星盾项目技术文档",
    subject: "MicroROS V2 与 HH-D02 星闪双链路地下空间移动消防巡检系统",
    description: "项目架构、实现、实验与验收文档",
    styles: {
      default: { document: { run: { font: "Microsoft YaHei", size: 22, color: C.ink }, paragraph: { spacing: { line: 360, after: 120 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Microsoft YaHei", size: 30, bold: true, color: C.navy }, paragraph: { spacing: { before: 280, after: 180 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Microsoft YaHei", size: 25, bold: true, color: C.blue }, paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Microsoft YaHei", size: 22, bold: true, color: C.cyan }, paragraph: { spacing: { before: 160, after: 120 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: "bulletList", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numberListGoals", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numberListExperiment", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numberListMapping", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: {
        page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } },
      },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run("玄巡·星盾 | 项目技术文档", { size: 15, color: C.gray })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("内部技术资料 · 第 ", { size: 15, color: C.gray }), new TextRun({ children: [PageNumber.CURRENT], font: "Microsoft YaHei", size: 15, color: C.gray })] })] }) },
      children,
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT, buffer);
  console.log(`WROTE ${OUT}`);
  console.log(`FIGURES ${Object.keys(figs).length}`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
