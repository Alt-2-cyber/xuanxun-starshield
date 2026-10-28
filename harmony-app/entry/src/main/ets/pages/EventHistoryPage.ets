import { Theme } from '../components/Theme';
import { AlertEvent, EdgeConnectionState } from '../models/EdgeModels';
import { AlertSummaryRow, FeedbackNotice, SectionTitle } from '../components/SafetyComponents';
import { filterEvents } from '../services/edge/EventHistory';

@Component
export struct EventHistoryPage {
  @Prop events: AlertEvent[] = [];
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop loading: boolean = false;
  @Prop loaded: boolean = false;
  @Prop errorMessage: string = '';
  @Prop hasMore: boolean = false;
  @Prop level: string = 'ALL';
  @Prop acknowledgement: string = 'ALL';
  @Prop keyword: string = '';
  onSelect: (event: AlertEvent) => void = (_: AlertEvent) => {};
  onRefresh: () => void = () => {};
  onLoadMore: () => void = () => {};
  onLevel: (level: string) => void = (_: string) => {};
  onAcknowledgement: (value: string) => void = (_: string) => {};
  onKeyword: (value: string) => void = (_: string) => {};
  onResetFilters: () => void = () => {};

  private filteredEvents(): AlertEvent[] {
    return filterEvents(this.events, this.level, this.acknowledgement, this.keyword);
  }

  @Builder
  private levelChip(label: string, value: string) {
    Button(label).fontSize(14).fontWeight(FontWeight.Medium)
      .fontColor(this.level === value ? Theme.ink : Theme.secondary)
      .backgroundColor(this.level === value ? Theme.lime : Theme.elevated)
      .borderRadius(12).height(48).padding({ left: 17, right: 17 }).onClick(() => this.onLevel(value));
  }

  @Builder
  private acknowledgementChip(label: string, value: string) {
    Button(label).fontSize(14).fontWeight(FontWeight.Medium)
      .fontColor(this.acknowledgement === value ? Theme.lime : Theme.secondary)
      .backgroundColor(this.acknowledgement === value ? Theme.accentSurface : Theme.elevated)
      .borderRadius(12).height(48).layoutWeight(1).onClick(() => this.onAcknowledgement(value));
  }

  build() {
    Scroll() {
      Column({ space: 22 }) {
        Row({ space: 10 }) {
          Column({ space: 5 }) {
            Text('EVENT ARCHIVE / 02').fontSize(10).letterSpacing(1.8).fontColor(Theme.muted);
            Text('事件档案').fontSize(30).fontWeight(FontWeight.Bold).fontColor(Theme.text);
            Text('查看现场留档，跟进每一条告警').fontSize(13).fontColor(Theme.secondary);
          }
          .alignItems(HorizontalAlign.Start).layoutWeight(1);
          Button(this.loading ? '加载中' : '刷新档案')
            .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
            .height(48).borderRadius(12).padding({ left: 13, right: 13 })
            .enabled(!this.loading && this.connectionState === 'connected').onClick(() => this.onRefresh());
        }
        .width('100%');

        Row({ space: 18 }) {
          Text(`${this.events.length < 10 ? '0' : ''}${this.events.length}`)
            .fontSize(46).fontWeight(FontWeight.Lighter).fontColor(Theme.lime);
          Column({ space: 7 }) {
            Text('已加载的现场记录').fontSize(14).fontColor(Theme.text);
            Text(this.loaded ? '边缘档案已同步' : '等待档案同步').fontSize(12).fontColor(Theme.muted);
          }
          .alignItems(HorizontalAlign.Start).layoutWeight(1);
          Image($r('app.media.nav_events')).width(32).height(32).opacity(0.6);
        }
        .width('100%').padding({ left: 20, right: 20, top: 18, bottom: 18 })
        .backgroundColor(Theme.surface).border({ width: 1, color: Theme.line }).borderRadius(18);

        Column({ space: 12 }) {
          TextInput({ placeholder: '搜索事件编号、机器人、来源或触发源', text: this.keyword })
            .fontSize(14).fontColor(Theme.text).height(52).width('100%')
            .backgroundColor(Theme.background).placeholderColor(Theme.muted)
            .caretColor(Theme.lime).border({ width: 1, color: Theme.line })
            .borderRadius(12).onChange((value: string) => this.onKeyword(value));
          Text('告警等级').fontSize(13).fontColor(Theme.secondary).width('100%');
          Scroll() {
            Row({ space: 7 }) {
              this.levelChip('全部', 'ALL');
              this.levelChip('P1', 'P1');
              this.levelChip('P2', 'P2');
              this.levelChip('P3', 'P3');
              this.levelChip('已清除', 'CLEARED');
              this.levelChip('正常', 'NORMAL');
            }
          }
          .width('100%').scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off);
          Text('确认状态').fontSize(13).fontColor(Theme.secondary).width('100%');
          Row({ space: 7 }) {
            this.acknowledgementChip('全部状态', 'ALL');
            this.acknowledgementChip('待确认', 'PENDING');
            this.acknowledgementChip('已确认', 'ACKED');
          }
          .width('100%');
        }
        .width('100%').padding(18).backgroundColor(Theme.surface)
        .border({ width: 1, color: Theme.line }).borderRadius(16);

        if (this.errorMessage.length > 0) {
          Column({ space: 10 }) {
            FeedbackNotice({ error: this.errorMessage });
            Button('重试加载档案')
              .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
              .height(50).width('100%').borderRadius(12)
              .enabled(!this.loading && this.connectionState === 'connected').onClick(() => this.onRefresh());
          }
          .width('100%');
        }

        SectionTitle({ title: `匹配 ${this.filteredEvents().length} 条`, detail: `已加载 ${this.events.length} 条${this.hasMore ? '，可继续加载' : ''}` });
        if (this.loading) {
          Row({ space: 10 }) {
            LoadingProgress().width(24).height(24).color(Theme.lime);
            Text('正在读取边缘服务档案…').fontSize(14).fontColor(Theme.secondary);
          }
          .width('100%').padding(12);
        }
        if (this.filteredEvents().length === 0 && !this.loading) {
          Column({ space: 10 }) {
            Image($r('app.media.archive_empty')).width(80).height(72).objectFit(ImageFit.Contain).margin({ bottom: 8 });
            Text(this.loaded ? this.events.length === 0 ? '暂无事件记录' : '没有符合筛选的事件' : '档案尚未加载')
              .fontSize(16).fontWeight(FontWeight.Medium).fontColor(Theme.text);
            Text(this.loaded ? '可刷新档案，或调整等级、确认状态及关键词。' : '连接现场服务后可读取此前保存的事件。')
              .fontSize(14).lineHeight(21).fontColor(Theme.secondary).textAlign(TextAlign.Center);
            if (this.level !== 'ALL' || this.acknowledgement !== 'ALL' || this.keyword.length > 0) {
              Button('清除筛选').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                .height(48).borderRadius(12).onClick(() => this.onResetFilters());
            }
          }
          .width('100%').padding({ left: 22, right: 22, top: 30, bottom: 30 })
          .backgroundColor(Theme.surface).border({ width: 1, color: Theme.line }).borderRadius(18);
        }
        ForEach(this.filteredEvents(), (event: AlertEvent) => {
          AlertSummaryRow({ event, onSelect: () => this.onSelect(event) });
        }, (event: AlertEvent): string => `${event.event_id}:${event.level}:${event.acked === true}:${event.status ?? ''}`);

        if (this.hasMore) {
          Button(this.loading ? '正在加载…' : '加载更早的 200 条记录')
            .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
            .height(52).width('100%').borderRadius(12)
            .enabled(!this.loading && this.connectionState === 'connected').onClick(() => this.onLoadMore());
        }
        Text('筛选作用于已加载记录。确认告警表示已知悉事件，风险解除仍需现场核实。')
          .fontSize(13).lineHeight(20).fontColor(Theme.secondary).width('100%');
      }
      .width('100%').constraintSize({ maxWidth: 720 })
      .padding({ left: 22, right: 22, top: 24, bottom: 32 });
    }
    .width('100%').height('100%').scrollable(ScrollDirection.Vertical).scrollBar(BarState.Off).backgroundColor(Theme.background);
  }
}
