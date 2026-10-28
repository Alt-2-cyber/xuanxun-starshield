import { Activity, RefreshCw, ShieldCheck, Wifi } from "lucide-react";

export type AbSample = {
  event_id: string;
  sle_minus_wifi_ms: number;
  winner: "SLE" | "Wi-Fi" | "TIE";
  sle_retry_count: number;
  wifi_retry_count: number;
};

export type AbSummary = {
  paired_events: number;
  sle_wins: number;
  wifi_wins: number;
  ties: number;
  mean_abs_delta_ms: number;
  p95_abs_delta_ms: number;
  samples: AbSample[];
};

export const EMPTY_AB_SUMMARY: AbSummary = {
  paired_events: 0,
  sle_wins: 0,
  wifi_wins: 0,
  ties: 0,
  mean_abs_delta_ms: 0,
  p95_abs_delta_ms: 0,
  samples: [],
};

export function ExperimentPage({
  summary,
  loading,
  onRefresh,
}: {
  summary: AbSummary;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="experiment-page">
      <div className="advanced-heading">
        <div>
          <div className="control-eyebrow">
            <Activity size={14} /> 正式 paired A/B
          </div>
          <h2>星闪 / Wi-Fi 链路实验</h2>
          <p>
            只统计相同 event_id 同时抵达 C-SF 与 C-WIFI
            的真实接收样本，不混入未配对数据。
          </p>
        </div>
        <button
          className="button secondary"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />{" "}
          {loading ? "刷新中..." : "刷新数据"}
        </button>
      </div>

      <div className="experiment-kpis">
        <div className="experiment-kpi">
          <span>配对事件</span>
          <strong>{summary.paired_events}</strong>
          <small>同一 event_id</small>
        </div>
        <div className="experiment-kpi sle">
          <span>
            <ShieldCheck size={13} /> SLE 胜出
          </span>
          <strong>{summary.sle_wins}</strong>
          <small>接收更早</small>
        </div>
        <div className="experiment-kpi wifi">
          <span>
            <Wifi size={13} /> Wi-Fi 胜出
          </span>
          <strong>{summary.wifi_wins}</strong>
          <small>接收更早</small>
        </div>
        <div className="experiment-kpi">
          <span>绝对差值均值</span>
          <strong>{summary.mean_abs_delta_ms.toFixed(2)} ms</strong>
          <small>SLE - Wi-Fi</small>
        </div>
        <div className="experiment-kpi">
          <span>P95 绝对差值</span>
          <strong>{summary.p95_abs_delta_ms.toFixed(2)} ms</strong>
          <small>配对样本</small>
        </div>
      </div>

      <div className="experiment-grid">
        <div className="panel experiment-panel">
          <div className="panel-header">
            <h2>
              <Activity size={15} /> 配对样本明细
            </h2>
            <span>{summary.samples.length} 条</span>
          </div>
          {summary.samples.length === 0 ? (
            <div className="experiment-empty">
              <Activity size={24} />
              <strong>等待真实双链路事件</strong>
              <p>
                需要 R-SENSE 同时输出到 R-SF 与 R-WIFI，并在两个中控端收到同一
                event_id。
              </p>
            </div>
          ) : (
            <div className="experiment-table-wrap">
              <table className="experiment-table">
                <thead>
                  <tr>
                    <th>event_id</th>
                    <th>SLE - Wi-Fi</th>
                    <th>胜出</th>
                    <th>重试</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.samples.map((sample) => (
                    <tr key={sample.event_id}>
                      <td>{sample.event_id}</td>
                      <td
                        className={
                          sample.sle_minus_wifi_ms < 0
                            ? "sle-text"
                            : "wifi-text"
                        }
                      >
                        {sample.sle_minus_wifi_ms.toFixed(2)} ms
                      </td>
                      <td>
                        <span
                          className={
                            "winner-pill " +
                            sample.winner.toLowerCase().replace("-", "")
                          }
                        >
                          {sample.winner}
                        </span>
                      </td>
                      <td>
                        {sample.sle_retry_count} / {sample.wifi_retry_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel experiment-method">
          <div className="panel-header">
            <h2>实验口径</h2>
            <span>可复核</span>
          </div>
          <div className="method-list">
            <div>
              <b>t0</b>
              <span>板端同一事件序号、设备时间</span>
            </div>
            <div>
              <b>t2</b>
              <span>两个中控串口帧在 edge 的接收单调时钟</span>
            </div>
            <div>
              <b>配对</b>
              <span>event_id 相同且两链路各有一条样本</span>
            </div>
            <div>
              <b>差值</b>
              <span>SLE t2 - Wi-Fi t2；负数表示 SLE 更早</span>
            </div>
            <div>
              <b>排除</b>
              <span>单链路事件不进入正式胜负统计</span>
            </div>
          </div>
          <div className="experiment-note">
            <ShieldCheck size={15} /> 数据来自 SQLite/JSONL 原始证据，可按
            event_id 回放。
          </div>
        </div>
      </div>
    </section>
  );
}
