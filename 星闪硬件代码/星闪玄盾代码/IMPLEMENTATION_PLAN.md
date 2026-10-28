# HH-D02 StarShield Hardware Pass

> Scope: only `xuanxun-starshield/星闪硬件代码/星闪玄盾代码`.

Goal: provide one reusable FBB WS63 LiteOS application component selected by build-time role for R-SENSE, R-SF, R-WIFI, C-SF, and C-WIFI.

Architecture: the component owns the application event JSON and UART frame codec. R-SENSE creates one framed event and writes identical bytes to two UART buses. R-SF and R-WIFI queue UART input, validate/reassemble frames, and forward the original bytes through SLE or UDP. C-SF and C-WIFI receive the original bytes, validate/reassemble them, and write the original frame to UART0. SLE server plumbing is compiled from the local official relay sample so its SSAP/advertisement API remains the reference implementation.

SDK: local `fbb_ws63` FBB SDK, LiteOS application target, `src/build.py`, target `ws63-liteos-app`, chip `WS63`, board reference `HiHope_NearLink_DK_WS63E_V03`.

Constraints:

- Use only APIs demonstrated by the sibling reference tree.
- Keep event fields `protocol_version`, `event_id`, `robot_id`, `source_id`, `message_type`, `sequence`, `device_time_ms`, `level`, `sensor_values`, and `trigger_bits` intact across transports.
- Use the `0xFA 0xCE` frame magic and CRC16-CCITT-FALSE over version, flags, payload length, and payload. The polynomial/init are explicit in the hardware codec and must be confirmed during S0.
- Keep all UART/I2C PinMux values in `starshield_config.h`; mark the reference-only values and leave UART2 unset until HH-D02 wiring is measured.
- Do not edit protocol, edge-service, web-console, harmony-app, or docs outside this hardware directory.

## Test-first steps

1. Compile and run `tests/protocol_host_test.c`; it must initially fail because the codec is absent.
2. Add the pure-C event/frame codec and rerun the host test until it passes.
3. Add the queue/UART helpers and role entry point.
4. Add R-SENSE, R-SF, R-WIFI, C-SF, and C-WIFI role adapters using local FBB sample APIs.
5. Add the overlay README and exact FBB parent `CMakeLists.txt`/`Kconfig` integration snippets.
6. Run host protocol tests, syntax/static checks, and an SDK build probe. Report unavailable board/toolchain execution as a blocker with the manual command.
