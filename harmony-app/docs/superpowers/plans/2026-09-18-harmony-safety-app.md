# 智巡消防 Harmony App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the native HarmonyOS ArkTS/ArkUI Stage safety client for 智巡消防 (ZHIXUN FIRE) within `harmony-app`, including local pairing, live edge-service state, alert evidence, safety actions, and observed event history.

**Architecture:** A small Stage app shell owns navigation and shared observable state. Platform-independent contract and pairing helpers stay separate from `@ohos.net.http`, `@ohos.net.webSocket`, `@ohos.data.preferences`, and ScanKit adapters so they can be checked independently. The client is read-only for configuration and exposes only pause, estop latch, and ACK availability behavior.

**Tech Stack:** ArkTS, ArkUI Stage, HarmonyOS base network/data APIs, ScanKit QR scanning, Hypium unit tests, Hvigor validation.

**Spec:** Repository root `README.md`, `edge-service` REST/WebSocket implementation, `protocol/event.schema.json`, and the user task requirements.

## Global Constraints

- Keep all changes under `harmony-app`.
- Use ArkTS + ArkUI Stage and APIs compatible with HarmonyOS 4.x base capabilities.
- Do not add cloud push, experiment configuration, threshold/rule editing, risk-zone editing, or estop release/clear controls.
- Support `GET /api/v1/system/snapshot`, `GET /api/v1/vision/status`, `GET /api/v1/events/{event_id}/evidence`, `POST /api/v1/safety/pause`, `POST /api/v1/safety/estop`, `POST /api/v1/alerts/{event_id}/ack`, and WebSocket `/ws` messages `system.snapshot`, `alert.created`, `vision.detection`, `safety.changed`, and `twin.snapshot`.
- Store only local service URL, short-lived token, token expiry, and app-observed history; never hardcode or log credentials.
- Use white professional safety UI, deep navy text, blue system accents, orange review state, and red emergency actions.

---

### Task 1: Pairing and contract helpers

**Files:**
- Create: `entry/src/main/ets/models/EdgeModels.ets`
- Create: `entry/src/main/ets/services/pairing/PairingParser.ets`
- Create: `entry/src/test/PairingProtocol.test.ets`
- Modify: `entry/src/test/List.test.ets`

**Interfaces:**
- `parsePairingPayload(payload: string, nowMs?: number): PairingConfig | PairingParseFailure`
- `normalizeServiceUrl(value: string): string | undefined`
- `isTokenUsable(token: string | undefined, expiresAtMs: number | undefined, nowMs?: number): boolean`
- `PairingConfig` contains only `serviceUrl`, optional `token`, and optional `expiresAtMs`.

- [ ] Write tests for JSON and raw-URL QR payloads, invalid schemes, and expired tokens.
- [ ] Run the unit/build validation and observe the missing-helper failure.
- [ ] Implement the pure helpers without platform imports.
- [ ] Run the focused validation again and confirm the helper tests pass.

### Task 2: Local storage and edge transport

**Files:**
- Create: `entry/src/main/ets/services/pairing/PairingStore.ets`
- Create: `entry/src/main/ets/services/edge/EdgeClient.ets`
- Create: `entry/src/main/ets/services/edge/EdgeMessageRouter.ets`
- Modify: `entry/src/main/module.json5`

**Interfaces:**
- `PairingStore.load()`, `save(config)`, and `clear()` use Stage preferences and remove expired tokens.
- `EdgeClient.getSnapshot()`, `getVisionStatus()`, `getEvidence(eventId)`, `pause()`, `estop()`, `ack(eventId)`, `connect(onMessage, onState)`, and `disconnect()`.
- `EdgeMessageRouter.route(rawMessage)` emits typed state updates for the five required WebSocket envelope types.

- [ ] Implement authenticated REST headers only when a valid local token exists.
- [ ] Normalize HTTP and WebSocket URLs from one stored service URL.
- [ ] Map ACK 404/405 to a typed unavailable result and preserve other failures.
- [ ] Add INTERNET permission and avoid camera permission in the manifest by using the system QR scanner UI.

### Task 3: Shared app state and native pages

**Files:**
- Create: `entry/src/main/ets/store/AppStore.ets`
- Create: `entry/src/main/ets/components/SafetyComponents.ets`
- Create: `entry/src/main/ets/pages/PairingPage.ets`
- Create: `entry/src/main/ets/pages/SafetyHomePage.ets`
- Create: `entry/src/main/ets/pages/AlertDetailPage.ets`
- Create: `entry/src/main/ets/pages/SafetyActionsPage.ets`
- Create: `entry/src/main/ets/pages/EventHistoryPage.ets`
- Modify: `entry/src/main/ets/pages/Index.ets`

**Interfaces:**
- `AppStore` owns connection state, current snapshot, latest vision status, selected alert, evidence, and app-observed history.
- Pages receive callbacks for navigation and safety commands; no page can mutate configuration or release estop.

- [ ] Implement pairing with ScanKit QR scan plus manual payload fallback.
- [ ] Implement home status cards, latest alert, evidence summary, vision status, and connection state.
- [ ] Implement alert detail with sensor values, trigger bits, photo/frame preview when payload fields provide media, and ACK availability.
- [ ] Implement pause and estop confirmation flows with red emergency styling and no clear action.
- [ ] Implement event history from current-session WebSocket alerts and stored local history.
- [ ] Wire REST bootstrap and WebSocket lifecycle to app foreground/background callbacks.

### Task 4: Resources, tests, and validation notes

**Files:**
- Modify: `AppScope/app.json5`
- Modify: `AppScope/resources/base/element/string.json`
- Modify: `entry/src/main/resources/base/element/color.json`
- Modify: `entry/src/main/resources/base/element/float.json`
- Modify: `entry/src/main/resources/base/element/string.json`
- Modify: `entry/src/main/resources/base/profile/main_pages.json`
- Modify: `entry/src/main/ets/entryability/EntryAbility.ets`
- Modify: `entry/src/test/LocalUnit.test.ets`
- Create: `VALIDATION.md`

- [ ] Set product name and professional safety palette resources.
- [ ] Add focused tests for message routing and safety command restrictions where the local test harness supports them.
- [ ] Run the actual available Hvigor/static checks and capture exact commands and blockers in `VALIDATION.md`.
- [ ] Review the final file list to ensure no path outside `harmony-app` changed.
