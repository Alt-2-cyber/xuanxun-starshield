# 玄巡·星盾开发约束

## 目标

首版完成“传感器事件 -> 五板双链路 -> Ubuntu 边缘服务 -> Web/App 告警处置”的可回放闭环，并能用相同 `event_id` 做 SLE 与 Wi-Fi 的公平 A/B 对比。

## 已冻结的架构决策

| 领域 | 决策 |
| --- | --- |
| 设备 | 5 块 HH-D02，R-SENSE、R-SF、R-WIFI、C-SF、C-WIFI |
| 板端 | OpenHarmony/SDK 原生 C；AT 示例只用于冒烟验证 |
| 无线 | SLE 星闪和 Wi-Fi UDP 分板运行，不依赖单板双模并发 |
| 边缘 | Python FastAPI + WebSocket + rclpy + SQLite/JSONL |
| Web | React + TypeScript + Vite，白色专业控制台 |
| App | ArkTS + ArkUI Stage，移动安全端，不配置实验、不解除急停 |
| 控制 | 任务级控制；普通暂停和急停锁存分离 |
| 告警 | `NORMAL/P1/P2/P3/CLEARED` |

## 代码边界

- 板端不理解 ROS 2 地图和 Web 页面。
- Web/App 不重复实现告警规则。
- `event_id` 在 R-SENSE 生成，重传和跨链路复制不得改变。
- 所有危险控制必须带 `request_id`，由 edge service 做幂等和审计。
- SLE/Wi-Fi 无线延迟和 UART/业务端到端延迟分开统计。

## 第一阶段验收

- Edge service `/api/v1/health` 和 `/api/v1/system/snapshot` 可用。
- Web 总览可运行，能触发演示 P2、普通暂停和急停锁存的本地状态。
- 协议 schema 有效，Python 模型测试通过。
- HH-D02 固件目录和串口/无线适配边界明确，未把未确认的 PinMux 写死。
