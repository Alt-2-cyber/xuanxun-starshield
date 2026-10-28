# 智巡消防 · HarmonyOS 现场安全端

智巡消防（ZHIXUN FIRE）提供巡检状态、告警档案、证据与事件回放、配对管理和现场安全操作。

当前版本：**1.1.0 / 1000001**。交付文件为 [ZhiXunFire_1.1.0_debug_unsigned.hap](release/ZhiXunFire_1.1.0_debug_unsigned.hap)。完整改动、构建结果、文件大小和 SHA-256 见 [VALIDATION.md](VALIDATION.md)。

最终构建通过，交付包大小 **848402 字节**。SHA-256：

```text
5C560955DCDDC9E676D3C82B06A176E3D8527D781C1E981CD1D025712A997277
```

安全摘要会区分边缘在线与机器人连接：ROS 未连接时，正常 / 巡检状态显示“等待机器人连接”；暂停、故障和急停记录保留，并提示现场核实。急停解除仍需现场授权。

在本目录用 PowerShell 构建，Hvigor 命令串行执行：

```powershell
$env:DEVECO_SDK_HOME = 'D:\Program Files\Huawei\DevEco Studio\sdk'
node 'D:\Program Files\Huawei\DevEco Studio\tools\hvigor\hvigor\bin\hvigor.js' --no-daemon -p product=default assembleHap
```

沿用本机 SDK 6.0.2(22)。项目没有配置签名，真机安装需要项目签名配置。

本机模拟器请选择 **`Enjoy 90 Pro Max`（不带 `001`）**，配合 `ZHIXUN FIRE` 正常运行配置。2026-10-20 晚间确认 `Enjoy 90 Pro Max 001` 内部存储只剩约 426 MB，安装返回 `9568288 / insufficient disk memory`；切换到前者后，剩余约 4.6 GB，已成功覆盖安装并启动 1.2.0。该错误检查的是目标设备内部存储，电脑磁盘空闲空间和重新编译无法解决。恢复证据见 [VALIDATION.md](VALIDATION.md) 的晚间记录。

为保持升级和现场连接兼容，应用 ID `com.xuanxun.starshield`、配对存储键、协议和 API 枚举保持原值。DevEco 项目显示名称为“智巡消防”，正常运行配置为 `ZHIXUN FIRE`；首次启动选择 `entry` 模块与正常运行配置。
