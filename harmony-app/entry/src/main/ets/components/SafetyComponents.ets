import { Theme } from './Theme';
import { AlertEvent, AlertLevel, ControlMode, EdgeConnectionState, SafetyState, SystemSnapshot } from '../models/EdgeModels';

export const NAV_HOME: string = 'home';
export const NAV_HISTORY: string = 'history';
export const NAV_ACTIONS: string = 'actions';

export function alertTitle(level: AlertLevel): string {
  switch (level) {
    case 'P1': return 'P1 紧急告警';
    case 'P2': return 'P2 多源异常';
    case 'P3': return 'P3 视觉复核';
    case 'CLEARED': return '事件已清除';
    default: return '正常记录';
  }
}

export function safetyTitle(state: SafetyState | undefined): string {
  switch (state) {
    case 'PATROLLING': return '巡检中';
    case 'PAUSED': return '已暂停';
    case 'ESTOP_LATCHED': return '急停已锁存';
    case 'FAULT': return '系统故障';
    case 'READY': return '待命';
    default: return '状态未知';
  }
}

export function modeTitle(mode: ControlMode | undefined): string {
  switch (mode) {
    case 'FIXED_PATROL': return '固定循迹';
    case 'MANUAL': return '手动控制';
    case 'LOBSTER_AI': return '智能任务';
    default: return '待同步';
  }
}

export function timeText(value: string | undefined): string {
  if (value === undefined) {
    return '时间未提供';
  }
  const date: Date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function severityColor(level: AlertLevel): string {
  switch (level) {
    case 'P1': return Theme.danger;
    case 'P2':
    case 'P3': return Theme.warning;
    case 'CLEARED': return Theme.lime;
    default: return Theme.secondary;
  }
}

function severityBackground(level: AlertLevel): string {
  switch (level) {
    case 'P1': return Theme.dangerSurface;
    case 'P2':
    case 'P3': return Theme.warningSurface;
    case 'CLEARED': return Theme.accentSurface;
    default: return Theme.elevated;
  }
}

function connectionTitle(state: EdgeConnectionState): string {
  switch (state) {
    case 'connected': return '边缘在线';
    case 'connecting': return '正在连接';
    case 'error': return '连接中断';
    default: return '未连接';
  }
}

@Component
export struct BrandHeader {
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop serviceUrl: string = '';
  onPairing: () => void = () => {};

  build() {
    Column({ space: 14 }) {
      Row({ space: 12 }) {
        Image($r('app.media.brand_shield'))
          .width(40).height(40).objectFit(ImageFit.Contain);
        Column({ space: 4 }) {
          Text('智巡消防').fontSize(21).fontWeight(FontWeight.Bold).fontColor(Theme.text);
          Text('ZHIXUN FIRE').fontSize(10).letterSpacing(2.2).fontColor(Theme.muted);
        }
        .alignItems(HorizontalAlign.Start).layoutWeight(1);
        Button('配对管理')
          .fontSize(13).fontColor(Theme.lime).backgroundColor(Theme.elevated)
          .border({ width: 1, color: Theme.line })
          .borderRadius(12).height(48).padding({ left: 15, right: 15 })
          .onClick(() => this.onPairing());
      }
      .width('100%');
      Row({ space: 7 }) {
        Circle({ width: 7, height: 7 }).fill(this.connectionState === 'connected' ? Theme.lime : Theme.warning);
        Text(connectionTitle(this.connectionState))
          .fontSize(12).fontColor(this.connectionState === 'connected' ? Theme.lime : Theme.warning);
        Text(this.serviceUrl)
          .fontSize(12).fontColor(Theme.muted).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1).textAlign(TextAlign.End);
      }
      .width('100%');
    }
    .width('100%').padding({ left: 22, right: 22, top: 12, bottom: 16 })
    .backgroundColor(Theme.background).border({ width: { bottom: 1 }, color: Theme.line });
  }
}

@Component
export struct ConnectionNotice {
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop busy: boolean = false;
  onReconnect: () => void = () => {};

  build() {
    if (this.connectionState !== 'connected') {
      Row({ space: 10 }) {
        Column({ space: 4 }) {
          Text(this.connectionState === 'connecting' ? '正在连接现场服务' : '连接已中断 · 现场状态待核实')
            .fontSize(14).fontWeight(FontWeight.Bold).fontColor(Theme.warning);
          Text('显示上次记录，远程操作不可用。紧急情况请使用现场急停装置。')
            .fontSize(12).lineHeight(17).fontColor(Theme.warning);
        }
        .alignItems(HorizontalAlign.Start).layoutWeight(1);
        Button(this.connectionState === 'connecting' ? '连接中' : '重连')
          .fontSize(14).fontColor(Theme.warning).backgroundColor(Theme.surface)
          .borderRadius(9).height(48).padding({ left: 14, right: 14 })
          .enabled(this.connectionState !== 'connecting' && !this.busy)
          .onClick(() => this.onReconnect());
      }
      .width('100%').padding({ left: 18, right: 18, top: 10, bottom: 10 })
      .backgroundColor(Theme.warningSurface);
    }
  }
}

@Component
export struct SeverityBadge {
  @Prop level: AlertLevel = 'NORMAL';

  build() {
    Text(this.level === 'NORMAL' ? '正常' : this.level === 'CLEARED' ? '已清除' : this.level)
      .fontSize(13).fontWeight(FontWeight.Bold).fontColor(severityColor(this.level))
      .backgroundColor(severityBackground(this.level)).borderRadius(6)
      .padding({ left: 10, right: 10, top: 6, bottom: 6 });
  }
}

@Component
export struct MetricTile {
  @Prop label: string = '';
  @Prop value: string = '--';
  @Prop tone: string = 'navy';

  build() {
    Column({ space: 12 }) {
      Text(this.label).fontSize(12).fontColor(Theme.secondary).maxLines(1);
      Text(this.value)
        .fontSize(23).minFontSize(15).maxFontSize(23).maxLines(1)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.tone === 'orange' ? Theme.warning : this.tone === 'green' ? Theme.lime : Theme.text);
    }
    .alignItems(HorizontalAlign.Start).layoutWeight(1).padding({ left: 13, right: 13, top: 16, bottom: 16 })
    .backgroundColor(Theme.surface).border({ width: 1, color: Theme.line }).borderRadius(16);
  }
}

@Component
export struct SafetyBanner {
  @Prop snapshot: SystemSnapshot | undefined = undefined;
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop lastUpdatedAt: number = 0;

  private isEmergency(): boolean {
    return this.snapshot?.safety.state === 'ESTOP_LATCHED' || this.snapshot?.safety.state === 'FAULT';
  }

  private needsVerification(): boolean {
    return this.connectionState !== 'connected' || this.snapshot?.ros_connected !== true;
  }

  private hasSafetyRecord(): boolean {
    return this.isEmergency() || this.snapshot?.safety.state === 'PAUSED';
  }

  private statusTitle(): string {
    if (this.connectionState !== 'connected') {
      return this.hasSafetyRecord() ? `上次记录：${safetyTitle(this.snapshot?.safety.state)}` : '现场状态待核实';
    }
    const state: SafetyState | undefined = this.snapshot?.safety.state;
    if (this.snapshot?.ros_connected !== true && (state === 'PATROLLING' || state === 'READY')) {
      return '等待机器人连接';
    }
    return safetyTitle(state);
  }

  private statusDetail(): string {
    if (this.connectionState !== 'connected') {
      return '边缘服务未连接，现场状态待核实。';
    }
    if (this.snapshot?.ros_connected !== true) {
      return this.hasSafetyRecord()
        ? '边缘已记录该安全状态；机器人未连接，现场状态待核实。'
        : '边缘服务在线；机器人未连接，现场状态待核实。';
    }
    return this.snapshot?.safety.patrol_name ?? '巡检任务未提供';
  }

  build() {
    Column({ space: 12 }) {
      Row({ space: 8 }) {
        Circle({ width: 6, height: 6 })
          .fill(this.isEmergency() ? Theme.danger : this.needsVerification() ? Theme.warning : Theme.lime);
        Text('现场安全状态').fontSize(12).fontColor(Theme.secondary).layoutWeight(1);
        Text('SAFETY STATUS').fontSize(9).letterSpacing(1.5).fontColor(Theme.muted);
      }
      .width('100%');
      Column({ space: 8 }) {
          Text(this.statusTitle())
            .fontSize(22).fontWeight(FontWeight.Bold).fontColor(this.isEmergency() ? Theme.danger : Theme.text);
          Text(this.statusDetail())
            .fontSize(13).lineHeight(21).fontColor(Theme.secondary);
        }
        .alignItems(HorizontalAlign.Start).width('100%');
      Text(this.lastUpdatedAt > 0 ? `边缘状态同步于 ${new Date(this.lastUpdatedAt).toLocaleTimeString()}` : '尚未收到现场状态')
        .fontSize(12).fontColor(Theme.muted).width('100%')
        .padding({ top: 10 }).border({ width: { top: 1 }, color: Theme.line });
      if (this.snapshot?.safety.state === 'ESTOP_LATCHED') {
        Text('解除急停须通过现场授权流程。请先核实风险与人员安全。')
          .fontSize(13).lineHeight(19).fontColor(Theme.danger).width('100%');
      }
    }
    .width('100%').padding(18).backgroundColor(this.isEmergency() ? Theme.dangerSurface : Theme.surface)
    .border({ width: { left: 3, top: 1, right: 1, bottom: 1 },
      color: this.isEmergency() ? Theme.dangerLine : this.needsVerification() ? Theme.warningLine : Theme.line }).borderRadius(16);
  }
}

@Component
export struct AlertSummaryRow {
  @Prop event: AlertEvent = { event_id: 'unknown', level: 'NORMAL' };
  onSelect: () => void = () => {};

  build() {
    Row({ space: 12 }) {
      Column({ space: 8 }) {
        Row({ space: 8 }) {
          SeverityBadge({ level: this.event.level });
          Text(this.event.acked === true ? '已确认' : '待确认')
            .fontSize(13).fontWeight(FontWeight.Medium)
            .fontColor(this.event.acked === true ? Theme.lime : Theme.warning);
        }
        Text(this.event.event_id)
          .fontSize(14).fontWeight(FontWeight.Bold).fontColor(Theme.text)
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).width('100%');
        Text(`${this.event.source_id ?? '来源未提供'} · ${(this.event.trigger_bits ?? []).join(' / ') || '触发源未提供'}`)
          .fontSize(13).fontColor(Theme.secondary).maxLines(2).width('100%');
        Text(timeText(this.event.created_at)).fontSize(12).fontColor(Theme.secondary);
      }
      .alignItems(HorizontalAlign.Start).layoutWeight(1);
      Text('›').fontSize(27).fontColor(Theme.lime).width(18).textAlign(TextAlign.Center);
    }
    .width('100%').padding(15).backgroundColor(Theme.surface)
    .border({ width: 1, color: this.event.level === 'P1' && this.event.acked !== true ? Theme.dangerLine : Theme.line })
    .borderRadius(16).onClick(() => this.onSelect())
    .accessibilityText(`${alertTitle(this.event.level)}，${this.event.acked === true ? '已确认' : '待确认'}，查看详情`);
  }
}

@Component
export struct BottomNav {
  @Prop selected: string = NAV_HOME;
  onSelect: (view: string) => void = (_: string) => {};

  @Builder
  private item(label: string, view: string, icon: Resource) {
    Button({ type: ButtonType.Normal }) {
      Column({ space: 6 }) {
        Image(icon).width(22).height(22).opacity(this.selected === view ? 1 : 0.6);
        Text(label).fontSize(12).fontWeight(this.selected === view ? FontWeight.Bold : FontWeight.Medium)
          .fontColor(this.selected === view ? Theme.lime : Theme.secondary);
      }
    }
      .backgroundColor(this.selected === view ? Theme.accentSurface : Theme.background)
      .borderRadius(14).layoutWeight(1).height(62).onClick(() => this.onSelect(view))
      .accessibilityText(label).accessibilitySelected(this.selected === view);
  }

  build() {
    Row({ space: 8 }) {
      this.item('巡检总览', NAV_HOME, $r('app.media.nav_overview'));
      this.item('事件档案', NAV_HISTORY, $r('app.media.nav_events'));
      this.item('安全操作', NAV_ACTIONS, $r('app.media.nav_safety'));
    }
    .width('100%').padding({ left: 22, right: 22, top: 10, bottom: 10 })
    .backgroundColor(Theme.background).border({ width: { top: 1 }, color: Theme.line });
  }
}

@Component
export struct SectionTitle {
  @Prop title: string = '';
  @Prop detail: string = '';

  build() {
    Row({ space: 10 }) {
      Text(this.title).fontSize(17).fontWeight(FontWeight.Bold).fontColor(Theme.text).layoutWeight(1);
      Text(this.detail).fontSize(12).fontColor(Theme.muted).maxLines(2).textAlign(TextAlign.End).constraintSize({ maxWidth: '48%' });
    }
    .width('100%').margin({ bottom: 12 });
  }
}

@Component
export struct FeedbackNotice {
  @Prop error: string = '';
  @Prop message: string = '';

  build() {
    if (this.error.length > 0 || this.message.length > 0) {
      Text(this.error.length > 0 ? this.error : this.message)
        .fontSize(14).lineHeight(20).fontColor(this.error.length > 0 ? Theme.danger : Theme.lime)
        .width('100%').padding(13).backgroundColor(this.error.length > 0 ? Theme.dangerSurface : Theme.accentSurface).borderRadius(12);
    }
  }
}
