# HH-D02 固件分工

固件采用 OpenHarmony/SDK 原生 C。官方 AT 示例只用于 S0 冒烟测试，不作为最终业务实现。

| 目录 | 角色 | 首版职责 |
| --- | --- | --- |
| `r-sense` | 车端感知源 | 温度真实采集；烟雾/气体可插拔；生成 event_id；双 UART 输出 |
| `r-sf` | 车端星闪发送 | UART 输入；SLE 发送；重试与链路统计 |
| `r-wifi` | 车端 Wi-Fi 对照 | UART 输入；Wi-Fi STA + UDP 发送 |
| `c-sf` | 中控星闪接收 | SLE 接收；UART0 输出到 Ubuntu |
| `c-wifi` | 中控 Wi-Fi 接收 | Wi-Fi SoftAP + UDP Server；UART0 输出到 Ubuntu |

## S0 必做

- 用 UART demo 完成每块板的回环。
- 记录板卡序列、固件版本、UART 引脚和 PinMux。
- 复现官方 SLE UART Client/Server 和 Wi-Fi UDP demo。
- 确认 R-SENSE 的两路输出不会与传感器 I2C/ADC 复用冲突。
