import { Theme } from '../components/Theme';
import { EdgeConnectionState, SystemSnapshot } from '../models/EdgeModels';
import { FeedbackNotice, SafetyBanner, SectionTitle } from '../components/SafetyComponents';

@Component
export struct SafetyActionsPage {
  @Prop snapshot: SystemSnapshot | undefined = undefined;
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop busyAction: string = '';
  @Prop errorMessage: string = '';
  @Prop actionMessage: string = '';
  @Prop lastUpdatedAt: number = 0;
  onPause: () => void = () => {};
  onEstop: () => void = () => {};
  @State private confirmingEstop: boolean = false;

  private available(): boolean {
    return this.connectionState === 'connected' && this.busyAction.length === 0;
  }

  build() {
    Scroll() {
      Column({ space: 22 }) {
        Column({ space: 6 }) {
          Text('SAFETY CONTROL / 03').fontSize(10).letterSpacing(1.8).fontColor(Theme.muted).width('100%');
          Text('安全操作').fontSize(30).fontWeight(FontWeight.Bold).fontColor(Theme.text).width('100%');
          Text('先核实现场风险，再执行远程处置。').fontSize(14).fontColor(Theme.secondary).width('100%');
        }
        .width('100%');
        SafetyBanner({ snapshot: this.snapshot, connectionState: this.connectionState, lastUpdatedAt: this.lastUpdatedAt });
        FeedbackNotice({ error: this.errorMessage, message: this.actionMessage });

        Column({ space: 10 }) {
          SectionTitle({ title: '暂停巡检', detail: '普通安全动作' });
          Text('请求机器人暂停当前巡检任务。收到现场服务确认后，本页才会更新状态。')
            .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
          Button(this.busyAction === 'pause' ? '等待服务器确认…' : this.snapshot?.safety.state === 'PAUSED' ? '已记录暂停' : '暂停当前巡检')
            .fontSize(16).fontWeight(FontWeight.Medium).fontColor(Theme.ink).backgroundColor(Theme.lime)
            .borderRadius(11).height(56).width('100%')
            .enabled(this.available() && this.snapshot !== undefined && this.snapshot.safety.state !== 'PAUSED'
              && this.snapshot.safety.state !== 'ESTOP_LATCHED')
            .onClick(() => this.onPause());
        }
        .width('100%').padding(20).backgroundColor(Theme.surface)
        .border({ width: 1, color: Theme.line }).borderRadius(18);

        Column({ space: 12 }) {
          SectionTitle({ title: '急停并锁存', detail: '紧急处置' });
          Text('用于现场紧急风险。锁存后不能通过本应用解除，须按现场授权流程处理。')
            .fontSize(14).lineHeight(22).fontColor(Theme.warning).width('100%');
          if (this.snapshot?.safety.state === 'ESTOP_LATCHED') {
            Text(this.connectionState !== 'connected' ? '上次记录为急停锁存 · 请现场核实'
              : this.snapshot?.ros_connected === true ? '急停已锁存 · 请进行现场处置' : '急停已锁存 · 机器人未连接，请现场核实')
              .fontSize(15).fontWeight(FontWeight.Bold).fontColor(Theme.danger).width('100%')
              .padding(15).backgroundColor(Theme.dangerSurface).borderRadius(12);
          } else if (this.confirmingEstop) {
            Column({ space: 12 }) {
              Text('确认现场需要急停锁存？').fontSize(17).fontWeight(FontWeight.Bold).fontColor(Theme.danger).width('100%');
              Text('确认后发送急停请求。请求失败或断网时，请立即使用现场急停装置。')
                .fontSize(14).lineHeight(21).fontColor(Theme.warning).width('100%');
              Button('确认急停并锁存')
                .fontSize(16).fontWeight(FontWeight.Bold).fontColor(Theme.ink).backgroundColor(Theme.danger)
                .borderRadius(11).height(58).width('100%').enabled(this.available())
                .onClick(() => { this.confirmingEstop = false; this.onEstop(); });
              Button('取消，返回核实')
                .fontSize(14).fontColor(Theme.secondary).backgroundColor(Theme.surface)
                .borderRadius(12).height(50).width('100%')
                .onClick(() => { this.confirmingEstop = false; });
            }
            .width('100%');
          } else {
            Button(this.busyAction === 'estop' ? '等待锁存确认…' : '急停并锁存')
              .fontSize(17).fontWeight(FontWeight.Bold).fontColor(Theme.ink).backgroundColor(Theme.danger)
              .borderRadius(11).height(62).width('100%').enabled(this.available())
              .onClick(() => { this.confirmingEstop = true; });
          }
        }
        .width('100%').padding(20).backgroundColor(Theme.dangerSurface)
        .border({ width: 1, color: Theme.dangerLine }).borderRadius(18);

        Column({ space: 10 }) {
          SectionTitle({ title: '现场处置提示', detail: '人员安全优先' });
          Text('01  核实机器人、人员与火情位置，保持安全距离。')
            .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
          Text('02  远程操作未确认时，优先使用现场急停装置。')
            .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
          Text('03  急停解除须由现场授权人员执行，并重新核实巡检状态。')
            .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
        }
        .width('100%').padding(20).backgroundColor(Theme.surface)
        .border({ width: 1, color: Theme.line }).borderRadius(18);
      }
      .width('100%').constraintSize({ maxWidth: 720 })
      .padding({ left: 22, right: 22, top: 24, bottom: 32 });
    }
    .width('100%').height('100%').scrollable(ScrollDirection.Vertical).scrollBar(BarState.Off).backgroundColor(Theme.background);
  }
}
