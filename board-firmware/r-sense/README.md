# R-SENSE

输入：I2C/ADC/UART 传感器。

输出：同一个业务事件帧分别发送到 R-SF 和 R-WIFI。R-SENSE 负责生成 `event_id`、`sequence`、`device_time_ms`，下游板不得修改这些字段。
