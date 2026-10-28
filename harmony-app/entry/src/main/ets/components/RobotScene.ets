import { EdgeConnectionState } from '../models/EdgeModels';
import { Theme } from './Theme';

/** Local illustration only; all connection labels are derived from the live props. */
@Component
export struct RobotScene {
  @Prop connectionState: EdgeConnectionState = 'disconnected';
  @Prop rosConnected: boolean | undefined = undefined;
  @State private entered: boolean = false;

  aboutToAppear(): void {
    this.getUIContext().animateTo({ duration: 450, curve: Curve.EaseOut }, () => {
      this.entered = true;
    });
  }

  build() {
    Column({ space: 0 }) {
      Row({ space: 8 }) {
        Text('R01').fontSize(18).fontWeight(FontWeight.Bold).fontColor(Theme.text);
        Text('FIRE PATROL').fontSize(9).letterSpacing(1.8).fontColor(Theme.muted).layoutWeight(1);
        Text('空间视图').fontSize(11).fontColor(Theme.lime)
          .padding({ left: 10, right: 10, top: 6, bottom: 6 })
          .border({ width: 1, color: Theme.line }).borderRadius(6);
      }
      .width('100%').padding({ left: 18, right: 18, top: 16 });
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.robot_r01'))
          .width('100%').height(250).objectFit(ImageFit.Contain)
          .opacity(this.entered ? 1 : 0.4).translate({ y: this.entered ? 0 : 8 })
          .accessibilityText('R01 工业巡检小车等距示意模型，非实车实时画面');
        Column({ space: 5 }) {
          Text('01 / 边缘节点').fontSize(10).fontColor(Theme.muted);
          Row({ space: 5 }) {
            Circle({ width: 5, height: 5 }).fill(this.connectionState === 'connected' ? Theme.lime : Theme.warning);
            Text(this.connectionState === 'connected' ? '边缘在线' : this.connectionState === 'connecting' ? '正在连接' : '连接待核实')
              .fontSize(12).fontColor(this.connectionState === 'connected' ? Theme.lime : Theme.warning);
          }
        }
        .alignItems(HorizontalAlign.Start).padding(10).borderRadius(10)
        .backgroundColor('#E61C2820').border({ width: 1, color: '#5063414A' })
        .position({ x: 12, y: 18 });
        Column({ space: 5 }) {
          Text('02 / 机器人链路').fontSize(10).fontColor(Theme.muted);
          Text(this.connectionState !== 'connected' ? '现场待核实'
            : this.rosConnected === true ? '机器人在线' : this.rosConnected === false ? '等待接入' : '待同步')
            .fontSize(12).fontColor(this.connectionState === 'connected' && this.rosConnected === true ? Theme.lime : Theme.warning);
        }
        .alignItems(HorizontalAlign.Start).padding(10).borderRadius(10)
        .backgroundColor('#E61C2820').border({ width: 1, color: '#5063414A' })
        .position({ x: '58%', y: 177 });
      }
      .width('100%').height(250);
      Row({ space: 8 }) {
        Text('R01 概念巡检平台').fontSize(11).fontColor(Theme.secondary).layoutWeight(1);
        Text('示意模型 · 非实车画面').fontSize(10).fontColor(Theme.muted);
      }
      .width('100%').padding({ left: 18, right: 18, top: 12, bottom: 14 })
      .border({ width: { top: 1 }, color: Theme.line });
    }
    .width('100%').backgroundColor(Theme.surface)
    .border({ width: 1, color: Theme.line }).borderRadius(18).clip(true);
  }
}
