import { Theme } from '../components/Theme';
import { EdgeConnectionState, PairingConfig } from '../models/EdgeModels';
import { FeedbackNotice, SectionTitle } from '../components/SafetyComponents';

@Component
export struct PairingPage {
  @Prop errorMessage: string = '';
  @Prop busy: boolean = false;
  @Prop pairing: PairingConfig | undefined = undefined;
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  onScan: () => void = () => {};
  onPair: (payload: string) => void = (_: string) => {};
  onBack: () => void = () => {};
  onClear: () => void = () => {};
  onReconnect: () => void = () => {};
  @State private payload: string = '';
  @State private confirmingClear: boolean = false;

  private tokenSummary(): string {
    if (this.pairing?.token === undefined) {
      return '服务地址已保存在本机';
    }
    const expiry: number = this.pairing.expiresAtMs ?? 0;
    return expiry <= Date.now() ? '配对令牌已过期，请获取新的配对码'
      : `令牌有效至 ${new Date(expiry).toLocaleString()}`;
  }

  build() {
    Column() {
      if (this.pairing !== undefined) {
        Row({ space: 12 }) {
          Button('‹ 返回')
            .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
            .height(48).borderRadius(12).enabled(!this.busy).onClick(() => this.onBack());
          Text('配对管理').fontSize(20).fontWeight(FontWeight.Bold).fontColor(Theme.text);
        }
        .width('100%').padding({ left: 22, right: 22, top: 12, bottom: 12 }).backgroundColor(Theme.background)
        .border({ width: { bottom: 1 }, color: Theme.line });
      }
      Scroll() {
        Column({ space: 22 }) {
          Row({ space: 18 }) {
            Column({ space: 8 }) {
              Text('ZHIXUN FIRE / CONNECT').fontSize(10).letterSpacing(1.5).fontColor(Theme.muted).width('100%');
              Text('智巡消防').fontSize(32).fontWeight(FontWeight.Bold).fontColor(Theme.text).width('100%');
              Text('让连接清晰，让巡检安心。').fontSize(13).fontColor(Theme.secondary).width('100%');
            }
            .alignItems(HorizontalAlign.Start).layoutWeight(1);
            Image($r('app.media.pairing_scan')).width(76).height(76).objectFit(ImageFit.Contain);
          }
          .width('100%').padding({ top: 6, bottom: 8 });
          Column({ space: 7 }) {
            Text(this.pairing === undefined ? '连接现场，守护每一程巡检' : '管理现场边缘服务连接')
              .fontSize(16).fontColor(Theme.secondary).width('100%');
            Text('手机与现场服务接入同一局域网后，扫描配对码或粘贴服务地址。')
              .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%').margin({ top: 5 });
          }
          .width('100%').padding({ top: 8, bottom: 6 });

          FeedbackNotice({ error: this.errorMessage });

          if (this.pairing !== undefined) {
            Column({ space: 10 }) {
              SectionTitle({ title: '当前配对', detail: this.connectionState === 'connected' ? '边缘在线'
                : this.connectionState === 'connecting' ? '正在连接' : '连接中断' });
              Text(this.pairing.serviceUrl).fontSize(14).fontWeight(FontWeight.Medium).fontColor(Theme.text).width('100%');
              Text(this.tokenSummary()).fontSize(13).lineHeight(19).fontColor(Theme.secondary).width('100%');
              Text('返回巡检页面会保留当前配对与连接。')
                .fontSize(13).fontColor(Theme.lime).width('100%');
              if (this.connectionState !== 'connected') {
                Button(this.connectionState === 'connecting' ? '正在连接…' : '重新连接当前服务')
                  .fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                  .height(50).width('100%').borderRadius(12)
                  .enabled(!this.busy && this.connectionState !== 'connecting').onClick(() => this.onReconnect());
              }
            }
            .width('100%').padding(16).backgroundColor(Theme.surface)
            .border({ width: 1, color: Theme.line }).borderRadius(18);
          }

          Column({ space: 10 }) {
            SectionTitle({ title: '01  扫码配对', detail: '推荐' });
            Text('扫描现场控制台生成的配对二维码，导入服务地址和短期令牌。')
              .fontSize(14).lineHeight(21).fontColor(Theme.secondary).width('100%');
            Button(this.busy ? '请稍候…' : '扫描配对二维码')
              .fontSize(16).fontWeight(FontWeight.Medium).fontColor(Theme.ink).backgroundColor(Theme.lime)
              .borderRadius(11).height(56).width('100%').enabled(!this.busy).onClick(() => this.onScan());
          }
          .width('100%').padding(18).backgroundColor(Theme.surface)
          .border({ width: 1, color: Theme.line }).borderRadius(18);

          Column({ space: 10 }) {
            SectionTitle({ title: '02  手动连接', detail: '地址或配对内容' });
            TextArea({ placeholder: '粘贴服务地址或完整配对内容\n如 http://192.168.1.8:8787', text: this.payload })
              .fontSize(14).fontColor(Theme.text).backgroundColor(Theme.background).borderRadius(12)
              .placeholderColor(Theme.muted).caretColor(Theme.lime).border({ width: 1, color: Theme.line })
              .height(104).width('100%').enabled(!this.busy)
              .onChange((value: string) => { this.payload = value; });
            Button(this.busy ? '连接处理中…' : this.pairing === undefined ? '连接现场服务' : '保存并连接新服务')
              .fontSize(15).fontWeight(FontWeight.Medium).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
              .borderRadius(12).height(52).width('100%')
              .enabled(!this.busy && this.payload.trim().length > 0).onClick(() => this.onPair(this.payload));
          }
          .width('100%').padding(18).backgroundColor(Theme.surface)
          .border({ width: 1, color: Theme.line }).borderRadius(18);

          Text('配对令牌仅保存在本机，过期后不再随请求发送。配对不会自动启动巡检或控制设备。')
            .fontSize(13).lineHeight(20).fontColor(Theme.secondary).width('100%');

          if (this.pairing !== undefined) {
            if (this.confirmingClear) {
              Column({ space: 12 }) {
                Text('确认取消当前配对？').fontSize(16).fontWeight(FontWeight.Bold).fontColor(Theme.text).width('100%');
                Text('将断开本机连接并删除保存的地址与令牌。请先在现场核实机器人状态。')
                  .fontSize(14).lineHeight(21).fontColor(Theme.warning).width('100%');
                Button('保留配对').fontSize(14).fontColor(Theme.lime).backgroundColor(Theme.accentSurface)
                  .height(50).width('100%').borderRadius(12).enabled(!this.busy)
                  .onClick(() => { this.confirmingClear = false; });
                Button('确认取消配对').fontSize(14).fontColor(Theme.ink).backgroundColor(Theme.danger)
                  .height(50).width('100%').borderRadius(12).enabled(!this.busy).onClick(() => this.onClear());
              }
              .width('100%').padding(16).backgroundColor(Theme.warningSurface).borderRadius(16);
            } else {
              Button('取消当前配对')
                .fontSize(14).fontColor(Theme.danger).backgroundColor(Theme.dangerSurface)
                .borderRadius(12).height(50).width('100%').enabled(!this.busy)
                .onClick(() => { this.confirmingClear = true; });
            }
          }
        }
        .width('100%').constraintSize({ maxWidth: 640 })
        .padding({ left: 22, right: 22, top: 24, bottom: 32 });
      }
      .width('100%').layoutWeight(1).scrollable(ScrollDirection.Vertical).scrollBar(BarState.Off);
    }
    .width('100%').height('100%').backgroundColor(Theme.background);
  }
}
