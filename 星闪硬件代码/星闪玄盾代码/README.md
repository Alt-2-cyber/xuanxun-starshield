# XuanXun StarShield HH-D02 hardware overlay

This directory contains the reusable five-role application component for the local WS63 FBB SDK reference tree. The source directory was empty before this pass.

## SDK and board identified

- SDK: local `fbb_ws63` FBB framework, LiteOS application target, CMake/Kconfig.
- Build entry: `<fbb_ws63-root>\src\build.py`.
- Target: `ws63-liteos-app`.
- Chip: `WS63` / WS63E-class module.
- Board reference: `vendor\HiHope_NearLink_DK_WS63E_V03`, documented locally as `HiHope_NearLink_DK3863E_V03`. The official HH-D02 schematic checked during the hardware pass maps UART2 to GPIO8/GPIO7 and the SK6805/SK6812 status LED data line to GPIO5; the physical cable and board revision still require loopback verification.

The component is an SDK overlay, not a second copy of the 37k-file SDK. Copy `src\application\samples\products\starshield` into the sibling reference SDK at the same relative path.

## Parent integration

After copying the component, add this block to the reference SDK `src\application\samples\products\CMakeLists.txt` before its final parent-scope exports:

```cmake
if(DEFINED CONFIG_SAMPLE_SUPPORT_XUANXUN_STARSHIELD OR
   "CONFIG_SAMPLE_SUPPORT_XUANXUN_STARSHIELD=y" IN_LIST DEFINES)
    add_subdirectory_if_exist(starshield)
endif()
```

Add this block to `src\application\samples\products\Kconfig`:

```kconfig
config SAMPLE_SUPPORT_XUANXUN_STARSHIELD
    bool "XuanXun StarShield five-board hardware component"
    default n
    depends on ENABLE_PRODUCTS_SAMPLE

if SAMPLE_SUPPORT_XUANXUN_STARSHIELD
menu "XuanXun StarShield hardware role"
    osource "application/samples/products/starshield/Kconfig"
endmenu
endif
```

The parent SDK files are intentionally not modified in this workspace; the required edits are shown above so the official/reference tree remains unchanged.

## Role builds

Run from the reference SDK `src` directory. The `-def` form is supported by the checked-in `build.py`; clear all five role macros before selecting one role.

```powershell
$sdkSrc = 'D:\path\to\fbb_ws63-master\src'
Set-Location $sdkSrc

python build.py -c ws63-liteos-app '-def=CONFIG_SAMPLE_SUPPORT_XUANXUN_STARSHIELD=y,-:CONFIG_STARSHIELD_ROLE_R_SENSE,-:CONFIG_STARSHIELD_ROLE_R_SF,-:CONFIG_STARSHIELD_ROLE_R_WIFI,-:CONFIG_STARSHIELD_ROLE_C_SF,-:CONFIG_STARSHIELD_ROLE_C_WIFI,CONFIG_STARSHIELD_ROLE_R_SENSE=y'
```

Replace the final `CONFIG_STARSHIELD_ROLE_R_SENSE=y` with one of:

```text
CONFIG_STARSHIELD_ROLE_R_SF=y
CONFIG_STARSHIELD_ROLE_R_WIFI=y
CONFIG_STARSHIELD_ROLE_C_SF=y
CONFIG_STARSHIELD_ROLE_C_WIFI=y
```

Expected package output is under `src\output\ws63\fwpkg\ws63-liteos-app`; the exact `*_all.fwpkg` and `*_load_only.fwpkg` names depend on the SDK signing configuration. Use HiSparkStudio/BurnTool serial loading and reset the board when the loader asks for it.

## Protocol

The application JSON preserves the shared fields `protocol_version`, `event_id`, `robot_id`, `source_id`, `message_type`, `sequence`, `device_time_ms`, `level`, `sensor_values`, and `trigger_bits`.

The UART and wireless payload is the same binary frame:

```text
FA CE | version:u8 | flags:u8 | payload_len:u16 little-endian |
JSON payload bytes | crc16:u16 little-endian
```

CRC is CRC16-CCITT-FALSE, polynomial `0x1021`, initial value `0xFFFF`, calculated over `version`, `flags`, `payload_len`, and payload. The protocol directory says the final polynomial is frozen at S0; confirm this implementation during S0 before cross-project release.

R-SENSE creates `event_id`, `sequence`, and `device_time_ms` once. R-SF, R-WIFI, C-SF, and C-WIFI forward the original frame bytes and never rewrite those fields.

## Wi-Fi configuration

SSID, password, peer/broadcast IP, and UDP port are build-time Kconfig values. No real credential is stored in this overlay. R-WIFI and C-WIFI both use STA mode and refuse to start until valid station credentials are supplied. R-WIFI can send to a subnet broadcast address so C-WIFI does not need a fixed DHCP lease.

Configure these symbols in the generated Kconfig project before a Wi-Fi build:

- `STARSHIELD_WIFI_STA_SSID` and `STARSHIELD_WIFI_STA_PASSWORD` for both Wi-Fi roles.
- `STARSHIELD_WIFI_PEER_IP` and `STARSHIELD_WIFI_UDP_PORT` for the UDP segment. Use a subnet broadcast address such as `10.19.20.255` for dynamic C-WIFI DHCP addressing.

For the current field network, the intended SSID is `Redmi K70` on 2.4 GHz. Credentials are injected only during the local build and should be rotated after testing.

## PinMux audit

All values are centralized in `src\application\samples\products\starshield\starshield_config.h` and exposed as Kconfig values. UART0 `17/18` and UART1 `15/16` are reference-sample defaults. The HH-D02 UART2 mux is `GPIO8=TXD`, `GPIO7=RXD`, and its single-wire SK6805/SK6812 status LED is driven on GPIO5; the connected board cable still needs a physical loopback check before field deployment. The default sensor hook is also a demo temperature source; replace the weak `starshield_sensor_read` implementation with the measured AHT20/ADC driver after sensor wiring is verified.

## Host validation

From this directory:

```powershell
gcc -std=c11 -Wall -Wextra -Werror `
  -I .\src\application\samples\products\starshield `
  .\tests\protocol_host_test.c `
  .\src\application\samples\products\starshield\starshield_protocol.c `
  -o .\tests\protocol_host_test.exe
.\tests\protocol_host_test.exe
```

The host test covers required JSON fields, FA CE framing, fragmented decoder input, unchanged frame forwarding, and CRC rejection. It does not replace a WS63 cross-compile or hardware run.

The local acceptance pass also ran the ten StarShield application C files through the SDK's RISC-V compiler with the existing WS63 compile flags and `-fsyntax-only`. A full package rebuild still requires a working DevEco/FBB CMake installation; the available Python Store CMake currently resolves its module root through an inaccessible `D:\WpSystem` path.

## Hardware smoke checklist

1. Record each HH-D02 serial number, SDK version, board revision, UART bus, physical TX/RX pins, and PinMux mode.
2. Run the local UART demo on each board and verify the UART0 console and the R-SENSE UART1/UART2 loopbacks.
3. Replace the central PinMux values and set the verification flag only after the loopbacks pass.
4. Flash C-SF and R-SF, verify the SLE server name `c-sf`, pair, and confirm the same `event_id` arrives at C-SF UART0.
5. Configure the shared STA SSID/password at build time, flash C-WIFI and R-WIFI, then confirm both boards obtain DHCP addresses and UDP broadcast frames arrive at the configured port and appear unchanged on C-WIFI UART0.
6. Capture both paths on Ubuntu and compare frame CRC, event_id, sequence, and device_time_ms; then measure UART, wireless, and end-to-end latency separately.

## Current blocker

The repository contains the full reference SDK and cross compiler, but this pass does not modify the official/reference parent `CMakeLists.txt` or `Kconfig`, no HH-D02 board is attached, and no verified UART2 schematic mapping is present. Therefore the overlay and host codec can be validated here, but the five role firmware packages and physical smoke test require applying the two parent snippets in a real SDK checkout and running the manual `python build.py -c ws63-liteos-app ...` commands above.
