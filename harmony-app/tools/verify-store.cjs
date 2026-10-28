/* Runs the real non-UI ArkTS modules with deterministic native I/O adapters.
 * No network, device control, dependency downloads, or application data writes.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('D:/Program Files/Huawei/DevEco Studio/tools/hvigor/hvigor/node_modules/typescript');
const root = path.resolve(__dirname, '..');
const event = (id = 'saved-1', acked = false) => ({
  event_id: id, level: 'P1', acked, robot_id: 'robot-1', source_id: 'smoke-1',
  trigger_bits: ['SMOKE'], created_at: '2026-10-19T08:00:00Z', status: acked ? 'ACKED' : 'OPEN'
});
const snapshot = (state = 'PATROLLING') => ({
  safety: { state, patrol_name: 'A区巡检' }, boards_online: 5, ros_connected: true, alert: null
});
const control = () => ({
  mode: 'FIXED_PATROL', safety_state: 'PATROLLING', ros_connected: true,
  obstacle_blocked: false, last_command: '', last_reason: '', voice_feedback: '', command_sequence: 0
});
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }

function fixture() {
  const cache = new Map();
  const calls = [];
  const sockets = [];
  const timers = new Map();
  let nextTimer = 1;
  const saved = new Map([['service_url', 'http://edge.local:8787']]);
  const storeValues = {
    get: async (key, fallback) => saved.has(key) ? saved.get(key) : fallback,
    put: async (key, value) => { saved.set(key, value); },
    delete: async (key) => { saved.delete(key); },
    clear: async () => { saved.clear(); }, flush: async () => {}
  };
  const env = {
    calls, sockets, timers, openSocketAutomatically: true,
    respond: async (url, options) => {
      if (url.includes('/events?')) return [event()];
      if (url.endsWith('/evidence')) return { event_id: url.split('/').at(-2), photos: [] };
      if (url.endsWith('/ack')) return event(decodeURIComponent(url.split('/').at(-2)), true);
      if (url.endsWith('/vision/status')) return { loaded: true };
      if (url.endsWith('/control/state')) return control();
      if (url.endsWith('/pause')) return snapshot('PAUSED');
      return snapshot();
    }
  };
  const http = {
    RequestMethod: { GET: 'GET', POST: 'POST' }, HttpDataType: { STRING: 0 },
    createHttp: () => ({
      request: async (url, options) => {
        calls.push({ url, options });
        const result = await env.respond(url, options);
        return { responseCode: result?.httpCode ?? 200, result: JSON.stringify(result?.httpBody ?? result) };
      }, destroy: () => {}
    })
  };
  const websocket = { createWebSocket: () => {
    const handlers = new Map();
    const socket = {
      on: (name, fn) => handlers.set(name, fn),
      off: (name) => handlers.delete(name),
      connect: async () => { if (env.openSocketAutomatically) socket.send('open', {}); },
      close: async () => { socket.send('close', {}); },
      send: (name, value) => handlers.get(name)?.({}, value)
    };
    sockets.push(socket);
    return socket;
  } };
  function load(filename) {
    const resolved = path.resolve(filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const result = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 }
    });
    const localRequire = (name) => {
      if (name === '@ohos.net.http') return { default: http };
      if (name === '@ohos.net.webSocket') return { default: websocket };
      if (name === '@ohos.data.preferences') return { default: { getPreferences: async () => storeValues } };
      if (name.startsWith('@ohos.')) return {};
      return load(path.resolve(path.dirname(resolved), `${name}.ets`));
    };
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', result.outputText)(
      localRequire, module, module.exports,
      (fn, delay) => { const id = nextTimer++; timers.set(id, { fn, delay }); return id; },
      (id) => { timers.delete(id); }
    );
    return module.exports;
  }
  env.load = (name) => load(path.join(root, 'entry/src/main/ets', name));
  const AppStore = env.load('store/AppStore.ets').default;
  env.states = [];
  env.store = new AppStore({}, (value) => { env.states.push(value); });
  env.state = () => env.states.at(-1);
  return env;
}

test('alert.updated routes persisted confirmation', () => {
  const f = fixture();
  const { routeEdgeMessage } = f.load('services/edge/EdgeMessageRouter.ets');
  assert.equal(routeEdgeMessage(JSON.stringify({ type: 'alert.updated', data: event('saved-1', true) }))?.event?.acked, true);
});

test('startup loads events archived before the app connected', async () => {
  const f = fixture();
  await f.store.start(); await flush();
  assert.equal(f.state().history[0]?.event_id, 'saved-1');
  assert.ok(f.calls.some((c) => c.url.endsWith('/api/v1/events?limit=200&offset=0')));
  await f.store.dispose();
});

test('ack updates selected event and history from the server response', async () => {
  const f = fixture(); await f.store.start(); await flush();
  await f.store.selectAlert(event());
  await f.store.acknowledge('saved-1');
  assert.equal(f.state().selectedAlert?.acked, true);
  assert.equal(f.state().history.find((e) => e.event_id === 'saved-1')?.acked, true);
  assert.equal(f.state().selectedAlert?.status, 'ACKED');
  await f.store.dispose();
});

test('HTTP failure never fabricates a safety transition', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const original = f.respond;
  f.respond = (url, options) => url.endsWith('/pause')
    ? Promise.resolve({ httpCode: 503, httpBody: { error: 'offline' } }) : original(url, options);
  await f.store.pause();
  assert.equal(f.state().snapshot.safety.state, 'PATROLLING');
  assert.ok(f.state().errorMessage.length > 0);
  await f.store.dispose();
});

test('duplicate safety submissions send only one POST', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const pending = deferred(); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/pause') ? pending.promise : original(url, options);
  const first = f.store.pause(); const second = f.store.pause();
  await flush();
  const count = f.calls.filter((c) => c.url.endsWith('/pause')).length;
  pending.resolve(snapshot('PAUSED')); await Promise.all([first, second]);
  await f.store.dispose();
  assert.equal(count, 1);
});

test('dispose during a pending connection creates no socket or reconnect timer', async () => {
  const f = fixture(); const pending = deferred(); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/system/snapshot') ? pending.promise : original(url, options);
  const starting = f.store.start(); await flush();
  await f.store.dispose(); pending.resolve(snapshot()); await starting; await flush();
  assert.equal(f.sockets.length, 0);
  assert.equal(f.timers.size, 0);
});

test('old evidence cannot overwrite a later event selection', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const pending = deferred(); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/first/evidence') ? pending.promise : original(url, options);
  const first = f.store.selectAlert(event('first')); await flush();
  await f.store.selectAlert(event('second'));
  pending.resolve({ event_id: 'first', photos: [] }); await first;
  assert.equal(f.state().selectedAlert.event_id, 'second');
  assert.equal(f.state().evidence.event_id, 'second');
  await f.store.dispose();
});

test('filters combine level, confirmation and a trimmed case-insensitive keyword', () => {
  const f = fixture();
  const { filterEvents } = f.load('services/edge/EventHistory.ets');
  const records = [event('PUMP-A', false), event('PUMP-B', true), { ...event('PUMP-C', false), level: 'P2' }];
  assert.deepEqual(filterEvents(records, 'P1', 'PENDING', '  pump  ').map((e) => e.event_id), ['PUMP-A']);
  assert.deepEqual(filterEvents(records, 'ALL', 'ACKED', 'smoke-1').map((e) => e.event_id), ['PUMP-B']);
  assert.equal(filterEvents(records, 'P2', 'ACKED', '').length, 0);
});

test('a delayed archive cannot undo a live persisted ack', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const pending = deferred(); const original = f.respond;
  f.respond = (url, options) => url.includes('/events?') ? pending.promise : original(url, options);
  const loading = f.store.loadHistory(); await flush();
  f.sockets.at(-1).send('message', JSON.stringify({ type: 'alert.updated', data: event('saved-1', true) }));
  pending.resolve([event('saved-1', false)]); await loading;
  assert.equal(f.state().history[0].acked, true);
  await f.store.dispose();
});

test('an ack for an older event does not replace the current alert', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const socket = f.sockets.at(-1);
  socket.send('message', JSON.stringify({ type: 'alert.created', data: event('current-risk') }));
  socket.send('message', JSON.stringify({ type: 'alert.updated', data: event('older-risk', true) }));
  assert.equal(f.state().snapshot.alert.event_id, 'current-risk');
  await f.store.dispose();
});

test('history failure is visible and can be retried without discarding the archive', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const original = f.respond;
  f.respond = (url, options) => url.includes('/events?') ? Promise.reject(new Error('offline')) : original(url, options);
  await f.store.loadHistory();
  assert.ok(f.state().historyError.length > 0);
  assert.equal(f.state().history[0].event_id, 'saved-1');
  f.respond = original; await f.store.loadHistory();
  assert.equal(f.state().historyError, '');
  assert.equal(f.state().historyLoading, false);
  await f.store.dispose();
});

test('history pagination loads the next 200 records with no duplicate ids', async () => {
  const f = fixture(); const original = f.respond;
  f.respond = (url, options) => {
    if (!url.includes('/events?')) return original(url, options);
    if (url.endsWith('offset=0')) return Promise.resolve(Array.from({ length: 200 }, (_, i) => event(`first-${i}`)));
    return Promise.resolve([event('first-199'), event('older')]);
  };
  await f.store.start(); await flush();
  assert.equal(f.state().historyHasMore, true);
  await f.store.loadHistory(true);
  assert.ok(f.calls.some((c) => c.url.endsWith('/events?limit=200&offset=200')));
  assert.equal(f.state().history.length, 201);
  assert.equal(f.state().historyHasMore, false);
  await f.store.dispose();
});

test('re-pairing ignores an old in-flight snapshot and stale socket callbacks', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const oldSocket = f.sockets.at(-1); const pending = deferred(); const original = f.respond;
  f.respond = (url, options) => url.startsWith('http://edge.local:8787') && url.endsWith('/system/snapshot')
    ? pending.promise : original(url, options);
  const refreshing = f.store.refresh(); await flush();
  await f.store.pair('http://new-edge.local:8787');
  pending.resolve(snapshot('ESTOP_LATCHED')); await refreshing;
  oldSocket.send('message', JSON.stringify({ type: 'safety.changed', data: snapshot('FAULT') }));
  oldSocket.send('close', {});
  assert.equal(f.state().pairing.serviceUrl, 'http://new-edge.local:8787');
  assert.equal(f.state().snapshot.safety.state, 'PATROLLING');
  assert.equal(f.state().connectionState, 'connected');
  assert.equal(f.timers.size, 1);
  await f.store.dispose();
});

test('disconnect notifies and schedules one reconnect; dispose cancels it', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const socket = f.sockets.at(-1);
  socket.send('error', {}); socket.send('close', {});
  assert.equal(f.state().connectionState, 'disconnected');
  assert.ok(f.state().errorMessage.length > 0);
  assert.equal(f.timers.size, 1);
  await f.store.dispose(); socket.send('error', {}); socket.send('close', {});
  assert.equal(f.timers.size, 0);
});

test('a refused control command does not report successful execution', async () => {
  const f = fixture(); await f.store.start(); await flush(); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/control/mode') ? Promise.resolve({
    result: { accepted: false, reason: 'safety_latched', spoken_response: '急停锁存，指令被拒绝' },
    state: { ...control(), safety_state: 'ESTOP_LATCHED' }
  }) : original(url, options);
  const message = await f.store.setControlMode('LOBSTER_AI');
  assert.equal(message, '急停锁存，指令被拒绝');
  assert.equal(f.state().actionMessage, '');
  assert.equal(f.state().snapshot.safety.state, 'ESTOP_LATCHED');
  await f.store.dispose();
});

test('an ack response for a different event is rejected', async () => {
  const f = fixture(); await f.store.start(); await flush(); await f.store.selectAlert(event()); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/ack') ? Promise.resolve(event('wrong-id', true)) : original(url, options);
  const result = await f.store.acknowledge('saved-1');
  assert.equal(result.kind, 'failed');
  assert.equal(f.state().selectedAlert.acked, false);
  await f.store.dispose();
});

test('failed ack can be retried and only a real success changes the list', async () => {
  const f = fixture(); await f.store.start(); await flush(); await f.store.selectAlert(event()); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/ack') ? Promise.reject(new Error('offline')) : original(url, options);
  assert.equal((await f.store.acknowledge('saved-1')).kind, 'failed');
  assert.equal(f.state().history[0].acked, false);
  f.respond = original;
  assert.equal((await f.store.acknowledge('saved-1')).kind, 'acknowledged');
  assert.equal(f.state().history[0].acked, true);
  await f.store.dispose();
});

test('a safety POST confirmation survives a lagging control status read', async () => {
  const f = fixture(); await f.store.start(); await flush();
  await f.store.pause();
  assert.equal(f.state().snapshot.safety.state, 'PAUSED');
  assert.ok(f.state().actionMessage.includes('服务器已确认'));
  await f.store.dispose();
});

test('a newer safety broadcast wins over an earlier snapshot refresh', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const pending = deferred(); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/system/snapshot') ? pending.promise : original(url, options);
  const refreshing = f.store.refresh(); await flush();
  f.sockets.at(-1).send('message', JSON.stringify({ type: 'safety.changed', data: snapshot('ESTOP_LATCHED') }));
  pending.resolve(snapshot('PATROLLING')); await refreshing;
  assert.equal(f.state().snapshot.safety.state, 'ESTOP_LATCHED');
  await f.store.dispose();
});

test('event replay loads the existing archived frames endpoint', async () => {
  const f = fixture(); await f.store.start(); await flush(); const original = f.respond;
  f.respond = (url, options) => url.endsWith('/saved-1/replay') ? Promise.resolve({
    event_id: 'saved-1', frames: [{ timestamp: '2026-10-19T08:00:01Z', safety_state: 'PAUSED', sensor_values: { temperature_c: 61 } }]
  }) : original(url, options);
  await f.store.selectAlert(event()); await f.store.loadReplay();
  assert.equal(f.state().replay.frames[0].sensor_values.temperature_c, 61);
  assert.equal(f.state().replayLoading, false);
  await f.store.dispose();
});

test('an old replay cannot populate a different event detail', async () => {
  const f = fixture(); await f.store.start(); await flush(); const original = f.respond; const pending = deferred();
  f.respond = (url, options) => url.endsWith('/first/replay') ? pending.promise : original(url, options);
  await f.store.selectAlert(event('first')); const replay = f.store.loadReplay(); await flush();
  await f.store.selectAlert(event('second'));
  pending.resolve({ event_id: 'first', frames: [] }); await replay;
  assert.equal(f.state().replay, undefined);
  assert.equal(f.state().replayLoading, false);
  await f.store.dispose();
});

test('a delayed WebSocket open still loads the persistent event archive', async () => {
  const f = fixture(); f.openSocketAutomatically = false;
  await f.store.start(); await flush();
  f.sockets.at(-1).send('open', {}); await flush();
  assert.equal(f.state().history[0]?.event_id, 'saved-1');
  await f.store.dispose();
});

test('a background status probe detects a silent network loss and disables commands', async () => {
  const f = fixture(); await f.store.start(); await flush();
  const original = f.respond;
  f.respond = (url, options) => url.endsWith('/system/snapshot') ? Promise.reject(new Error('network lost')) : original(url, options);
  const heartbeat = [...f.timers.entries()].find(([, timer]) => timer.delay === 15000);
  assert.ok(heartbeat, 'an online connection must schedule a status probe');
  f.timers.delete(heartbeat[0]); heartbeat[1].fn(); await flush();
  assert.equal(f.state().connectionState, 'error');
  await f.store.pause();
  assert.equal(f.calls.filter((c) => c.url.endsWith('/pause')).length, 0);
  await f.store.dispose(); assert.equal(f.timers.size, 0);
});
