import { Theme } from '../components/Theme';
import { scanBarcode, scanCore } from '@kit.ScanKit';
import { abilityAccessCtrl } from '@kit.AbilityKit';
import common from '@ohos.app.ability.common';
import {
  AckResult, AlertEvent, ControlMode, ControlSnapshot, EdgeConnectionState, EventEvidence, EventReplay,
  PairingConfig, PairingParseResult, SystemSnapshot, VisionDetection, VisionStatus
} from '../models/EdgeModels';
import AppStore, { AppStoreState } from '../store/AppStore';
import { BottomNav, BrandHeader, ConnectionNotice, NAV_ACTIONS, NAV_HISTORY, NAV_HOME } from '../components/SafetyComponents';
import { PairingPage } from './PairingPage';
import { SafetyHomePage } from './SafetyHomePage';
import { AlertDetailPage } from './AlertDetailPage';
import { SafetyActionsPage } from './SafetyActionsPage';
import { EventHistoryPage } from './EventHistoryPage';
import VoiceService, { VoiceState } from '../services/voice/VoiceService';

const DETAIL_VIEW: string = 'detail';

@Entry
@Component
struct Index {
  @State private currentView: string = NAV_HOME;
  @State private showPairing: boolean = false;
  @State private pairing: PairingConfig | undefined = undefined;
  @State private snapshot: SystemSnapshot | undefined = undefined;
  @State private visionStatus: VisionStatus | undefined = undefined;
  @State private latestDetection: VisionDetection | undefined = undefined;
  @State private selectedAlert: AlertEvent | undefined = undefined;
  @State private evidence: EventEvidence | undefined = undefined;
  @State private history: AlertEvent[] = [];
  @State private connectionState: EdgeConnectionState = 'disconnected';
  @State private errorMessage: string = '';
  @State private ackResult: AckResult | undefined = undefined;
  @State private busyAction: string = '';
  @State private scanBusy: boolean = false;
  @State private scanMessage: string = '';
  @State private voiceState: VoiceState = 'idle';
  @State private voiceMessage: string = '';
  @State private control: ControlSnapshot | undefined = undefined;
  @State private refreshing: boolean = false;
  @State private historyLoading: boolean = false;
  @State private historyLoaded: boolean = false;
  @State private historyError: string = '';
  @State private historyHasMore: boolean = false;
  @State private evidenceLoading: boolean = false;
  @State private evidenceError: string = '';
  @State private lastUpdatedAt: number = 0;
  @State private actionMessage: string = '';
  @State private replay: EventReplay | undefined = undefined;
  @State private replayLoading: boolean = false;
  @State private replayError: string = '';
  @State private historyLevel: string = 'ALL';
  @State private historyAcknowledgement: string = 'ALL';
  @State private historyKeyword: string = '';
  private detailOrigin: string = NAV_HOME;
  private active: boolean = false;
  private voiceStarting: boolean = false;
  private lastSpokenAlertId: string = '';
  private lastSpokenSafetyState: string = '';
  private appStore: AppStore | undefined;
  private abilityContext: common.Context | undefined;
  private voiceService: VoiceService | undefined;

  aboutToAppear(): void {
    this.active = true;
    const context: common.Context | undefined = AppStorage.get<common.Context>('abilityContext');
    if (context === undefined) {
      this.errorMessage = '未获取到应用上下文，请重新打开应用';
      return;
    }
    this.abilityContext = context;
    const voice: VoiceService = new VoiceService();
    this.voiceService = voice;
    voice.setListeners(
      (state: VoiceState, message: string): void => {
        if (this.active && this.voiceService === voice) {
          this.voiceState = state;
          this.voiceMessage = message;
        }
      },
      (text: string): void => {
        if (this.active && this.voiceService === voice) {
          void this.submitTask(text, 'VOICE');
        }
      }
    );
    const store: AppStore = new AppStore(context, (state: AppStoreState): void => {
      if (this.active && this.appStore === store) {
        this.applyStoreState(state);
      }
    });
    this.appStore = store;
    void store.start();
  }

  aboutToDisappear(): void {
    this.active = false;
    const store: AppStore | undefined = this.appStore;
    const voice: VoiceService | undefined = this.voiceService;
    this.appStore = undefined;
    this.voiceService = undefined;
    void store?.dispose();
    void voice?.dispose();
  }

  onBackPress(): boolean {
    if (this.showPairing && this.pairing !== undefined) {
      if (!this.scanBusy && this.busyAction !== 'pairing' && this.busyAction !== 'clearPairing') {
        this.closePairing();
      }
      return true;
    }
    if (this.currentView === DETAIL_VIEW && !this.showPairing) {
      this.closeAlert();
      return true;
    }
    return false;
  }

  build() {
    Column() {
      if (this.pairing === undefined || this.showPairing) {
        PairingPage({
          pairing: this.pairing, connectionState: this.connectionState,
          errorMessage: this.scanMessage.length > 0 ? this.scanMessage : this.errorMessage,
          busy: this.scanBusy || this.busyAction.length > 0,
          onScan: () => { void this.scanPairing(); },
          onPair: (payload: string): void => { void this.pairPayload(payload); },
          onBack: () => this.closePairing(),
          onClear: () => { void this.clearPairing(); },
          onReconnect: () => { void this.appStore?.reconnect(); }
        })
          .layoutWeight(1);
      } else {
        BrandHeader({ connectionState: this.connectionState, serviceUrl: this.pairing.serviceUrl,
          onPairing: () => {
            void this.voiceService?.stopListening();
            this.showPairing = true;
            this.scanMessage = '';
          } });
        ConnectionNotice({ connectionState: this.connectionState, busy: this.busyAction.length > 0,
          onReconnect: () => { void this.appStore?.reconnect(); } });
        if (this.currentView === DETAIL_VIEW) {
          AlertDetailPage({
            event: this.selectedAlert, evidence: this.evidence, busyAction: this.busyAction,
            ackResult: this.ackResult, connectionState: this.connectionState,
            evidenceLoading: this.evidenceLoading, evidenceError: this.evidenceError,
            replay: this.replay, replayLoading: this.replayLoading, replayError: this.replayError,
            serviceUrl: this.pairing.serviceUrl,
            onBack: () => this.closeAlert(),
            onAcknowledge: (eventId: string): void => { void this.appStore?.acknowledge(eventId); },
            onRetryEvidence: () => { void this.appStore?.loadEvidence(); },
            onLoadReplay: () => { void this.appStore?.loadReplay(); }
          })
            .layoutWeight(1);
        } else {
          if (this.currentView === NAV_HOME) {
            SafetyHomePage({
              snapshot: this.snapshot, visionStatus: this.visionStatus, latestAlert: this.latestAlert(),
              latestDetection: this.latestDetection, connectionState: this.connectionState,
              busyAction: this.busyAction, errorMessage: this.errorMessage, actionMessage: this.actionMessage,
              refreshing: this.refreshing, lastUpdatedAt: this.lastUpdatedAt, historyLoaded: this.historyLoaded,
              onOpenAlert: (event: AlertEvent): void => this.openAlert(event),
              onOpenActions: () => { this.navigate(NAV_ACTIONS); },
              onOpenHistory: () => { this.navigate(NAV_HISTORY); },
              onPause: () => { void this.appStore?.pause(); },
              onRefresh: () => { void this.appStore?.refresh(); },
              control: this.control, voiceState: this.voiceState, voiceMessage: this.voiceMessage,
              onMode: (mode: ControlMode): void => { void this.setControlMode(mode); },
              onTask: (text: string, source: 'APP' | 'VOICE'): Promise<string> => this.submitTask(text, source),
              onManual: (linearX: number, angularZ: number): void => { void this.appStore?.manualVelocity(linearX, angularZ); },
              onVoice: (): void => { void this.toggleVoice(); }
            })
              .layoutWeight(1);
          } else if (this.currentView === NAV_HISTORY) {
            EventHistoryPage({
              events: this.history, connectionState: this.connectionState,
              loading: this.historyLoading, loaded: this.historyLoaded,
              errorMessage: this.historyError, hasMore: this.historyHasMore,
              level: this.historyLevel, acknowledgement: this.historyAcknowledgement, keyword: this.historyKeyword,
              onLevel: (value: string): void => { this.historyLevel = value; },
              onAcknowledgement: (value: string): void => { this.historyAcknowledgement = value; },
              onKeyword: (value: string): void => { this.historyKeyword = value; },
              onResetFilters: () => this.resetFilters(),
              onRefresh: () => { void this.appStore?.loadHistory(); },
              onLoadMore: () => { void this.appStore?.loadHistory(true); },
              onSelect: (event: AlertEvent): void => this.openAlert(event)
            })
              .layoutWeight(1);
          } else {
            SafetyActionsPage({
              snapshot: this.snapshot, connectionState: this.connectionState, busyAction: this.busyAction,
              errorMessage: this.errorMessage, actionMessage: this.actionMessage, lastUpdatedAt: this.lastUpdatedAt,
              onPause: () => { void this.appStore?.pause(); }, onEstop: () => { void this.appStore?.estop(); }
            })
              .layoutWeight(1);
          }
          BottomNav({ selected: this.currentView, onSelect: (view: string): void => this.navigate(view) });
        }
      }
    }
    .width('100%').height('100%').backgroundColor(Theme.background);
  }

  private applyStoreState(state: AppStoreState): void {
    this.speakFixedSafetyEvents(state);
    this.pairing = state.pairing;
    this.snapshot = state.snapshot;
    this.visionStatus = state.visionStatus;
    this.latestDetection = state.latestDetection;
    this.selectedAlert = state.selectedAlert;
    this.evidence = state.evidence;
    this.history = state.history;
    this.connectionState = state.connectionState;
    this.errorMessage = state.errorMessage;
    this.ackResult = state.ackResult;
    this.busyAction = state.busyAction;
    this.control = state.control;
    this.refreshing = state.refreshing;
    this.historyLoading = state.historyLoading;
    this.historyLoaded = state.historyLoaded;
    this.historyError = state.historyError;
    this.historyHasMore = state.historyHasMore;
    this.evidenceLoading = state.evidenceLoading;
    this.evidenceError = state.evidenceError;
    this.lastUpdatedAt = state.lastUpdatedAt;
    this.actionMessage = state.actionMessage;
    this.replay = state.replay;
    this.replayLoading = state.replayLoading;
    this.replayError = state.replayError;
  }

  private speakFixedSafetyEvents(state: AppStoreState): void {
    if (state.connectionState !== 'connected') {
      return;
    }
    const event: AlertEvent | null | undefined = state.snapshot?.alert;
    if (event !== undefined && event !== null && event.acked !== true && event.event_id !== this.lastSpokenAlertId
      && (event.level === 'P1' || event.level === 'P2' || event.level === 'P3')) {
      this.lastSpokenAlertId = event.event_id;
      void this.voiceService?.speak('检测到火情告警，请立即确认现场安全');
    }
    const stateName: string | undefined = state.snapshot?.safety.state;
    if (stateName !== undefined && stateName !== this.lastSpokenSafetyState) {
      this.lastSpokenSafetyState = stateName;
      if (stateName === 'ESTOP_LATCHED') {
        void this.voiceService?.speak('急停已锁存，请执行现场授权解除流程');
      } else if (stateName === 'PAUSED') {
        void this.voiceService?.speak('已暂停巡检');
      }
    }
  }

  private latestAlert(): AlertEvent | undefined {
    return this.history.length > 0 ? this.history[0] : this.snapshot?.alert ?? undefined;
  }

  private navigate(view: string): void {
    if (this.voiceState === 'listening') {
      void this.voiceService?.stopListening();
    }
    this.currentView = view;
    if (view === NAV_HISTORY && (!this.historyLoaded || this.historyError.length > 0)) {
      void this.appStore?.loadHistory();
    }
  }

  private resetFilters(): void {
    this.historyLevel = 'ALL';
    this.historyAcknowledgement = 'ALL';
    this.historyKeyword = '';
  }

  private closePairing(): void {
    this.showPairing = false;
    this.scanMessage = '';
  }

  private async pairPayload(payload: string): Promise<void> {
    const store: AppStore | undefined = this.appStore;
    if (store === undefined || this.busyAction.length > 0) {
      return;
    }
    this.showPairing = true;
    this.scanMessage = '';
    const result: PairingParseResult = await store.pair(payload);
    if (this.active && this.appStore === store && result.error === undefined && this.connectionState === 'connected') {
      this.lastSpokenAlertId = '';
      this.lastSpokenSafetyState = '';
      this.resetFilters();
      this.currentView = NAV_HOME;
      this.showPairing = false;
    }
  }

  private async clearPairing(): Promise<void> {
    await this.voiceService?.stopListening();
    const store: AppStore | undefined = this.appStore;
    await store?.clearPairing();
    if (this.active && this.appStore === store && this.pairing === undefined) {
      this.currentView = NAV_HOME;
      this.showPairing = false;
      this.lastSpokenAlertId = '';
      this.lastSpokenSafetyState = '';
      this.resetFilters();
    }
  }

  private async scanPairing(): Promise<void> {
    const store: AppStore | undefined = this.appStore;
    if (this.scanBusy || this.busyAction.length > 0 || store === undefined || this.abilityContext === undefined) {
      return;
    }
    this.scanBusy = true;
    this.scanMessage = '';
    try {
      const result: scanBarcode.ScanResult = await scanBarcode.startScanForResult(this.abilityContext, {
        scanTypes: [scanCore.ScanType.QR_CODE], enableMultiMode: false, enableAlbum: false
      });
      if (this.active && this.appStore === store) {
        await this.pairPayload(result.originalValue);
      }
    } catch (_) {
      if (this.active && this.appStore === store) {
        this.scanMessage = '扫描已取消或暂不可用，可重新扫码或手动粘贴配对内容';
      }
    } finally {
      if (this.active && this.appStore === store) {
        this.scanBusy = false;
      }
    }
  }

  private openAlert(event: AlertEvent): void {
    this.detailOrigin = this.currentView;
    this.currentView = DETAIL_VIEW;
    void this.voiceService?.stopListening();
    void this.appStore?.selectAlert(event);
  }

  private closeAlert(): void {
    this.currentView = this.detailOrigin;
    this.appStore?.clearAlertSelection();
  }

  private async setControlMode(mode: ControlMode): Promise<void> {
    const store: AppStore | undefined = this.appStore;
    if (mode !== 'LOBSTER_AI') {
      await this.voiceService?.stopListening();
    }
    const feedback: string = store === undefined ? '当前未连接边缘服务' : await store.setControlMode(mode);
    if (this.active && this.appStore === store) {
      await this.voiceService?.speak(feedback);
    }
  }

  private async submitTask(text: string, source: 'APP' | 'VOICE'): Promise<string> {
    const store: AppStore | undefined = this.appStore;
    if (this.showPairing || this.currentView !== NAV_HOME || this.control?.mode !== 'LOBSTER_AI') {
      return '请在巡检总览的智能任务模式下提交任务';
    }
    const feedback: string = store === undefined ? '当前未连接边缘服务' : await store.submitTask(text, source);
    if (this.active && this.appStore === store) {
      await this.voiceService?.speak(feedback);
    }
    return feedback;
  }

  private async toggleVoice(): Promise<void> {
    const voice: VoiceService | undefined = this.voiceService;
    if (voice === undefined || this.voiceStarting) {
      return;
    }
    if (this.voiceState === 'listening') {
      await voice.stopListening();
      return;
    }
    if (this.connectionState !== 'connected' || this.busyAction.length > 0 || this.control?.mode !== 'LOBSTER_AI'
      || this.snapshot?.safety.state === 'ESTOP_LATCHED' || this.snapshot?.safety.state === 'FAULT') {
      return;
    }
    this.voiceStarting = true;
    try {
      const result = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(
        this.abilityContext as common.UIAbilityContext, ['ohos.permission.MICROPHONE']
      );
      if (!this.active || this.voiceService !== voice) {
        return;
      }
      if (result.authResults[0] !== 0) {
        this.voiceState = 'error';
        this.voiceMessage = '麦克风权限未开启，可手动输入任务';
        return;
      }
      if (this.connectionState === 'connected' && !this.showPairing && this.currentView === NAV_HOME) {
        await voice.startListening();
      }
    } catch (_) {
      if (this.active) {
        this.voiceState = 'error';
        this.voiceMessage = '语音输入暂不可用，可手动输入任务';
      }
    } finally {
      this.voiceStarting = false;
    }
  }
}
