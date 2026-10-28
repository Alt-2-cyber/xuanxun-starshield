import { Theme } from '../components/Theme';
import { AckResult, AlertEvent, EdgeConnectionState, EventEvidence, EventReplay, EvidenceAsset, ReplayFrame, VisionDetection } from '../models/EdgeModels';
import { FeedbackNotice, SectionTitle, SeverityBadge, alertTitle, safetyTitle, timeText } from '../components/SafetyComponents';

function sensorText(value: number | null | undefined, suffix: string): string {
  return value === undefined || value === null || !Number.isFinite(value) ? '--' : `${value.toFixed(2)}${suffix}`;
}

@Component
struct DetailRow {
  @Prop label: string = '';
  @Prop value: string = '--';

  build() {
    Row({ space: 14 }) {
      Text(this.label).fontSize(14).fontColor(Theme.secondary).width(72);
      Text(this.value).fontSize(14).lineHeight(20).fontColor(Theme.text)
        .fontWeight(FontWeight.Medium).layoutWeight(1).textAlign(TextAlign.End);
    }
    .width('100%').padding({ top: 10, bottom: 10 }).border({ width: { bottom: 1 }, color: Theme.line });
  }
}

@Component
struct EvidenceImage {
  @Prop asset: EvidenceAsset = {};
  @Prop serviceUrl: string = '';
  @State private failed: boolean = false;

  private uri(): string {
    const uri: string = this.asset.url ?? this.asset.uri ?? this.asset.thumbnail_url ?? '';
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }
    if (uri.length > 0 && uri.indexOf(':') < 0 && this.serviceUrl.length > 0) {
      return `${this.serviceUrl}${uri.startsWith('/') ? '' : '/'}${uri}`;
    }
    return '';
  }

  build() {
    Column({ space: 8 }) {
      if (this.uri().length === 0) {
        Text('服务未提供可显示的图片地址').fontSize(14).fontColor(Theme.secondary).padding(15);
      } else if (this.failed) {
        Column({ space: 10 }) {
          Text('图片加载失败，请检查现场连接').fontSize(14).fontColor(Theme.warning);
          Button('重试图片').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
            .height(48).borderRadius(12).onClick(() => { this.failed = false; });
        }
        .width('100%').padding(18).backgroundColor(Theme.elevated).borderRadius(12);
      } else {
        Image(this.uri()).width('100%').height(200).objectFit(ImageFit.Contain)
          .backgroundColor(Theme.elevated).borderRadius(12).onError(() => { this.failed = true; });
      }
      if (this.asset.label !== undefined) {
        Text(this.asset.label).fontSize(13).fontColor(Theme.secondary).width('100%');
      }
      if (this.asset.captured_at !== undefined) {
        Text(timeText(this.asset.captured_at)).fontSize(12).fontColor(Theme.secondary).width('100%');
      }
    }
    .width('100%').margin({ bottom: 12 });
  }
}

@Component
export struct AlertDetailPage {
  @Prop event: AlertEvent | undefined = undefined;
  @Prop evidence: EventEvidence | undefined = undefined;
  @Prop busyAction: string = '';
  @Prop ackResult: AckResult | undefined = undefined;
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop evidenceLoading: boolean = false;
  @Prop evidenceError: string = '';
  @Prop serviceUrl: string = '';
  @Prop replay: EventReplay | undefined = undefined;
  @Prop replayLoading: boolean = false;
  @Prop replayError: string = '';
  @State private replayIndex: number = 0;
  onBack: () => void = () => {};
  onAcknowledge: (eventId: string) => void = (_: string) => {};
  onRetryEvidence: () => void = () => {};
  onLoadReplay: () => void = () => {};

  private replayFrame(): ReplayFrame | undefined {
    if (this.replay === undefined || this.replay.frames.length === 0) {
      return undefined;
    }
    return this.replay.frames[Math.min(this.replayIndex, this.replay.frames.length - 1)];
  }

  private mediaAssets(): EvidenceAsset[] {
    const result: EvidenceAsset[] = [];
    if (this.evidence?.photos !== undefined) {
      result.push(...this.evidence.photos);
    }
    if (this.evidence?.frames !== undefined) {
      result.push(...this.evidence.frames);
    }
    if (this.evidence?.low_frame_rate_preview !== undefined) {
      result.push(...this.evidence.low_frame_rate_preview);
    }
    return result;
  }

  build() {
    Column() {
      Row({ space: 12 }) {
        Button('‹ 返回').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
          .height(48).borderRadius(12).onClick(() => this.onBack());
        Column({ space: 4 }) {
          Text('EVENT / DETAIL').fontSize(10).letterSpacing(1.5).fontColor(Theme.muted);
          Text('告警详情').fontSize(22).fontWeight(FontWeight.Bold).fontColor(Theme.text);
        }
        .alignItems(HorizontalAlign.Start);
      }
      .width('100%').padding({ left: 22, right: 22, top: 12, bottom: 14 }).backgroundColor(Theme.background)
      .border({ width: { bottom: 1 }, color: Theme.line });
      if (this.event === undefined) {
        Text('尚未选择事件，请返回事件档案。').fontSize(14).fontColor(Theme.secondary)
          .layoutWeight(1).textAlign(TextAlign.Center);
      } else {
        Scroll() {
          Column({ space: 22 }) {
            Column({ space: 12 }) {
              Row({ space: 10 }) {
                SeverityBadge({ level: this.event.level });
                Text(alertTitle(this.event.level)).fontSize(17).fontWeight(FontWeight.Bold).fontColor(Theme.text).layoutWeight(1);
              }
              .width('100%');
              Text(this.event.event_id).fontSize(16).fontWeight(FontWeight.Medium).fontColor(Theme.text).width('100%');
              Text(timeText(this.event.created_at)).fontSize(13).fontColor(Theme.secondary).width('100%');
            }
            .width('100%').padding(17).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);

            Column({ space: 10 }) {
              SectionTitle({ title: '告警确认', detail: this.event.acked === true ? '已确认并留档' : '待确认' });
              Text('确认表示已知悉此事件，风险解除仍须在现场核实。')
                .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
              Button(this.event.acked === true ? '已确认并留档' : this.busyAction === 'ack' ? '等待服务器确认…'
                : this.ackResult?.kind === 'failed' || this.ackResult?.kind === 'unavailable' ? '重试确认告警' : '确认知悉告警')
                .fontSize(16).fontWeight(FontWeight.Medium)
                .fontColor(this.event.acked === true ? Theme.lime : Theme.ink)
                .backgroundColor(this.event.acked === true ? Theme.accentSurface : Theme.lime)
                .borderRadius(11).height(56).width('100%')
                .enabled(this.event.acked !== true && this.busyAction.length === 0 && this.connectionState === 'connected')
                .onClick(() => this.onAcknowledge(this.event?.event_id ?? ''));
              if (this.ackResult !== undefined) {
                FeedbackNotice({
                  error: this.ackResult.kind !== 'acknowledged' ? this.ackResult.message : '',
                  message: this.ackResult.kind === 'acknowledged' ? this.ackResult.message : ''
                });
              }
            }
            .width('100%').padding(17).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);

            Column() {
              SectionTitle({ title: '事件信息', detail: '现场采集记录' });
              DetailRow({ label: '机器人', value: this.event.robot_id ?? '--' });
              DetailRow({ label: '设备来源', value: this.event.source_id ?? '--' });
              DetailRow({ label: '传输链路', value: this.event.transport ?? '--' });
              DetailRow({ label: '触发源', value: (this.event.trigger_bits ?? []).join(' / ') || '--' });
              DetailRow({ label: '事件状态', value: this.event.status ?? '--' });
              DetailRow({ label: '位置坐标', value: this.event.pose === undefined ? '--'
                : `${this.event.pose.x ?? '--'} / ${this.event.pose.y ?? '--'}` });
            }
            .width('100%').padding(17).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);

            Column() {
              SectionTitle({ title: '传感器证据', detail: '事件发生时的采样' });
              DetailRow({ label: '温度', value: sensorText(this.evidence?.sensor_values?.temperature_c ?? this.event.sensor_values?.temperature_c, ' °C') });
              DetailRow({ label: '烟雾比', value: sensorText(this.evidence?.sensor_values?.smoke_ratio ?? this.event.sensor_values?.smoke_ratio, '') });
              DetailRow({ label: '气体比', value: sensorText(this.evidence?.sensor_values?.gas_ratio ?? this.event.sensor_values?.gas_ratio, '') });
            }
            .width('100%').padding(17).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);

            Column({ space: 10 }) {
              SectionTitle({ title: '照片与视觉证据', detail: this.evidenceLoading ? '正在加载' : '服务端留档' });
              if (this.evidenceLoading) {
                LoadingProgress().width(30).height(30).color(Theme.lime);
                Text('正在读取事件证据…').fontSize(14).fontColor(Theme.secondary);
              } else if (this.evidenceError.length > 0) {
                FeedbackNotice({ error: this.evidenceError });
                Button('重试加载证据').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                  .height(50).width('100%').borderRadius(12)
                  .enabled(this.connectionState === 'connected').onClick(() => this.onRetryEvidence());
              } else if (this.evidence !== undefined) {
                if (this.evidence.message !== undefined) {
                  Text(this.evidence.message).fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
                }
                if (this.mediaAssets().length === 0) {
                  Text('此事件未附带照片或预览，已提供的传感器证据可在上方查看。')
                    .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%')
                    .padding(14).backgroundColor(Theme.elevated).borderRadius(12);
                }
                ForEach(this.mediaAssets(), (asset: EvidenceAsset) => {
                  EvidenceImage({ asset, serviceUrl: this.serviceUrl });
                }, (asset: EvidenceAsset, index: number): string => `${this.event?.event_id}:${asset.url ?? asset.uri ?? asset.thumbnail_url ?? ''}:${index}`);
                ForEach(this.evidence.vision_detections ?? [], (detection: VisionDetection) => {
                  DetailRow({ label: detection.label ?? '视觉检测', value: detection.confidence === undefined
                    ? '置信度未提供' : `置信度 ${(detection.confidence * 100).toFixed(1)}%` });
                }, (detection: VisionDetection, index: number): string => `${detection.frame_id ?? ''}:${index}`);
              } else {
                Text('证据尚未加载。').fontSize(14).fontColor(Theme.secondary);
                Button('加载事件证据').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                  .height(50).width('100%').borderRadius(12)
                  .enabled(this.connectionState === 'connected').onClick(() => this.onRetryEvidence());
              }
            }
            .width('100%').padding(17).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);

            Column({ space: 10 }) {
              SectionTitle({ title: '事件回放', detail: this.replay === undefined ? '按需读取' : `${this.replay.frames.length} 帧留档` });
              Text('查看事件发生时的位置、采样与安全状态。')
                .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
              if (this.replayError.length > 0) {
                FeedbackNotice({ error: this.replayError });
              }
              if (this.replay === undefined || this.replayError.length > 0) {
                Button(this.replayLoading ? '回放加载中…' : this.replayError.length > 0 ? '重试读取回放' : '读取事件回放')
                  .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                  .height(50).width('100%').borderRadius(12)
                  .enabled(!this.replayLoading && this.connectionState === 'connected')
                  .onClick(() => { this.replayIndex = 0; this.onLoadReplay(); });
              }
              if (this.replay !== undefined) {
                if (this.replay.frames.length === 0) {
                  Text('该事件没有保存回放帧。').fontSize(14).fontColor(Theme.secondary).width('100%');
                } else {
                  Text(`第 ${Math.min(this.replayIndex + 1, this.replay.frames.length)} / ${this.replay.frames.length} 帧`)
                    .fontSize(14).fontWeight(FontWeight.Bold).fontColor(Theme.text).width('100%');
                  DetailRow({ label: '采样时间', value: timeText(this.replayFrame()?.timestamp) });
                  DetailRow({ label: '安全状态', value: safetyTitle(this.replayFrame()?.safety_state) });
                  DetailRow({ label: '位置坐标', value: `${this.replayFrame()?.pose?.x ?? '--'} / ${this.replayFrame()?.pose?.y ?? '--'}` });
                  DetailRow({ label: '温度', value: sensorText(this.replayFrame()?.sensor_values?.temperature_c, ' °C') });
                  DetailRow({ label: '烟雾比', value: sensorText(this.replayFrame()?.sensor_values?.smoke_ratio, '') });
                  DetailRow({ label: '气体比', value: sensorText(this.replayFrame()?.sensor_values?.gas_ratio, '') });
                  if (this.replay.frames.length > 1) {
                    Slider({ value: this.replayIndex, min: 0, max: this.replay.frames.length - 1, step: 1 })
                      .selectedColor(Theme.lime).trackColor(Theme.line).blockColor(Theme.lime).width('100%')
                      .onChange((value: number) => { this.replayIndex = Math.round(value); });
                    Row({ space: 10 }) {
                      Button('上一帧').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                        .height(48).layoutWeight(1).borderRadius(12).enabled(this.replayIndex > 0)
                        .onClick(() => { this.replayIndex--; });
                      Button('下一帧').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                        .height(48).layoutWeight(1).borderRadius(12).enabled(this.replayIndex < this.replay.frames.length - 1)
                        .onClick(() => { this.replayIndex++; });
                    }
                    .width('100%');
                  }
                }
              }
            }
            .width('100%').padding(17).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(16);
          }
          .width('100%').constraintSize({ maxWidth: 720 })
          .padding({ left: 22, right: 22, top: 22, bottom: 32 });
        }
        .width('100%').layoutWeight(1).scrollable(ScrollDirection.Vertical).scrollBar(BarState.Off);
      }
    }
    .width('100%').height('100%').backgroundColor(Theme.background);
  }
}
