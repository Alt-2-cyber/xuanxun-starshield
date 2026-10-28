import { Theme } from '../components/Theme';
import {
  AlertEvent, ControlMode, ControlSnapshot, EdgeConnectionState, VisionDetection, VisionStatus, SystemSnapshot
} from '../models/EdgeModels';
import { VoiceState } from '../services/voice/VoiceService';
import { AlertSummaryRow, FeedbackNotice, MetricTile, SafetyBanner, SectionTitle, modeTitle } from '../components/SafetyComponents';
import { RobotScene } from '../components/RobotScene';

function numberText(value: number | null | undefined, suffix: string): string {
  return value === undefined || value === null || !Number.isFinite(value) ? '--' : `${value.toFixed(1)}${suffix}`;
}

@Component
export struct SafetyHomePage {
  @Prop snapshot: SystemSnapshot | undefined = undefined;
  @Prop visionStatus: VisionStatus | undefined = undefined;
  @Prop latestAlert: AlertEvent | undefined = undefined;
  @Prop latestDetection: VisionDetection | undefined = undefined;
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop busyAction: string = '';
  @Prop errorMessage: string = '';
  @Prop actionMessage: string = '';
  @Prop refreshing: boolean = false;
  @Prop lastUpdatedAt: number = 0;
  @Prop historyLoaded: boolean = false;
  @Prop control: ControlSnapshot | undefined = undefined;
  @Prop voiceState: VoiceState = 'idle';
  @Prop voiceMessage: string = '';
  onOpenAlert: (event: AlertEvent) => void = (_: AlertEvent) => {};
  onOpenActions: () => void = () => {};
  onOpenHistory: () => void = () => {};
  onPause: () => void = () => {};
  onRefresh: () => void = () => {};
  onMode: (mode: ControlMode) => void = (_mode: ControlMode) => {};
  onTask: (text: string, source: 'APP' | 'VOICE') => Promise<string> = async (_text: string, _source: 'APP' | 'VOICE'): Promise<string> => '';
  onManual: (linearX: number, angularZ: number) => void = (_linearX: number, _angularZ: number) => {};
  onVoice: () => void = () => {};
  @State private taskText: string = '';

  private online(): boolean {
    return this.connectionState === 'connected';
  }

  private canControl(): boolean {
    return this.online() && this.busyAction.length === 0 && this.control !== undefined
      && this.snapshot !== undefined && this.snapshot.safety.state !== 'ESTOP_LATCHED'
      && this.snapshot.safety.state !== 'FAULT';
  }

  @Builder
  private modeButton(title: string, mode: ControlMode) {
    Button(title)
      .fontSize(14).fontWeight(FontWeight.Medium)
      .fontColor(this.control?.mode === mode ? Theme.ink : Theme.lime)
      .backgroundColor(this.control?.mode === mode ? Theme.lime : Theme.accentSurface)
      .borderRadius(12).height(48).layoutWeight(1)
      .enabled(this.canControl() && this.control?.mode !== mode)
      .onClick(() => this.onMode(mode));
  }

  @Builder
  private manualButton(title: string, linearX: number, angularZ: number) {
    Button(title)
      .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
      .borderRadius(12).height(52).layoutWeight(1)
      .enabled(this.canControl() && this.control?.ros_connected === true && this.control.obstacle_blocked !== true)
      .onClick(() => this.onManual(linearX, angularZ));
  }

  build() {
    Scroll() {
      Column({ space: 22 }) {
        Row({ space: 10 }) {
          Column({ space: 6 }) {
            Text('OPERATIONS / 01').fontSize(10).letterSpacing(1.8).fontColor(Theme.muted);
            Text('现场巡检').fontSize(30).fontWeight(FontWeight.Bold).fontColor(Theme.text);
            Text('每一程巡检，都清晰可见。').fontSize(13).fontColor(Theme.secondary);
          }
          .alignItems(HorizontalAlign.Start).layoutWeight(1);
          Button(this.refreshing ? '同步中' : '刷新状态')
            .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
            .borderRadius(12).height(48).padding({ left: 13, right: 13 })
            .enabled(this.online() && !this.refreshing)
            .onClick(() => this.onRefresh());
        }
        .width('100%');

        RobotScene({ connectionState: this.connectionState, rosConnected: this.snapshot?.ros_connected });
        SafetyBanner({ snapshot: this.snapshot, connectionState: this.connectionState, lastUpdatedAt: this.lastUpdatedAt });
        FeedbackNotice({ error: this.errorMessage, message: this.actionMessage });

        Row({ space: 8 }) {
          MetricTile({
            label: '板端在线',
            value: !this.online() || this.snapshot?.boards_online === undefined ? '--' : `${this.snapshot.boards_online}/5`,
            tone: this.online() && this.snapshot?.boards_online === 5 ? 'green' : 'orange'
          });
          MetricTile({
            label: '机器人链路',
            value: !this.online() ? '待核实' : this.snapshot?.ros_connected === true ? '在线' : this.snapshot?.ros_connected === false ? '未连接' : '未知',
            tone: this.online() && this.snapshot?.ros_connected === true ? 'green' : 'orange'
          });
          MetricTile({
            label: '视觉模型',
            value: !this.online() ? '待核实' : this.visionStatus?.loaded === true ? '就绪' : this.visionStatus?.loaded === false ? '未就绪' : '未知',
            tone: this.online() && this.visionStatus?.loaded === true ? 'green' : 'orange'
          });
        }
        .width('100%');

        Column() {
          SectionTitle({ title: '安全操作', detail: '现场风险优先' });
          Row({ space: 10 }) {
            Button(this.busyAction === 'pause' ? '请求确认中…' : '暂停巡检')
              .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
              .borderRadius(12).height(52).layoutWeight(1)
              .enabled(this.online() && this.busyAction.length === 0 && this.snapshot !== undefined
                && this.snapshot.safety.state !== 'ESTOP_LATCHED' && this.snapshot.safety.state !== 'PAUSED')
              .onClick(() => this.onPause());
            Button('急停 / 安全操作')
              .fontSize(14).fontWeight(FontWeight.Bold).fontColor(Theme.danger).backgroundColor(Theme.dangerSurface)
              .borderRadius(12).height(52).layoutWeight(1).onClick(() => this.onOpenActions());
          }
          .width('100%');
        }
        .width('100%');

        Column() {
          SectionTitle({ title: '最近事件', detail: this.historyLoaded ? '边缘档案已同步' : '档案待同步' });
          if (this.latestAlert !== undefined) {
            AlertSummaryRow({ event: this.latestAlert, onSelect: () => {
              if (this.latestAlert !== undefined) {
                this.onOpenAlert(this.latestAlert);
              }
            } });
          } else {
            Row({ space: 14 }) {
              Image($r('app.media.archive_empty')).width(52).height(48).objectFit(ImageFit.Contain);
              Column({ space: 6 }) {
                Text(this.historyLoaded ? '暂无告警事件' : '档案待同步')
                  .fontSize(16).fontWeight(FontWeight.Medium).fontColor(Theme.text);
                Text(this.historyLoaded ? '边缘档案已同步，等待新的现场记录。' : '连接后查看现场保存的告警记录。')
                  .fontSize(13).lineHeight(20).fontColor(Theme.secondary);
              }
              .alignItems(HorizontalAlign.Start).layoutWeight(1);
            }
            .width('100%').padding(18).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);
          }
          Button('查看事件档案 ›')
            .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
            .borderRadius(12).height(48).width('100%').margin({ top: 10 }).onClick(() => this.onOpenHistory());
        }
        .width('100%');

        Column() {
          SectionTitle({ title: '巡检控制', detail: !this.online() ? '现场状态待核实'
            : this.snapshot?.ros_connected === true ? modeTitle(this.control?.mode) : '等待机器人连接' });
          Row({ space: 7 }) {
            this.modeButton('固定循迹', 'FIXED_PATROL');
            this.modeButton('手动控制', 'MANUAL');
            this.modeButton('智能任务', 'LOBSTER_AI');
          }
          .width('100%');
          if (this.snapshot?.safety.state === 'ESTOP_LATCHED' || this.snapshot?.safety.state === 'FAULT') {
            Text('当前安全状态限制控制，请先完成现场处置。')
              .fontSize(13).fontColor(Theme.danger).lineHeight(19).width('100%').margin({ top: 12 });
          }
          if (this.control?.mode === 'LOBSTER_AI') {
            Column({ space: 10 }) {
              Text('输入巡检目标或语音任务，由现场服务确认执行。')
                .fontSize(13).fontColor(Theme.secondary).lineHeight(19).width('100%');
              TextInput({ placeholder: '如：去 B 区巡检点 / 暂停 / 返回起点', text: this.taskText })
                .fontSize(14).fontColor(Theme.text).backgroundColor(Theme.elevated).borderRadius(12)
                .placeholderColor(Theme.muted).caretColor(Theme.lime).border({ width: 1, color: Theme.line })
                .height(52).width('100%').enabled(this.canControl())
                .onChange((value: string) => { this.taskText = value; });
              Row({ space: 10 }) {
                Button(this.voiceState === 'listening' ? '停止聆听' : '语音输入')
                  .fontSize(14).fontColor(this.voiceState === 'listening' ? Theme.danger : Theme.lime)
                  .backgroundColor(this.voiceState === 'listening' ? Theme.dangerSurface : Theme.accentSurface)
                  .borderRadius(12).height(50).layoutWeight(1)
                  .enabled(this.voiceState === 'listening' || this.canControl())
                  .onClick(() => this.onVoice());
                Button(this.busyAction === 'task' ? '任务确认中…' : '下达任务')
                  .fontSize(14).fontColor(Theme.ink).backgroundColor(Theme.lime)
                  .borderRadius(12).height(50).layoutWeight(1)
                  .enabled(this.taskText.trim().length > 0 && this.canControl())
                  .onClick(() => { void this.onTask(this.taskText, 'APP'); });
              }
              .width('100%');
              if (this.voiceMessage.length > 0) {
                Text(this.voiceMessage).fontSize(13).lineHeight(19)
                  .fontColor(this.voiceState === 'error' ? Theme.danger : Theme.lime).width('100%');
              }
            }
            .width('100%').margin({ top: 14 });
          }
          if (this.control?.mode === 'MANUAL') {
            Column({ space: 10 }) {
              Text('每次轻触执行 350 毫秒短时移动。请保持现场视线。')
                .fontSize(13).lineHeight(19).fontColor(Theme.secondary).width('100%');
              Row({ space: 8 }) {
                this.manualButton('左转', 0, 0.55);
                this.manualButton('前进', 0.18, 0);
                this.manualButton('右转', 0, -0.55);
              }
              .width('100%');
              Button('停车')
                .fontSize(15).fontWeight(FontWeight.Bold).fontColor(Theme.danger).backgroundColor(Theme.dangerSurface)
                .borderRadius(12).height(52).width('100%')
                .enabled(this.online() && this.busyAction.length === 0)
                .onClick(() => this.onManual(0, 0));
              if (this.control.obstacle_blocked) {
                Text('避障已阻止移动，请核实现场障碍。').fontSize(13).fontColor(Theme.warning).width('100%');
              }
            }
            .width('100%').margin({ top: 14 });
          }
        }
        .width('100%').padding(18).backgroundColor(Theme.surface)
        .border({ width: 1, color: Theme.line }).borderRadius(16);

        Column() {
          SectionTitle({ title: '最近事件采样', detail: '历史采样，非实时读数' });
          Row({ space: 8 }) {
            MetricTile({ label: '温度', value: numberText(this.latestAlert?.sensor_values?.temperature_c, ' °C') });
            MetricTile({ label: '烟雾比', value: numberText(this.latestAlert?.sensor_values?.smoke_ratio, '') });
            MetricTile({ label: '气体比', value: numberText(this.latestAlert?.sensor_values?.gas_ratio, '') });
          }
          .width('100%');
        }
        .width('100%');

        Column({ space: 8 }) {
          SectionTitle({ title: '视觉复核', detail: this.online() ? this.visionStatus?.model_version ?? '状态待同步' : '上次记录' });
          Text(this.latestDetection?.label ?? '尚未收到视觉检测事件')
            .fontSize(15).fontWeight(FontWeight.Medium).fontColor(Theme.text).width('100%');
          Text(this.latestDetection?.confidence === undefined ? '事件照片与采样可在告警详情中查看'
            : `检测置信度 ${(this.latestDetection.confidence * 100).toFixed(1)}%`)
            .fontSize(13).fontColor(Theme.secondary).lineHeight(19).width('100%');
          if (this.visionStatus?.fault) {
            Text(this.visionStatus.fault).fontSize(13).fontColor(Theme.warning).width('100%');
          }
        }
        .width('100%').padding(18).backgroundColor(Theme.surface)
        .border({ width: 1, color: Theme.line }).borderRadius(16);
      }
      .width('100%').constraintSize({ maxWidth: 720 })
      .padding({ left: 22, right: 22, top: 24, bottom: 32 });
    }
    .width('100%').height('100%').scrollable(ScrollDirection.Vertical).scrollBar(BarState.Off).backgroundColor(Theme.background);
  }
}
