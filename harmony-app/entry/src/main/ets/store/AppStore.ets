import common from '@ohos.app.ability.common';
import {
  AckResult, AlertEvent, ControlMode, ControlSnapshot, ControlTaskResponse, EdgeConnectionState,
  EventEvidence, EventReplay, PairingConfig, PairingParseResult, SystemSnapshot, VisionDetection, VisionStatus
} from '../models/EdgeModels';
import { parsePairingPayload, toPairingConfig } from '../services/pairing/PairingParser';
import PairingStore from '../services/pairing/PairingStore';
import EdgeClient from '../services/edge/EdgeClient';
import { RoutedEdgeMessage } from '../services/edge/EdgeMessageRouter';
import { mergeEvents } from '../services/edge/EventHistory';

export interface AppStoreState {
  pairing: PairingConfig | undefined;
  snapshot: SystemSnapshot | undefined;
  visionStatus: VisionStatus | undefined;
  latestDetection: VisionDetection | undefined;
  selectedAlert: AlertEvent | undefined;
  evidence: EventEvidence | undefined;
  history: AlertEvent[];
  connectionState: EdgeConnectionState;
  errorMessage: string;
  ackResult: AckResult | undefined;
  busyAction: string;
  control: ControlSnapshot | undefined;
  refreshing: boolean;
  historyLoading: boolean;
  historyLoaded: boolean;
  historyError: string;
  historyHasMore: boolean;
  evidenceLoading: boolean;
  evidenceError: string;
  lastUpdatedAt: number;
  actionMessage: string;
  replay: EventReplay | undefined;
  replayLoading: boolean;
  replayError: string;
}

export type AppStoreListener = (state: AppStoreState) => void;

export default class AppStore {
  private readonly pairingStore: PairingStore;
  private readonly listener: AppStoreListener;
  private client: EdgeClient | undefined;
  private pairing: PairingConfig | undefined;
  private snapshot: SystemSnapshot | undefined;
  private visionStatus: VisionStatus | undefined;
  private latestDetection: VisionDetection | undefined;
  private selectedAlert: AlertEvent | undefined;
  private evidence: EventEvidence | undefined;
  private history: AlertEvent[] = [];
  private connectionState: EdgeConnectionState = 'disconnected';
  private errorMessage: string = '';
  private ackResult: AckResult | undefined;
  private busyAction: string = '';
  private control: ControlSnapshot | undefined;
  private refreshing: boolean = false;
  private historyLoading: boolean = false;
  private historyLoaded: boolean = false;
  private historyError: string = '';
  private historyHasMore: boolean = false;
  private historyOffset: number = 0;
  private evidenceLoading: boolean = false;
  private evidenceError: string = '';
  private lastUpdatedAt: number = 0;
  private actionMessage: string = '';
  private replay: EventReplay | undefined;
  private replayLoading: boolean = false;
  private replayError: string = '';
  private replayRequest: number = 0;
  private stopped: boolean = false;
  private started: boolean = false;
  private generation: number = 0;
  private evidenceRequest: number = 0;
  private snapshotRevision: number = 0;
  private controlRevision: number = 0;
  private reconnectAttempt: number = 0;
  private reconnectTimer: number | undefined;
  private healthTimer: number | undefined;

  public constructor(context: common.Context, listener: AppStoreListener) {
    this.pairingStore = new PairingStore(context);
    this.listener = listener;
  }

  public async start(): Promise<void> {
    if (this.started || this.stopped) {
      return;
    }
    this.started = true;
    const generation: number = this.generation;
    const pairing: PairingConfig | undefined = await this.pairingStore.load();
    if (this.stopped || generation !== this.generation) {
      return;
    }
    this.pairing = pairing;
    this.emit();
    if (pairing !== undefined) {
      await this.connectConfigured();
    }
  }

  public async pair(payload: string): Promise<PairingParseResult> {
    if (this.stopped || this.busyAction.length > 0) {
      return { error: 'busy' };
    }
    const parsed: PairingParseResult = parsePairingPayload(payload);
    const config: PairingConfig | undefined = toPairingConfig(parsed);
    if (config === undefined) {
      this.errorMessage = this.pairingErrorText(parsed.error);
      this.emit();
      return parsed;
    }
    this.busyAction = 'pairing';
    this.errorMessage = '';
    this.emit();
    try {
      await this.pairingStore.save(config);
      if (this.stopped) {
        return { error: 'disposed' };
      }
      this.pairing = config;
      this.clearData();
      await this.connectConfigured();
      return parsed;
    } catch (_) {
      if (!this.stopped) {
        this.errorMessage = '配对信息无法保存，请重试';
      }
      return { error: 'storage_unavailable' };
    } finally {
      if (!this.stopped && this.busyAction === 'pairing') {
        this.busyAction = '';
        this.emit();
      }
    }
  }

  public async clearPairing(): Promise<void> {
    if (this.stopped || this.busyAction.length > 0) {
      return;
    }
    this.busyAction = 'clearPairing';
    this.emit();
    try {
      // Keep the current connection if removing the saved configuration fails.
      await this.pairingStore.clear();
      if (this.stopped) {
        return;
      }
      this.generation++;
      this.cancelReconnect();
      this.cancelHealth();
      const client: EdgeClient | undefined = this.client;
      this.client = undefined;
      this.pairing = undefined;
      this.clearData();
      this.connectionState = 'disconnected';
      this.errorMessage = '';
      await client?.disconnect();
    } catch (_) {
      this.errorMessage = '取消配对失败，原连接已保留，请重试';
    } finally {
      if (!this.stopped) {
        this.busyAction = '';
        this.emit();
      }
    }
  }

  public async reconnect(): Promise<void> {
    if (this.stopped || this.pairing === undefined || this.connectionState === 'connecting'
      || this.busyAction.length > 0) {
      return;
    }
    await this.connectConfigured();
  }

  public async refresh(): Promise<void> {
    const client: EdgeClient | undefined = this.client;
    if (client === undefined || this.stopped || this.refreshing || this.connectionState !== 'connected') {
      return;
    }
    this.refreshing = true;
    this.errorMessage = '';
    const revision: number = this.snapshotRevision;
    this.emit();
    try {
      const snapshot: SystemSnapshot = await client.getSnapshot();
      if (!this.isCurrent(client)) {
        return;
      }
      if (revision === this.snapshotRevision) {
        this.applySnapshot(snapshot);
      }
      await this.loadSupportState(client);
    } catch (_) {
      if (this.isCurrent(client)) {
        this.connectionState = 'error';
        this.errorMessage = '状态刷新失败，当前为上次记录；请检查网络或重新连接';
        this.scheduleReconnect();
      }
    } finally {
      if (this.isCurrent(client)) {
        this.refreshing = false;
        this.emit();
      }
    }
  }

  public async loadHistory(loadMore: boolean = false): Promise<void> {
    const client: EdgeClient | undefined = this.client;
    if (this.stopped || this.historyLoading) {
      return;
    }
    if (client === undefined || this.connectionState !== 'connected') {
      this.historyError = '尚未连接，无法读取边缘服务的事件档案';
      this.emit();
      return;
    }
    this.historyLoading = true;
    this.historyError = '';
    const offset: number = loadMore ? this.historyOffset : 0;
    this.emit();
    try {
      const events: AlertEvent[] = await client.getEvents(200, offset);
      if (!this.isCurrent(client)) {
        return;
      }
      // Merge live messages received while the archive request was pending.
      this.history = mergeEvents(this.history, events);
      this.historyOffset = offset + events.length;
      this.historyHasMore = events.length === 200;
      this.historyLoaded = true;
      if (this.selectedAlert !== undefined) {
        this.selectedAlert = this.history.find((event: AlertEvent): boolean =>
          event.event_id === this.selectedAlert?.event_id) ?? this.selectedAlert;
      }
    } catch (_) {
      if (this.isCurrent(client)) {
        this.historyError = '事件档案加载失败，已保留上次记录；请重试';
      }
    } finally {
      if (this.isCurrent(client)) {
        this.historyLoading = false;
        this.emit();
      }
    }
  }

  public async pause(): Promise<void> {
    await this.runSafetyAction('pause');
  }

  public async estop(): Promise<void> {
    await this.runSafetyAction('estop');
  }

  public async setControlMode(mode: ControlMode): Promise<string> {
    const client: EdgeClient | undefined = this.beginAction('mode');
    if (client === undefined) {
      return this.unavailableMessage();
    }
    const revision: number = this.controlRevision;
    const safetyRevision: number = this.snapshotRevision;
    try {
      const response: ControlTaskResponse = await client.setControlMode(mode);
      return this.completeControl(client, response, revision, safetyRevision, '控制模式已切换');
    } catch (_) {
      return this.failAction(client, '模式切换失败，请检查连接和现场安全状态');
    } finally {
      this.finishAction(client);
    }
  }

  public async submitTask(text: string, source: 'APP' | 'VOICE'): Promise<string> {
    if (text.trim().length === 0) {
      return '请输入巡检任务';
    }
    const client: EdgeClient | undefined = this.beginAction('task');
    if (client === undefined) {
      return this.unavailableMessage();
    }
    const revision: number = this.controlRevision;
    const safetyRevision: number = this.snapshotRevision;
    try {
      const response: ControlTaskResponse = await client.submitTask(text.trim(), source);
      return this.completeControl(client, response, revision, safetyRevision, '任务已受理');
    } catch (_) {
      return this.failAction(client, '任务未确认，请检查连接及智能任务模式后重试');
    } finally {
      this.finishAction(client);
    }
  }

  public async manualVelocity(linearX: number, angularZ: number): Promise<void> {
    const client: EdgeClient | undefined = this.beginAction('manual');
    if (client === undefined) {
      return;
    }
    const revision: number = this.controlRevision;
    const safetyRevision: number = this.snapshotRevision;
    try {
      const response: ControlTaskResponse = await client.manualVelocity(linearX, angularZ);
      this.completeControl(client, response, revision, safetyRevision, '短时手动指令已确认');
    } catch (_) {
      this.failAction(client, '手动指令未确认，请检查连接和现场安全状态');
    } finally {
      this.finishAction(client);
    }
  }

  public async acknowledge(eventId: string): Promise<AckResult> {
    if (eventId.trim().length === 0) {
      return { kind: 'failed', message: '尚未选择告警' };
    }
    const client: EdgeClient | undefined = this.beginAction('ack');
    if (client === undefined) {
      return { kind: 'failed', message: this.unavailableMessage() };
    }
    this.ackResult = undefined;
    const selection: number = this.evidenceRequest;
    try {
      const result: AckResult = await client.ack(eventId);
      if (!this.isCurrent(client)) {
        return { kind: 'failed', message: '连接已变更，请刷新事件状态' };
      }
      if (result.kind === 'acknowledged' && result.event !== undefined) {
        this.recordAlert(result.event);
      }
      if (this.selectedAlert?.event_id === eventId && selection === this.evidenceRequest) {
        this.ackResult = result;
      }
      return result;
    } finally {
      this.finishAction(client);
    }
  }

  public async selectAlert(event: AlertEvent): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.selectedAlert = this.history.find((item: AlertEvent): boolean => item.event_id === event.event_id) ?? event;
    this.ackResult = undefined;
    this.clearReplay();
    await this.loadEvidence();
  }

  public async loadReplay(): Promise<void> {
    const eventId: string | undefined = this.selectedAlert?.event_id;
    const client: EdgeClient | undefined = this.client;
    if (this.stopped || eventId === undefined || this.replayLoading) {
      return;
    }
    if (client === undefined || this.connectionState !== 'connected') {
      this.replayError = '当前离线，恢复连接后可读取事件回放';
      this.emit();
      return;
    }
    const request: number = ++this.replayRequest;
    this.replayLoading = true;
    this.replayError = '';
    this.emit();
    try {
      const replay: EventReplay = await client.getReplay(eventId);
      if (this.isCurrent(client) && request === this.replayRequest && this.selectedAlert?.event_id === eventId) {
        this.replay = replay;
      }
    } catch (_) {
      if (this.isCurrent(client) && request === this.replayRequest) {
        this.replayError = '事件回放加载失败，请重试';
      }
    } finally {
      if (this.isCurrent(client) && request === this.replayRequest) {
        this.replayLoading = false;
        this.emit();
      }
    }
  }

  public async loadEvidence(): Promise<void> {
    const selected: AlertEvent | undefined = this.selectedAlert;
    if (selected === undefined || this.stopped) {
      return;
    }
    const request: number = ++this.evidenceRequest;
    const client: EdgeClient | undefined = this.client;
    this.evidence = undefined;
    this.evidenceError = '';
    this.evidenceLoading = false;
    if (client === undefined || this.connectionState !== 'connected') {
      this.evidenceError = '当前离线，证据需要连接边缘服务后加载';
      this.emit();
      return;
    }
    this.evidenceLoading = true;
    this.emit();
    try {
      const evidence: EventEvidence = await client.getEvidence(selected.event_id);
      if (this.isCurrent(client) && request === this.evidenceRequest
        && this.selectedAlert?.event_id === selected.event_id) {
        if (evidence.event_id !== selected.event_id) {
          throw new Error('Evidence event mismatch');
        }
        this.evidence = evidence;
        if (evidence.event !== undefined) {
          this.recordAlert(evidence.event);
        }
      }
    } catch (_) {
      if (this.isCurrent(client) && request === this.evidenceRequest) {
        this.evidenceError = '证据加载失败，事件摘要已保留，请重试';
      }
    } finally {
      if (this.isCurrent(client) && request === this.evidenceRequest) {
        this.evidenceLoading = false;
        this.emit();
      }
    }
  }

  public clearAlertSelection(): void {
    this.evidenceRequest++;
    this.selectedAlert = undefined;
    this.evidence = undefined;
    this.evidenceLoading = false;
    this.evidenceError = '';
    this.ackResult = undefined;
    this.clearReplay();
    this.emit();
  }

  public async dispose(): Promise<void> {
    this.stopped = true;
    this.generation++;
    this.evidenceRequest++;
    this.clearReplay();
    this.cancelReconnect();
    this.cancelHealth();
    const client: EdgeClient | undefined = this.client;
    this.client = undefined;
    await client?.disconnect();
  }

  private async connectConfigured(): Promise<void> {
    const pairing: PairingConfig | undefined = this.pairing;
    if (this.stopped || pairing === undefined) {
      return;
    }
    const generation: number = ++this.generation;
    this.cancelReconnect();
    this.cancelHealth();
    const oldClient: EdgeClient | undefined = this.client;
    this.client = undefined;
    this.refreshing = false;
    this.historyLoading = false;
    this.evidenceLoading = false;
    this.evidenceRequest++;
    this.clearReplay();
    if (this.busyAction !== 'pairing') {
      this.busyAction = '';
    }
    this.connectionState = 'connecting';
    this.errorMessage = '';
    this.emit();
    await oldClient?.disconnect();
    if (this.stopped || generation !== this.generation) {
      return;
    }
    const client: EdgeClient = new EdgeClient(pairing);
    this.client = client;
    try {
      const snapshot: SystemSnapshot = await client.getSnapshot();
      if (!this.isCurrent(client)) {
        return;
      }
      this.applySnapshot(snapshot);
      await client.connect(
        (message: RoutedEdgeMessage): void => {
          if (this.isCurrent(client)) {
            this.handleMessage(message);
          }
        },
        (state: EdgeConnectionState): void => {
          if (this.isCurrent(client)) {
            this.handleConnectionState(state);
          }
        }
      );
    } catch (_) {
      if (this.isCurrent(client)) {
        this.connectionState = 'error';
        this.errorMessage = pairing.token !== undefined && (pairing.expiresAtMs ?? 0) <= Date.now()
          ? '配对令牌已过期，请重新扫描配对码'
          : '无法连接边缘服务，请检查现场局域网、服务地址或配对令牌';
        this.scheduleReconnect();
        this.emit();
      }
      return;
    }
    if (this.isCurrent(client)) {
      await this.loadSupportState(client);
    }
  }

  private async loadSupportState(client: EdgeClient): Promise<void> {
    const revision: number = this.controlRevision;
    try {
      const vision: VisionStatus = await client.getVisionStatus();
      if (this.isCurrent(client)) {
        this.visionStatus = vision;
      }
    } catch (_) {
      if (this.isCurrent(client)) {
        this.visionStatus = undefined;
      }
    }
    if (!this.isCurrent(client)) {
      return;
    }
    try {
      const control: ControlSnapshot = await client.getControlState();
      if (this.isCurrent(client) && revision === this.controlRevision) {
        this.applyControl(control, false);
      }
    } catch (_) {
      if (this.isCurrent(client)) {
        this.control = undefined;
        this.errorMessage = '控制状态暂不可用，请刷新后再执行控制';
      }
    }
    if (this.isCurrent(client)) {
      this.emit();
    }
  }

  private handleConnectionState(state: EdgeConnectionState): void {
    this.connectionState = state;
    if (state === 'connected') {
      this.reconnectAttempt = 0;
      this.cancelReconnect();
      this.errorMessage = '';
      this.scheduleHealth();
    } else if (state === 'error' || state === 'disconnected') {
      this.errorMessage = '连接已中断，正在自动重连；当前显示上次记录，无法远程控制';
      this.scheduleReconnect();
    }
    this.emit();
    if (state === 'connected') {
      // The native open callback may arrive after connect() has resolved.
      void this.loadHistory();
    }
  }

  private handleMessage(message: RoutedEdgeMessage): void {
    switch (message.kind) {
      case 'snapshot':
        if (message.snapshot !== undefined) {
          this.applySnapshot(message.snapshot);
        }
        break;
      case 'alert':
        if (message.event !== undefined) {
          this.recordAlert(message.event);
          if (message.alertUpdated !== true && this.snapshot !== undefined) {
            this.snapshot.alert = this.history.find((event: AlertEvent): boolean =>
              event.event_id === message.event?.event_id) ?? message.event;
          }
        }
        break;
      case 'vision':
        this.latestDetection = message.vision;
        break;
      case 'control':
        if (message.control !== undefined) {
          this.applyControl(message.control);
        }
        break;
      case 'twin':
        break;
    }
    this.emit();
  }

  private applySnapshot(snapshot: SystemSnapshot): void {
    this.snapshotRevision++;
    this.snapshot = snapshot;
    this.lastUpdatedAt = Date.now();
    if (snapshot.alert !== undefined && snapshot.alert !== null) {
      this.recordAlert(snapshot.alert);
    }
  }

  private applyControl(control: ControlSnapshot, syncSafety: boolean = true): void {
    this.controlRevision++;
    this.control = control;
    // Safety snapshots remain authoritative. A control response carries a real
    // server safety state too, so the home and safety pages must agree with it.
    if (syncSafety && this.snapshot !== undefined) {
      this.snapshot = {
        service: this.snapshot.service, version: this.snapshot.version,
        ros_connected: control.ros_connected, boards_online: this.snapshot.boards_online,
        alert: this.snapshot.alert, links: this.snapshot.links,
        safety: {
          state: control.safety_state, patrol_name: this.snapshot.safety.patrol_name,
          patrol_progress: this.snapshot.safety.patrol_progress
        }
      };
      this.snapshotRevision++;
    }
    this.lastUpdatedAt = Date.now();
  }

  private recordAlert(event: AlertEvent): void {
    this.history = mergeEvents(this.history, [event]);
    const saved: AlertEvent = this.history.find((item: AlertEvent): boolean => item.event_id === event.event_id) ?? event;
    if (this.selectedAlert?.event_id === saved.event_id) {
      this.selectedAlert = saved;
    }
    if (this.snapshot?.alert?.event_id === saved.event_id) {
      this.snapshot.alert = saved;
    }
  }

  private async runSafetyAction(action: string): Promise<void> {
    const client: EdgeClient | undefined = this.beginAction(action);
    if (client === undefined) {
      return;
    }
    const revision: number = this.snapshotRevision;
    try {
      const snapshot: SystemSnapshot = action === 'estop' ? await client.estop() : await client.pause();
      if (this.isCurrent(client)) {
        if (revision === this.snapshotRevision) {
          this.applySnapshot(snapshot);
        }
        const target: string = action === 'estop' ? 'ESTOP_LATCHED' : 'PAUSED';
        if (snapshot.safety.state === target) {
          this.actionMessage = action === 'estop' ? '服务器已确认急停锁存，请执行现场处置流程' : '服务器已确认暂停巡检';
        } else {
          this.failAction(client, '服务返回的安全状态与请求不一致，请立即核实现场状态');
        }
        // Synchronise control-state gates without inventing a local transition.
        await this.loadSupportState(client);
      }
    } catch (_) {
      this.failAction(client, action === 'estop'
        ? '急停请求未确认，请立即使用现场急停装置并检查连接'
        : '暂停请求未确认，请检查连接后重试');
    } finally {
      this.finishAction(client);
    }
  }

  private beginAction(action: string): EdgeClient | undefined {
    if (this.stopped || this.busyAction.length > 0) {
      return undefined;
    }
    if (this.client === undefined || this.connectionState !== 'connected') {
      this.errorMessage = '当前离线，请恢复连接后重试；紧急情况请使用现场急停装置';
      this.emit();
      return undefined;
    }
    this.busyAction = action;
    this.errorMessage = '';
    this.actionMessage = '';
    this.emit();
    return this.client;
  }

  private completeControl(client: EdgeClient, response: ControlTaskResponse, revision: number, safetyRevision: number, fallback: string): string {
    if (!this.isCurrent(client)) {
      return '连接已变更，请重新核对任务状态';
    }
    if (response.state !== undefined && revision === this.controlRevision) {
      this.applyControl(response.state, safetyRevision === this.snapshotRevision);
    }
    if (response.result?.accepted !== true) {
      return this.failAction(client, response.result?.spoken_response ?? response.result?.reason ?? '服务器未确认该操作，请核对现场状态');
    }
    this.actionMessage = response.result.spoken_response ?? response.plan?.explanation ?? fallback;
    this.errorMessage = '';
    return this.actionMessage;
  }

  private failAction(client: EdgeClient, message: string): string {
    if (this.isCurrent(client)) {
      this.errorMessage = message;
      this.actionMessage = '';
    }
    return message;
  }

  private finishAction(client: EdgeClient): void {
    if (this.isCurrent(client)) {
      this.busyAction = '';
      this.emit();
    }
  }

  private unavailableMessage(): string {
    return this.busyAction.length > 0 ? '操作正在处理中，请稍候' : '当前未连接边缘服务';
  }

  private isCurrent(client: EdgeClient): boolean {
    return !this.stopped && this.client === client;
  }

  private scheduleReconnect(): void {
    this.cancelHealth();
    if (this.stopped || this.pairing === undefined || this.reconnectTimer !== undefined) {
      return;
    }
    const generation: number = this.generation;
    const delay: number = Math.min(3000 * Math.pow(2, this.reconnectAttempt), 15000);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout((): void => {
      this.reconnectTimer = undefined;
      if (!this.stopped && generation === this.generation) {
        void this.connectConfigured();
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private scheduleHealth(): void {
    const client: EdgeClient | undefined = this.client;
    if (client === undefined || this.stopped || this.connectionState !== 'connected'
      || this.healthTimer !== undefined) {
      return;
    }
    this.healthTimer = setTimeout((): void => {
      this.healthTimer = undefined;
      if (this.isCurrent(client) && this.connectionState === 'connected') {
        void this.probeConnection(client);
      }
    }, 15000);
  }

  private async probeConnection(client: EdgeClient): Promise<void> {
    await this.refresh();
    if (this.isCurrent(client) && this.connectionState === 'connected') {
      this.scheduleHealth();
    }
  }

  private cancelHealth(): void {
    if (this.healthTimer !== undefined) {
      clearTimeout(this.healthTimer);
      this.healthTimer = undefined;
    }
  }

  private clearData(): void {
    this.snapshot = undefined;
    this.visionStatus = undefined;
    this.control = undefined;
    this.latestDetection = undefined;
    this.selectedAlert = undefined;
    this.evidence = undefined;
    this.history = [];
    this.historyLoaded = false;
    this.historyError = '';
    this.historyHasMore = false;
    this.historyOffset = 0;
    this.evidenceError = '';
    this.evidenceRequest++;
    this.lastUpdatedAt = 0;
    this.actionMessage = '';
    this.ackResult = undefined;
    this.clearReplay();
  }

  private clearReplay(): void {
    this.replayRequest++;
    this.replay = undefined;
    this.replayLoading = false;
    this.replayError = '';
  }

  private pairingErrorText(error: string | undefined): string {
    switch (error) {
      case 'service_url_invalid': return '配对内容中没有有效的 HTTP 服务地址';
      case 'token_expired_or_expiry_missing': return '配对令牌已过期或缺少有效期，请重新生成配对码';
      case 'pairing_payload_empty': return '请扫描二维码或粘贴配对内容';
      default: return '配对内容无法识别，请检查后重试';
    }
  }

  private emit(): void {
    if (this.stopped) {
      return;
    }
    this.listener({
      pairing: this.pairing, snapshot: this.snapshot, visionStatus: this.visionStatus,
      latestDetection: this.latestDetection, selectedAlert: this.selectedAlert,
      evidence: this.evidence, history: this.history.slice(), connectionState: this.connectionState,
      errorMessage: this.errorMessage, ackResult: this.ackResult, busyAction: this.busyAction,
      control: this.control, refreshing: this.refreshing, historyLoading: this.historyLoading,
      historyLoaded: this.historyLoaded, historyError: this.historyError, historyHasMore: this.historyHasMore,
      evidenceLoading: this.evidenceLoading, evidenceError: this.evidenceError,
      lastUpdatedAt: this.lastUpdatedAt, actionMessage: this.actionMessage,
      replay: this.replay, replayLoading: this.replayLoading, replayError: this.replayError
    });
  }
}
