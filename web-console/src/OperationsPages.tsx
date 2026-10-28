import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Copy,
  Download,
  Pause,
  Radio,
  RefreshCw,
  Route,
  Server,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import { TwinMap } from "./AdvancedViews";
import { downloadFile, normalizeServiceUrl } from "./api";
import {
  Badge,
  Empty,
  InlineMessage,
  Section,
  Stat,
  modeName,
  safetyLabel,
  timeText,
  valueText,
} from "./components";
import type { EdgeData } from "./useEdge";

export function PatrolPage({
  data,
  onControl,
  onPause,
  onEstop,
}: {
  data: EdgeData;
  onControl: () => void;
  onPause: () => void;
  onEstop: () => void;
}) {
  const online = data.connection === "online" || data.connection === "degraded",
    live = online && !!data.control?.ros_connected;
  return (
    <div className="stack">
      <div className="stats-grid">
        <Stat
          label="当前路线"
          value={data.system?.safety.patrol_name || "未配置"}
          detail="来自边缘服务"
        />
        <Stat
          label="运行模式"
          value={modeName[data.control?.mode ?? ""] || "待连接"}
          detail="模式由服务端确认"
        />
        <Stat
          label="巡检进度"
          value={live ? `${data.system?.safety.patrol_progress ?? 0}%` : "—"}
          detail={live ? "服务上报的路线进度" : "等待机器人位姿接入"}
        />
        <Stat
          label="安全状态"
          value={safetyLabel(data.control?.safety_state, online, live)}
          detail={
            data.control?.obstacle_blocked
              ? "障碍物过近，运动已受限"
              : "保持现场急停可用"
          }
        />
      </div>
      <div className="two-columns map-columns">
        <Section
          title="巡检现场"
          detail="地图背景为参考布局，位置和轨迹来自上报数据"
        >
          <TwinMap twin={data.twin} large live={live} />
        </Section>
        <div className="stack">
          <Section title="巡检控制">
            <div className="padded stack">
              <button className="button primary" onClick={onControl}>
                <Route size={16} />
                打开任务驾驶台
                <ArrowUpRight size={16} />
              </button>
              <button
                className="button secondary"
                disabled={!online}
                onClick={onPause}
              >
                <Pause size={16} />
                暂停当前巡检
              </button>
              <button
                className="button danger"
                disabled={
                  !online || data.control?.safety_state === "ESTOP_LATCHED"
                }
                onClick={onEstop}
              >
                <ShieldAlert size={16} />
                急停并锁存
              </button>
            </div>
          </Section>
          <Section title="执行反馈">
            <dl className="detail-list">
              <div>
                <dt>最近任务</dt>
                <dd>{data.control?.last_task?.plan?.intent || "暂无"}</dd>
              </div>
              <div>
                <dt>目标位置</dt>
                <dd>{data.control?.last_task?.plan?.target || "—"}</dd>
              </div>
              <div>
                <dt>前方距离</dt>
                <dd>{valueText(data.control?.obstacle_distance_m, " m", 2)}</dd>
              </div>
              <div>
                <dt>返回信息</dt>
                <dd>{data.control?.voice_feedback || "等待任务执行结果"}</dd>
              </div>
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

const boards = [
  { name: "R-SENSE", role: "传感采集", color: "#479877" },
  { name: "R-SF", role: "车端星闪", color: "#b65d4b" },
  { name: "R-WIFI", role: "车端 Wi-Fi", color: "#4a81b2" },
  { name: "C-SF", role: "主机星闪接收", color: "#be9a37" },
  { name: "C-WIFI", role: "主机 Wi-Fi 接收", color: "#a26b9e" },
];
export function DiagnosticsPage({
  data,
  onConfigure,
}: {
  data: EdgeData;
  onConfigure: () => void;
}) {
  const online = data.connection === "online" || data.connection === "degraded";
  return (
    <div className="stack">
      <div className="stats-grid">
        <Stat
          label="边缘服务"
          value={online ? "已连接" : "未连接"}
          detail={
            data.system?.version
              ? `版本 ${data.system.version}`
              : "等待健康检查"
          }
        />
        <Stat
          label="ROS 2 桥接"
          value={online && data.control?.ros_connected ? "在线" : "离线"}
          detail="底盘与传感数据"
        />
        <Stat
          label="串口接入"
          value={`${data.transport.filter((p) => p.online).length} / ${data.transport.length}`}
          detail="接收端串口连接状态"
        />
        <Stat
          label="最后更新"
          value={
            data.updated
              ? new Date(data.updated).toLocaleTimeString("zh-CN", {
                  hour12: false,
                })
              : "—"
          }
          detail={
            data.streamOnline
              ? "WebSocket 实时推送已连接"
              : "HTTP 轮询 · 自动重连中"
          }
        />
      </div>
      <Section
        title="五板设备拓扑"
        detail="主机串口状态可直接观测；车端状态需遥测数据确认"
      >
        {" "}
        <div className="board-grid">
          {boards.map((board) => {
            const port = data.transport.find((p) => p.label === board.name);
            return (
              <div key={board.name} className="board-item">
                <span
                  className="board-symbol"
                  style={{ background: board.color }}
                >
                  <Radio size={20} />
                </span>
                <strong className="mono">{board.name}</strong>
                <small>{board.role}</small>
                <Badge tone={online && port?.online ? "good" : "neutral"}>
                  {online && port?.online
                    ? "已连接"
                    : port
                      ? "未连接"
                      : "待遥测"}
                </Badge>
                <span className="port-label">{port?.port || "—"}</span>
              </div>
            );
          })}
        </div>
      </Section>
      <div className="two-columns">
        <Section title="串口与数据质量" detail="统计累计帧、校验错误和最近异常">
          {data.transport.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>端口</th>
                    <th>接收帧</th>
                    <th>CRC 错误</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transport.map((p) => (
                    <tr key={p.port + p.label}>
                      <td>
                        <strong>{p.label}</strong>
                        <small>{p.port}</small>
                      </td>
                      <td>{p.frames_received}</td>
                      <td>{p.crc_errors}</td>
                      <td>
                        <Badge tone={p.online ? "good" : "warn"}>
                          {p.online ? "接收中" : "断开"}
                        </Badge>
                        {p.last_error && (
                          <small className="error-text break">
                            {p.last_error}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="暂无串口数据"
              detail="接入接收板并配置串口后自动显示"
            />
          )}
        </Section>
        <Section title="连接与诊断">
          <dl className="detail-list">
            <div>
              <dt>服务地址</dt>
              <dd className="mono break">{data.base || "同源代理 /api"}</dd>
            </div>
            <div>
              <dt>推送连接</dt>
              <dd>{data.streamOnline ? "已连接" : "等待重连"}</dd>
            </div>
            <div>
              <dt>视觉模型</dt>
              <dd>{data.vision?.loaded ? "已加载" : "未就绪"}</dd>
            </div>
            <div>
              <dt>本轮失败接口</dt>
              <dd>{data.errors.length}</dd>
            </div>
          </dl>
          <div className="padded action-row">
            <button className="button secondary" onClick={onConfigure}>
              配置服务地址
            </button>
            <button
              className="button secondary"
              onClick={() =>
                downloadFile(
                  "zhixun-fire-diagnostics.json",
                  JSON.stringify(
                    {
                      captured_at: new Date().toISOString(),
                      connection: data.connection,
                      stream: data.streamOnline,
                      system: data.system,
                      control: data.control,
                      transport: data.transport,
                      vision: data.vision,
                      errors: data.errors,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              <Download size={15} />
              导出诊断
            </button>
          </div>
          {data.errors.length > 0 && (
            <details className="raw-evidence">
              <summary>查看接口错误</summary>
              <pre>{data.errors.join("\n")}</pre>
            </details>
          )}
        </Section>
      </div>
    </div>
  );
}

export function ConnectionForm({
  base,
  onSave,
}: {
  base: string;
  onSave: (base: string) => void;
}) {
  const [value, setValue] = useState(base),
    [error, setError] = useState("");
  return (
    <form
      className="connection-form"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave(normalizeServiceUrl(value));
        } catch (err) {
          setError(err instanceof Error ? err.message : "地址无效");
        }
      }}
    >
      <p>默认使用同源代理。连接其他边缘服务时，请填写该服务的网络地址。</p>
      <label>
        边缘服务地址
        <input
          aria-label="边缘服务地址"
          type="text"
          placeholder="http://192.168.1.100:8787"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <InlineMessage message={error} />
      <div className="connection-hint">
        <Server size={18} />
        <span>跨域服务需要允许当前网站来源。HTTPS 网站请连接 HTTPS 服务。</span>
      </div>
      <div className="form-actions">
        <button
          className="button secondary"
          type="button"
          onClick={() => setValue("")}
        >
          使用默认代理
        </button>
        <button className="button primary" type="submit">
          保存并连接
        </button>
      </div>
    </form>
  );
}
