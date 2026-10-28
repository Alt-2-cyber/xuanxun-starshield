import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Search } from "lucide-react";
import { csvText, downloadFile, request } from "./api";
import {
  Badge,
  Dialog,
  Empty,
  InlineMessage,
  Level,
  Section,
  isDemo,
  timeText,
  valueText,
} from "./components";
import type { AlertEvent } from "./types";

export function exportEvents(events: AlertEvent[]) {
  const rows: unknown[][] = [
    [
      "事件编号",
      "发生时间",
      "等级",
      "机器人",
      "来源",
      "确认状态",
      "温度(℃)",
      "烟雾比值",
      "气体比值",
      "X(m)",
      "Y(m)",
      "数据类型",
    ],
  ];
  events.forEach((e) =>
    rows.push([
      e.event_id,
      e.created_at,
      e.level,
      e.robot_id,
      e.transport,
      e.acked ? "已确认" : "待确认",
      e.sensor_values?.temperature_c,
      e.sensor_values?.smoke_ratio,
      e.sensor_values?.gas_ratio,
      e.pose?.x,
      e.pose?.y,
      isDemo(e.event_id) ? "演示" : "接收事件",
    ]),
  );
  downloadFile(
    `zhixun-fire-events-${new Date().toISOString().slice(0, 10)}.csv`,
    csvText(rows),
    "text/csv",
  );
}
export function EventsPage({
  events,
  connected,
  onOpen,
  onRefresh,
}: {
  events: AlertEvent[];
  connected: boolean;
  onOpen: (e: AlertEvent) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState(""),
    [level, setLevel] = useState("ALL"),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(0);
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (level === "ALL" || e.level === level) &&
          (status === "ALL" || (status === "ACK" ? e.acked : !e.acked)) &&
          `${e.event_id} ${e.robot_id} ${e.source_id} ${e.transport} ${e.trigger_bits.join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [events, query, level, status],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12)),
    current = Math.min(page, pageCount - 1);
  return (
    <div className="stack">
      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="搜索事件"
            placeholder="搜索事件编号、机器人或来源"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="告警等级"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">所有等级</option>
          {["P1", "P2", "P3", "NORMAL"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select
          aria-label="确认状态"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">所有状态</option>
          <option value="OPEN">待确认</option>
          <option value="ACK">已确认</option>
        </select>
        <button
          className="button secondary"
          disabled={!filtered.length}
          onClick={() => exportEvents(filtered)}
        >
          <Download size={15} />
          导出筛选结果
        </button>
      </div>
      <Section
        title="告警事件"
        detail={`最近 ${events.length} 条记录 · 筛选后 ${filtered.length} 条`}
        actions={
          <Badge tone={connected ? "good" : "warn"}>
            {connected ? "服务已连接" : "离线缓存"}
          </Badge>
        }
      >
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table className="data-table event-table">
                <thead>
                  <tr>
                    <th>事件 / 时间</th>
                    <th>风险等级</th>
                    <th>设备 / 来源</th>
                    <th>传感器摘要</th>
                    <th>确认状态</th>
                    <th className="align-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(current * 12, current * 12 + 12).map((e) => (
                    <tr key={e.event_id}>
                      <td>
                        <button className="event-id" onClick={() => onOpen(e)}>
                          {e.event_id}
                        </button>
                        <small>
                          {timeText(e.created_at)}{" "}
                          {isDemo(e.event_id) ? "· 演示事件" : ""}
                        </small>
                      </td>
                      <td>
                        <Level level={e.level} />
                      </td>
                      <td>
                        <strong>{e.robot_id}</strong>
                        <small>
                          {e.source_id} · {e.transport}
                        </small>
                      </td>
                      <td>
                        {valueText(e.sensor_values?.temperature_c, " ℃")}
                        <small>
                          烟雾 {valueText(e.sensor_values?.smoke_ratio, "", 2)}{" "}
                          · 气体 {valueText(e.sensor_values?.gas_ratio, "", 2)}
                        </small>
                      </td>
                      <td>
                        <Badge tone={e.acked ? "neutral" : "warn"}>
                          {e.acked ? "已确认" : "待确认"}
                        </Badge>
                      </td>
                      <td className="align-right">
                        <button className="text-link" onClick={() => onOpen(e)}>
                          查看证据 ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                第 {current + 1} / {pageCount} 页 · 最多载入最近 200 条
              </span>
              <button
                className="icon-button"
                aria-label="上一页"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="下一页"
                disabled={current === pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        ) : (
          <Empty
            title={
              query || level !== "ALL" || status !== "ALL"
                ? "没有符合条件的事件"
                : "暂无告警事件"
            }
            detail={
              connected
                ? "调整筛选条件，或等待设备上报。"
                : "连接边缘服务后，可查看持久化事件。"
            }
          >
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setLevel("ALL");
                setStatus("ALL");
                setPage(0);
                onRefresh();
              }}
            >
              重置并刷新
            </button>
          </Empty>
        )}
      </Section>
      <p className="footnote">
        人工确认表示事件已被查看，风险等级和机器人安全状态保持由现场情况决定。
      </p>
    </div>
  );
}

export function EventDetail({
  event,
  base,
  connected,
  onClose,
  onAck,
  ackBusy,
}: {
  event: AlertEvent;
  base: string;
  connected: boolean;
  onClose: () => void;
  onAck: (e: AlertEvent) => Promise<void>;
  ackBusy: boolean;
}) {
  const [evidence, setEvidence] = useState<Record<string, unknown> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setEvidence(null);
    setLoading(true);
    setError("");
    request<Record<string, unknown>>(
      base,
      `/api/v1/events/${encodeURIComponent(event.event_id)}/evidence`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (live) setEvidence(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [event.event_id, base, retry, event.acked]);
  return (
    <Dialog title="告警证据详情" onClose={onClose} wide>
      <div className="event-detail">
        <div className="event-detail-title">
          <Level level={event.level} />
          <div>
            <h3>
              {event.trigger_bits.includes("VISION")
                ? "视觉异常待复核"
                : "传感器异常事件"}
            </h3>
            <span className="mono">{event.event_id}</span>
          </div>
          <Badge tone={event.acked ? "neutral" : "warn"}>
            {event.acked ? "已确认" : "待确认"}
          </Badge>
        </div>
        {isDemo(event.event_id) && (
          <div className="demo-note">演示事件 · 用于软件联动验证</div>
        )}
        <dl className="detail-list">
          <div>
            <dt>发生时间</dt>
            <dd>{timeText(event.created_at)}</dd>
          </div>
          <div>
            <dt>机器人 / 来源</dt>
            <dd>
              {event.robot_id} · {event.source_id} · {event.transport}
            </dd>
          </div>
          <div>
            <dt>触发项</dt>
            <dd>{event.trigger_bits.join(" / ") || "—"}</dd>
          </div>
          <div>
            <dt>位置</dt>
            <dd>
              {valueText(event.pose?.x)}, {valueText(event.pose?.y)} m
            </dd>
          </div>
        </dl>
        <div className="sensor-grid">
          <div>
            <span>温度</span>
            <strong>
              {valueText(event.sensor_values?.temperature_c, " ℃")}
            </strong>
          </div>
          <div>
            <span>烟雾比值</span>
            <strong>
              {valueText(event.sensor_values?.smoke_ratio, "", 2)}
            </strong>
          </div>
          <div>
            <span>气体比值</span>
            <strong>{valueText(event.sensor_values?.gas_ratio, "", 2)}</strong>
          </div>
        </div>
        <details className="raw-evidence">
          <summary>原始事件与链路证据</summary>
          {loading ? (
            <p>加载中…</p>
          ) : evidence ? (
            <pre className="json-view">{JSON.stringify(evidence, null, 2)}</pre>
          ) : (
            <>
              <InlineMessage message={error} />
              <button
                className="button secondary"
                onClick={() => setRetry((n) => n + 1)}
              >
                重新加载证据
              </button>
            </>
          )}
        </details>
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={!evidence}
            onClick={() =>
              downloadFile(
                `evidence-${event.event_id}.json`,
                JSON.stringify(evidence, null, 2),
              )
            }
          >
            <Download size={15} />
            导出证据
          </button>
          <button
            className="button primary"
            disabled={!connected || event.acked || ackBusy}
            onClick={() => void onAck(event)}
          >
            <Check size={15} />
            {ackBusy ? "确认中…" : event.acked ? "已人工确认" : "确认已查看"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
