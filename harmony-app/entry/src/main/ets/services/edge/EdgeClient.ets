import http from '@ohos.net.http';
import webSocket from '@ohos.net.webSocket';
import type { BusinessError } from '@ohos.base';
import {
  AckResult,
  AlertEvent,
  ControlMode,
  ControlModeRequest,
  ControlSnapshot,
  ControlTaskRequest,
  ControlTaskResponse,
  EdgeConnectionState,
  EventEvidence,
  EventReplay,
  ManualVelocityRequest,
  PairingConfig,
  SystemSnapshot,
  VisionStatus
} from '../../models/EdgeModels';
import { isTokenUsable, normalizeServiceUrl } from '../pairing/PairingParser';
import { routeEdgeMessage, RoutedEdgeMessage } from './EdgeMessageRouter';

export type EdgeMessageCallback = (message: RoutedEdgeMessage) => void;
export type EdgeStateCallback = (state: EdgeConnectionState) => void;

export function buildWebSocketUrl(serviceUrl: string): string {
  const normalized: string = normalizeServiceUrl(serviceUrl) ?? serviceUrl;
  const scheme: string = normalized.toLowerCase().startsWith('https://') ? 'wss://' : 'ws://';
  const withoutScheme: string = normalized.substring(normalized.indexOf('://') + 3);
  return `${scheme}${withoutScheme}/ws`;
}

export function buildAuthHeaders(config: PairingConfig, nowMs: number = Date.now()): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  if (isTokenUsable(config.token, config.expiresAtMs, nowMs)) {
    headers['Authorization'] = `Bearer ${config.token as string}`;
  }
  return headers;
}

function parseJsonResult<T>(response: http.HttpResponse): T {
  if (typeof response.result === 'string') {
    return JSON.parse(response.result) as T;
  }
  return response.result as T;
}

function isSuccess(code: number): boolean {
  return code >= 200 && code < 300;
}

export default class EdgeClient {
  private readonly config: PairingConfig;
  private socket: webSocket.WebSocket | undefined;
  private disposed: boolean = false;
  private requests: http.HttpRequest[] = [];

  public constructor(config: PairingConfig) {
    this.config = config;
  }

  public async getSnapshot(): Promise<SystemSnapshot> {
    return this.requestJson<SystemSnapshot>('/api/v1/system/snapshot', http.RequestMethod.GET);
  }

  public async getVisionStatus(): Promise<VisionStatus> {
    return this.requestJson<VisionStatus>('/api/v1/vision/status', http.RequestMethod.GET);
  }

  public async getEvents(limit: number = 200, offset: number = 0): Promise<AlertEvent[]> {
    const events: AlertEvent[] = await this.requestJson<AlertEvent[]>(
      `/api/v1/events?limit=${limit}&offset=${offset}`, http.RequestMethod.GET
    );
    if (!Array.isArray(events) || events.some((event: AlertEvent): boolean =>
      event === null || typeof event.event_id !== 'string' || typeof event.level !== 'string')) {
      throw new Error('Invalid event archive response');
    }
    return events;
  }

  public async getEvidence(eventId: string): Promise<EventEvidence> {
    const encodedId: string = encodeURIComponent(eventId);
    return this.requestJson<EventEvidence>(`/api/v1/events/${encodedId}/evidence`, http.RequestMethod.GET);
  }

  public async getReplay(eventId: string): Promise<EventReplay> {
    const replay: EventReplay = await this.requestJson<EventReplay>(
      `/api/v1/events/${encodeURIComponent(eventId)}/replay`, http.RequestMethod.GET
    );
    if (replay === null || replay.event_id !== eventId || !Array.isArray(replay.frames)) {
      throw new Error('Invalid event replay response');
    }
    return replay;
  }

  public async pause(): Promise<SystemSnapshot> {
    return this.requestJson<SystemSnapshot>('/api/v1/safety/pause', http.RequestMethod.POST);
  }

  public async estop(): Promise<SystemSnapshot> {
    return this.requestJson<SystemSnapshot>('/api/v1/safety/estop', http.RequestMethod.POST);
  }

  public async getControlState(): Promise<ControlSnapshot> {
    return this.requestJson<ControlSnapshot>('/api/v1/control/state', http.RequestMethod.GET);
  }

  public async setControlMode(mode: ControlMode): Promise<ControlTaskResponse> {
    const body: ControlModeRequest = { mode };
    return this.requestJson<ControlTaskResponse>('/api/v1/control/mode', http.RequestMethod.POST, body);
  }

  public async submitTask(text: string, source: 'APP' | 'VOICE'): Promise<ControlTaskResponse> {
    const body: ControlTaskRequest = { text, source };
    return this.requestJson<ControlTaskResponse>('/api/v1/control/task', http.RequestMethod.POST, body);
  }

  public async manualVelocity(linearX: number, angularZ: number): Promise<ControlTaskResponse> {
    const body: ManualVelocityRequest = {
      linear_x: linearX,
      angular_z: angularZ,
      duration_ms: 350
    };
    return this.requestJson<ControlTaskResponse>('/api/v1/control/manual', http.RequestMethod.POST, body);
  }

  public async ack(eventId: string): Promise<AckResult> {
    const encodedId: string = encodeURIComponent(eventId);
    try {
      const response: http.HttpResponse = await this.request(
        `/api/v1/alerts/${encodedId}/ack`,
        http.RequestMethod.POST
      );
      if (response.responseCode === 404 || response.responseCode === 405) {
        return { kind: 'unavailable', message: '边缘服务尚未提供确认接口' };
      }
      if (!isSuccess(response.responseCode)) {
        return { kind: 'failed', message: `确认失败（HTTP ${response.responseCode}）` };
      }
      const event: AlertEvent = parseJsonResult<AlertEvent>(response);
      if (event === null || event.event_id !== eventId || event.acked !== true || typeof event.level !== 'string') {
        return { kind: 'failed', message: '服务未返回有效的确认结果，请刷新后重试' };
      }
      return { kind: 'acknowledged', message: '告警已确认，记录已保存', event };
    } catch (_) {
      return { kind: 'failed', message: '确认请求失败，请检查边缘服务连接' };
    }
  }

  public async connect(onMessage: EdgeMessageCallback, onState: EdgeStateCallback): Promise<void> {
    if (this.disposed || this.socket !== undefined) {
      throw new Error('Connection no longer available');
    }
    onState('connecting');
    const socket: webSocket.WebSocket = webSocket.createWebSocket();
    this.socket = socket;
    socket.on('open', (_error: BusinessError<void>, _value: Object) => {
      if (!this.disposed && this.socket === socket) {
        onState('connected');
      }
    });
    socket.on('message', (_error: BusinessError<void>, data: string | ArrayBuffer) => {
      if (this.disposed || this.socket !== socket || typeof data !== 'string') {
        return;
      }
      const routed: RoutedEdgeMessage | undefined = routeEdgeMessage(data);
      if (routed !== undefined) {
        onMessage(routed);
      }
    });
    socket.on('close', (_error: BusinessError<void>, _value: webSocket.CloseResult) => {
      if (!this.disposed && this.socket === socket) {
        this.socket = undefined;
        onState('disconnected');
      }
    });
    socket.on('error', (_error: BusinessError<void>) => {
      if (!this.disposed && this.socket === socket) {
        onState('error');
      }
    });
    try {
      await socket.connect(buildWebSocketUrl(this.config.serviceUrl), {
        header: buildAuthHeaders(this.config)
      });
      if (this.disposed || this.socket !== socket) {
        await socket.close({ code: 1000, reason: 'connection superseded' });
        throw new Error('Connection superseded');
      }
    } catch (_) {
      if (!this.disposed && this.socket === socket) {
        this.socket = undefined;
        onState('error');
      }
      throw new Error('WebSocket connection failed');
    }
  }

  public async disconnect(): Promise<void> {
    this.disposed = true;
    const socket: webSocket.WebSocket | undefined = this.socket;
    this.socket = undefined;
    this.requests.forEach((request: http.HttpRequest): void => request.destroy());
    this.requests = [];
    if (socket !== undefined) {
      try {
        await socket.close({ code: 1000, reason: 'client replaced or disposed' });
      } catch (_) {
        // The socket may already have been closed by the platform.
      }
    }
  }

  private async requestJson<T>(path: string, method: http.RequestMethod, body?: Object): Promise<T> {
    const response: http.HttpResponse = await this.request(path, method, body);
    if (!isSuccess(response.responseCode)) {
      throw new Error(`HTTP ${response.responseCode}`);
    }
    return parseJsonResult<T>(response);
  }

  private async request(path: string, method: http.RequestMethod, body?: Object): Promise<http.HttpResponse> {
    if (this.disposed) {
      throw new Error('Client disposed');
    }
    const request: http.HttpRequest = http.createHttp();
    this.requests.push(request);
    try {
      const response: http.HttpResponse = await request.request(`${this.config.serviceUrl}${path}`, {
        method,
        header: buildAuthHeaders(this.config),
        extraData: body === undefined ? undefined : JSON.stringify(body),
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 5000,
        readTimeout: 10000
      });
      if (this.disposed) {
        throw new Error('Client disposed');
      }
      return response;
    } catch (_) {
      throw new Error('HTTP request failed');
    } finally {
      if (this.requests.indexOf(request) >= 0) {
        this.requests = this.requests.filter((pending: http.HttpRequest): boolean => pending !== request);
        request.destroy();
      }
    }
  }
}
