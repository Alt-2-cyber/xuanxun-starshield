# 协议目录

`event.schema.json` 是跨板端、Ubuntu、Web 和鸿蒙 App 共用的业务事件契约。

## 关键规则

- `event_id` 只由 R-SENSE 生成，任何传输重试和链路复制都必须保留原值。
- `sequence` 用于缺口检测、去重和补传。
- `device_time_ms` 是设备单调时钟；Ubuntu 另记 `receive_time_ns`。
- `level` 统一使用 `NORMAL/P1/P2/P3/CLEARED`。
- SLE 和 Wi-Fi 的 payload 必须一致，不能为了适配链路而改变业务字段。
- UART 外层帧使用 `0xFA 0xCE` magic 和 CRC16；具体 CRC 多项式在 S0 联调时冻结。
