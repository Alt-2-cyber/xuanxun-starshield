# StarShield hardware acceptance record

Date: 2026-09-18

## Scope

This acceptance covers the HH-D02/WS63 FBB overlay in
`src/application/samples/products/starshield` and its host protocol test.
It does not certify a physical board, sensor wiring, or a production fire
alarm deployment.

## Passed checks

- Fresh MinGW host build with `-std=c11 -Wall -Wextra -Werror -pedantic`.
- Protocol host test: 16 assertions passed.
- JSON field preservation: event ID, sequence, device time, trigger bits, and
  escaped string fields.
- Frame codec: FA CE magic, CRC16-CCITT-FALSE, fragmented reassembly, unchanged
  forwarding bytes, payload-size rejection, bad-CRC rejection, and unsupported
  version rejection.
- WS63 RISC-V compiler syntax check: all ten StarShield application C files
  passed with the existing `ws63-liteos-app` compiler flags and SDK include
  paths.
- Role-entry syntax check: R-SENSE, R-SF, R-WIFI, C-SF, and C-WIFI each compile
  through `starshield_app.c` selection.
- SDK `kconfiglib` parse check: the StarShield sample symbol, five role symbols,
  and Wi-Fi string symbols are all recognized with the expected types.
- Local reference API paths verified for UART, Wi-Fi STA/SoftAP, SLE SSAP
  client, and the `sle_relay` UART server.

## Not yet passed

- A complete FBB package rebuild was not completed. The available Python Store
  CMake resolves its module root through an inaccessible `D:\WpSystem` path,
  so CMake fails before the StarShield target is configured. The source-level
  target compiler check above is independent of that failure.
- No HH-D02 board was connected for UART loopback, SLE pairing, Wi-Fi UDP, or
  sensor tests.
- UART0/UART1 values are reference-sample defaults. The official HH-D02
  schematic maps UART2 to GPIO8/GPIO7 and the SK6805/SK6812 status LED data
  line to GPIO5; physical cable routing and UART loopback are still pending.
- The weak sensor hook still emits demo temperature data. Replace it with the
  measured sensor driver before any field claim.

## Release gate before S0

1. Apply the parent CMake/Kconfig snippets in a real FBB SDK checkout.
2. Configure Wi-Fi credentials through Kconfig; no real credentials belong in
   this overlay.
3. Verify pinmux and sensor wiring on the actual board.
4. Build and flash all required roles, then capture matching event IDs, frame
   CRCs, sequence numbers, and device timestamps on both paths.
5. Record SLE/Wi-Fi latency and retry data for the formal A/B experiment.
