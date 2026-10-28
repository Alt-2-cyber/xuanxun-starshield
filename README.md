# 智巡消防

## 基于 MicroROS V2 与 HH-D02 星闪双链路的地下空间移动消防巡检系统

本目录是项目的独立开发根目录。原始 MicroROS V2 资料和厂家固件保留在上级工作区，不在本项目内复制或修改。

## 当前软件（1.2.0）

APP 与 Web 使用统一的深石墨 / 青柠绿视觉系统，包含原创机器人空间示意、轻量 3D 视角、立体地图、清晰的风险色和自适应布局。本轮视觉规范及交付见 [界面视觉设计 1.2](docs/界面视觉设计_1.2.md)。

- `protocol/`：同源事件、传输样本和告警等级契约。
- `edge-service/`：FastAPI + WebSocket 边缘服务，汇总串口、ROS、事件证据、SQLite 历史、人工确认与控制仲裁。
- `web-console/`：React + TypeScript + Vite 消防巡检工作台，含态势、巡检、告警、任务控制、空间、视觉、回放、链路实验、区域和设备诊断十个页面，支持手机布局。
- `harmony-app/`：原生 HarmonyOS ArkTS / ArkUI 应用，含配对、告警、档案、证据回放和安全操作；新版 HAP 位于 `harmony-app/release/`。
- `board-firmware/`：五块 HH-D02 的 OpenHarmony/SDK 固件角色边界。
- `docs/`：开发约束、联调顺序和接口决策。

## 系统拓扑

```text
R-SENSE --UART1--> R-SF ---- SLE ----> C-SF --USB/UART--> Ubuntu
    |
    +----------UART2--> R-WIFI --- Wi-Fi UDP --> C-WIFI --USB/UART--> Ubuntu

MicroROS V2 ESP32-S3 --Wi-Fi/micro-ROS--> Ubuntu ROS 2
Ubuntu edge-service --REST/WebSocket--> Windows Web / HarmonyOS App
```

## 首次运行

### Edge service

```powershell
cd edge-service
uv sync --extra test
uv run fire-edge
```

服务默认监听 `http://127.0.0.1:8787`。

### Web console

```powershell
cd web-console
npm install
npm run dev
```

Web 默认地址为 `http://127.0.0.1:5173`，`/api` 与 `/ws` 默认代理到 `http://127.0.0.1:8787`。本机依赖已安装时也可使用根目录的 `start_xuanxun_starshield.bat`；该既有脚本会按其中的串口配置接入设备并监听局域网。

服务未连接时显示离线提示并禁用远程操作，不自动注入数据。“演示验证”会向当前服务写入明确标记的演示事件。边缘服务已连接与 ROS 机器人已连接分别显示。

如需代理到其他服务，在 `web-console` 启动前设置 `STARSHIELD_EDGE_URL`，或在“设备与连接”页面配置服务地址。生产静态托管需将 `/api`、`/ws` 反向代理至边缘服务；Vite 的开发 / 预览代理不会随静态文件自动部署。

## 验证与交付

- 网站：在 `web-console` 执行 `npm run build`，构建结果位于 `dist/`。
- 服务：在 `edge-service` 执行 `.venv\Scripts\python.exe -m pytest`。
- APP：[构建与验证说明](harmony-app/VALIDATION.md)。现有交付为 debug unsigned HAP，真机安装需要项目签名。
- 本轮功能、接口、截图和实际限制：[网站与 APP 重构交付说明](docs/网站与APP重构交付说明.md)。
