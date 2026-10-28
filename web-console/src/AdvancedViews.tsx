import { useEffect, useId, useMemo, useState } from "react";
import {
  Camera,
  Check,
  Download,
  Edit3,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ScanSearch,
} from "lucide-react";
import { csvText, downloadFile, request } from "./api";
import {
  Badge,
  Empty,
  InlineMessage,
  Level,
  Section,
  timeText,
  valueText,
} from "./components";
import type {
  AlertEvent,
  Pose,
  ReplayState,
  RiskZone,
  TwinSnapshot,
  VisionStatus,
} from "./types";
export type { ReplayState, TwinSnapshot, VisionStatus } from "./types";

export function TwinMap({
  twin,
  large = false,
  live = false,
  onEvent,
}: {
  twin: TwinSnapshot | null;
  large?: boolean;
  live?: boolean;
  onEvent?: (event: AlertEvent) => void;
}) {
  const [spatial, setSpatial] = useState(true);
  const gridId = useId();
  const geometry = useMemo(() => {
    const points = [
      ...(twin?.risk_zones ?? []),
      ...(twin?.active_alerts.map((e) => e.pose) ?? []),
      ...(live ? (twin?.trail ?? []) : []),
    ];
    const minX = Math.min(0, ...points.map((p) => p.x - 3));
    const minY = Math.min(0, ...points.map((p) => p.y - 3));
    const maxX = Math.max(20, ...points.map((p) => p.x + 3));
    const maxY = Math.max(12, ...points.map((p) => p.y + 3));
    const scale = Math.min(880 / (maxX - minX), 430 / (maxY - minY));
    const pos = (p: { x: number; y: number }) => ({
      x: 60 + (p.x - minX) * scale,
      y: 500 - (p.y - minY) * scale,
    });
    return { pos, scale };
  }, [twin, live]);
  return (
    <div
      className={`twin-map ${large ? "large" : ""} ${spatial ? "isometric" : "plan-view"}`}
    >
      <div className="map-toolbar">
        <span className="map-title">
          <span className="map-dot" />
          空间坐标视图
        </span>
        <div className="map-view-actions">
          <Badge tone={live ? "good" : "neutral"}>
            {live ? "位姿已连接" : "等待位姿"}
          </Badge>
          <div className="map-view-toggle" aria-label="地图显示方式">
            <button aria-pressed={spatial} onClick={() => setSpatial(true)}>
              3D
            </button>
            <button aria-pressed={!spatial} onClick={() => setSpatial(false)}>
              2D
            </button>
          </div>
        </div>
      </div>
      <div className="map-stage">
        <div className="map-floor">
          <svg
            viewBox="0 0 1000 560"
            role="img"
            aria-label="机器人轨迹与风险区域坐标示意图"
          >
            <defs>
              <pattern
                id={gridId}
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="#364b35"
                  strokeWidth=".8"
                />
              </pattern>
            </defs>
            <rect width="1000" height="560" fill="#1d2d21" />
            <rect width="1000" height="560" fill={`url(#${gridId})`} />
            <g
              fill="#2e4230"
              stroke="#5a7450"
              strokeWidth="2"
              className="map-rooms"
            >
              <rect x="58" y="74" width="310" height="152" />
              <rect x="420" y="74" width="260" height="152" />
              <rect x="730" y="74" width="210" height="152" />
              <rect x="58" y="335" width="310" height="152" />
              <rect x="420" y="335" width="260" height="152" />
              <rect x="730" y="335" width="210" height="152" />
            </g>
            <g fill="#adc39d" fontSize="18">
              <text x="80" y="103">
                参考布局 A
              </text>
              <text x="442" y="103">
                设备区
              </text>
              <text x="752" y="103">
                通道 B
              </text>
            </g>
            <path
              d="M60 280 H940"
              stroke="#68805b"
              strokeWidth="2"
              strokeDasharray="7 8"
            />
            {twin?.risk_zones.map((zone) => {
              const p = geometry.pos(zone);
              return (
                <g key={zone.zone_id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={zone.radius_m * geometry.scale}
                    fill={zone.level === "high" ? "#593c2d" : "#494d31"}
                    stroke={zone.level === "high" ? "#eaa07d" : "#c7c08b"}
                    strokeDasharray="6 4"
                    opacity=".8"
                  />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    fill="#e2d8a8"
                    textAnchor="middle"
                    fontSize="17"
                  >
                    {zone.name}
                  </text>
                </g>
              );
            })}
            {live && !!twin?.trail.length && (
              <polyline
                points={twin.trail
                  .map((p) => {
                    const q = geometry.pos(p);
                    return `${q.x},${q.y}`;
                  })
                  .join(" ")}
                stroke="#d8edaa"
                strokeWidth="3"
                strokeDasharray="5 5"
                fill="none"
              />
            )}
            {twin?.heat_points
              .filter((p) => p.source_event_id)
              .map((point, index) => {
                const p = geometry.pos(point);
                return (
                  <circle
                    key={index}
                    cx={p.x}
                    cy={p.y}
                    r={point.radius_m * geometry.scale}
                    fill="#f0a17e"
                    opacity={Math.max(0.06, point.intensity * 0.24)}
                  />
                );
              })}
            {live && twin && (
              <g
                transform={`translate(${geometry.pos(twin.robot_pose).x},${geometry.pos(twin.robot_pose).y})`}
              >
                <circle
                  r="22"
                  fill="#d8edaa"
                  stroke="#233e29"
                  strokeWidth="4"
                />
                <path
                  d="M0 -10 L8 7 L0 3 L-8 7 Z"
                  fill="#223a25"
                  transform={`rotate(${(-twin.robot_pose.yaw * 180) / Math.PI})`}
                />
                <text y="40" fill="#d8edaa" fontSize="17" textAnchor="middle">
                  R01
                </text>
              </g>
            )}
            {twin?.active_alerts.map((event) => {
              const p = geometry.pos(event.pose);
              return (
                <g
                  key={event.event_id}
                  transform={`translate(${p.x},${p.y})`}
                  role={onEvent ? "button" : undefined}
                  tabIndex={onEvent ? 0 : undefined}
                  aria-label={`查看事件 ${event.event_id}`}
                  onClick={() => onEvent?.(event)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onEvent?.(event);
                    }
                  }}
                  className={onEvent ? "map-event" : ""}
                >
                  <circle
                    r="15"
                    fill="#c48969"
                    stroke="#f7e8cd"
                    strokeWidth="3"
                  />
                  <text
                    textAnchor="middle"
                    y="5"
                    fontSize="11"
                    fill="white"
                    fontWeight="700"
                  >
                    {event.level}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {!twin && (
        <div className="map-waiting">连接服务后显示风险点与巡检位置</div>
      )}
      <div className="map-bottom">
        <span>
          <i className="legend-dot teal" />
          机器人
          <i className="legend-dot amber" />
          风险区
          <i className="legend-dot red" />
          事件
        </span>
        <small>
          {twin?.map_version?.includes("demo")
            ? "示意地图 · 等待实际 SLAM 地图接入"
            : "坐标示意 · 背景为参考布局"}
        </small>
      </div>
    </div>
  );
}

export function TwinPage({
  twin,
  live,
  onEvent,
}: {
  twin: TwinSnapshot | null;
  live: boolean;
  onEvent: (event: AlertEvent) => void;
}) {
  return (
    <div className="two-columns map-columns">
      <Section title="空间态势" detail="轨迹、风险分区与事件位置">
        <TwinMap twin={twin} large live={live} onEvent={onEvent} />
      </Section>
      <div className="stack">
        <Section title="位姿与地图">
          <dl className="detail-list">
            <div>
              <dt>坐标系</dt>
              <dd>{twin?.robot_pose.frame_id ?? "map"}</dd>
            </div>
            <div>
              <dt>地图版本</dt>
              <dd className="mono">{twin?.map_version ?? "—"}</dd>
            </div>
            <div>
              <dt>当前位置</dt>
              <dd>
                {live
                  ? `${valueText(twin?.robot_pose.x)} / ${valueText(twin?.robot_pose.y)} m`
                  : "等待机器人连接"}
              </dd>
            </div>
            <div>
              <dt>轨迹点</dt>
              <dd>{live ? (twin?.trail.length ?? 0) : "—"}</dd>
            </div>
          </dl>
        </Section>
        <Section title="动态风险点" detail="按事件等级与时间衰减计算">
          {twin?.heat_points.length ? (
            <div className="simple-list">
              {twin.heat_points.map((point, i) => (
                <div key={i}>
                  <span className="heat-key" />
                  <div>
                    <strong>{point.label}</strong>
                    <small>
                      {point.x.toFixed(1)}, {point.y.toFixed(1)} m
                    </small>
                  </div>
                  <b>{Math.round(point.intensity * 100)}%</b>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="暂无风险点" />
          )}
        </Section>
      </div>
    </div>
  );
}

export function RiskZonePage({
  twin,
  connected,
  onSave,
}: {
  twin: TwinSnapshot | null;
  connected: boolean;
  onSave: (zone: RiskZone) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<RiskZone | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || busy) return;
    if (
      !draft.name.trim() ||
      ![draft.x, draft.y, draft.radius_m].every(Number.isFinite) ||
      draft.radius_m <= 0 ||
      draft.radius_m > 50
    ) {
      setError("请填写区域名称、有效坐标及 0～50 米范围内的半径");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (await onSave({ ...draft, name: draft.name.trim() })) setDraft(null);
      else setError("保存未完成，请检查连接后重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack">
      <div className="section-intro">
        <p>
          标记设备间、充电区等重点位置，区域会同步显示在态势地图中。当前区域配置在服务重启后需重新设置。
        </p>
        <button
          className="button primary"
          disabled={!connected}
          onClick={() => {
            setError("");
            setDraft({
              zone_id: crypto.randomUUID(),
              name: "",
              level: "medium",
              x: 10,
              y: 5,
              radius_m: 2,
            });
          }}
        >
          <Plus size={16} />
          新增区域
        </button>
      </div>
      <div className="two-columns map-columns">
        <Section title="风险区域分布" detail="坐标范围随区域自动调整">
          <TwinMap twin={twin} large />
        </Section>
        <Section
          title={draft ? "编辑风险区域" : "区域清单"}
          detail={`${twin?.risk_zones.length ?? 0} 个区域`}
        >
          {draft ? (
            <form className="zone-form" onSubmit={save}>
              <label>
                区域名称
                <input
                  autoFocus
                  aria-label="区域名称"
                  value={draft.name}
                  maxLength={32}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                />
              </label>
              <label>
                风险等级
                <select
                  value={draft.level}
                  onChange={(e) =>
                    setDraft({ ...draft, level: e.target.value })
                  }
                >
                  <option value="low">低风险</option>
                  <option value="medium">中风险</option>
                  <option value="high">高风险</option>
                </select>
              </label>
              <div className="form-row">
                {(["x", "y", "radius_m"] as const).map((key) => (
                  <label key={key}>
                    {key === "radius_m"
                      ? "半径 / m"
                      : `${key.toUpperCase()} / m`}
                    <input
                      type="number"
                      step="0.1"
                      aria-label={key}
                      value={Number.isNaN(draft[key]) ? "" : draft[key]}
                      min={key === "radius_m" ? ".1" : "-10000"}
                      max={key === "radius_m" ? "50" : "10000"}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.valueAsNumber })
                      }
                      required
                    />
                  </label>
                ))}
              </div>
              <InlineMessage message={error} />
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setDraft(null)}
                  disabled={busy}
                >
                  取消
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? "保存中…" : "保存区域"}
                </button>
              </div>
            </form>
          ) : twin?.risk_zones.length ? (
            <div className="zone-list">
              {twin.risk_zones.map((zone) => (
                <div key={zone.zone_id}>
                  <MapPin size={18} />
                  <span>
                    <strong>{zone.name}</strong>
                    <small>
                      {zone.x.toFixed(1)}, {zone.y.toFixed(1)} · 半径{" "}
                      {zone.radius_m} m
                    </small>
                  </span>
                  <Badge
                    tone={
                      zone.level === "high"
                        ? "danger"
                        : zone.level === "low"
                          ? "good"
                          : "warn"
                    }
                  >
                    {{ low: "低", medium: "中", high: "高" }[zone.level] ??
                      zone.level}
                  </Badge>
                  <button
                    className="icon-button"
                    aria-label={`编辑${zone.name}`}
                    disabled={!connected}
                    onClick={() => setDraft({ ...zone })}
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="暂无区域" detail="新增后会显示在地图中" />
          )}
        </Section>
      </div>
    </div>
  );
}

export function VisionPage({
  vision,
  connected,
  onVision,
  demoRunning,
}: {
  vision: VisionStatus | null;
  connected: boolean;
  onVision: () => void;
  demoRunning: boolean;
}) {
  return (
    <div className="two-columns">
      <Section
        title="视觉识别服务"
        actions={
          <Badge tone={vision?.loaded ? "good" : "warn"}>
            {vision?.loaded ? "模型已加载" : "模型未就绪"}
          </Badge>
        }
      >
        <div className="vision-surface">
          <Camera size={38} strokeWidth={1} />
          <h3>等待图像接入</h3>
          <p>当前服务提供识别状态和事件接口，尚未提供网页视频流。</p>
        </div>
        <dl className="detail-list">
          <div>
            <dt>模型版本</dt>
            <dd className="mono">{vision?.model_version ?? "—"}</dd>
          </div>
          <div>
            <dt>模型文件</dt>
            <dd className="mono break">{vision?.model_path ?? "未配置"}</dd>
          </div>
          <div>
            <dt>诊断信息</dt>
            <dd>
              {vision?.fault ??
                (vision?.loaded ? "模型加载正常" : "等待服务状态")}
            </dd>
          </div>
        </dl>
      </Section>
      <div className="stack">
        <Section title="连续帧确认策略" detail="识别结果满足窗口门限后形成事件">
          <div className="rule-equation">
            <strong>5</strong>
            <span>/</span>
            <strong>7</strong>
            <small>帧命中</small>
            <i />
            <strong>0.75</strong>
            <small>置信度门限</small>
          </div>
          <p className="panel-note">
            这里展示服务端的确认规则；实际命中帧随识别服务生成，不显示虚拟检测结果。
          </p>
        </Section>
        <Section title="演示事件验证" detail="注入标记为 demo 的模拟视觉告警">
          <div className="padded">
            <p className="body-copy">
              用于检查告警、风险地图和证据回放的联动。演示事件会单独标识。
            </p>
            <button
              className="button secondary"
              onClick={onVision}
              disabled={!connected || demoRunning}
            >
              <ScanSearch size={16} />
              {demoRunning ? "生成中…" : "生成视觉演示事件"}
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function framePose(frame?: Record<string, unknown>): Pose | null {
  const data = frame?.pose ?? frame?.robot_pose;
  if (!data || typeof data !== "object") return null;
  const p = data as Partial<Pose>;
  return typeof p.x === "number" && typeof p.y === "number"
    ? { x: p.x, y: p.y, yaw: p.yaw ?? 0, quality: p.quality ?? "UNKNOWN" }
    : null;
}

export function ReplayPage({
  base,
  events,
  twin,
}: {
  base: string;
  events: AlertEvent[];
  twin: TwinSnapshot | null;
}) {
  const [selection, setSelection] = useState(""),
    [replay, setReplay] = useState<ReplayState | null>(null),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const id = selection || events[0]?.event_id || "";
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setReplay(null);
    setIndex(0);
    setPlaying(false);
    setError("");
    if (!id) return;
    setBusy(true);
    request<ReplayState>(
      base,
      `/api/v1/events/${encodeURIComponent(id)}/replay`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (active) setReplay(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [base, id]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setIndex((old) => {
          if (old >= (replay?.frames.length ?? 1) - 1) {
            setPlaying(false);
            return old;
          }
          return old + 1;
        }),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [playing, replay]);
  const frame = replay?.frames[index],
    pose = framePose(frame);
  const snapshot =
    twin && pose
      ? {
          ...twin,
          robot_pose: pose,
          trail: replay!.frames
            .slice(0, index + 1)
            .map(framePose)
            .filter((p): p is Pose => p !== null),
          active_alerts: twin.active_alerts.filter((e) => e.event_id === id),
        }
      : null;
  return (
    <div className="stack">
      <div className="filter-toolbar">
        <label>
          事件
          <select
            value={id}
            onChange={(e) => setSelection(e.target.value)}
            aria-label="选择回放事件"
          >
            <option value="" disabled>
              选择事件
            </option>
            {events.map((e) => (
              <option key={e.event_id} value={e.event_id}>
                {e.level} · {timeText(e.created_at)} · {e.event_id}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={!replay}
          onClick={() =>
            downloadFile(`replay-${id}.json`, JSON.stringify(replay, null, 2))
          }
        >
          <Download size={15} />
          导出回放
        </button>
      </div>
      <InlineMessage message={error} />
      {!id ? (
        <Section title="事件回放">
          <Empty
            title="还没有可回放的事件"
            detail="告警产生后可在这里查看历史帧"
          />
        </Section>
      ) : busy ? (
        <Section title="事件回放">
          <Empty title="正在加载回放…" />
        </Section>
      ) : (
        <>
          <div className="two-columns map-columns">
            <Section title="历史位置" detail={id}>
              <TwinMap twin={snapshot} live={!!pose} large />
            </Section>
            <Section
              title="回放帧详情"
              detail={`${replay?.frames.length ?? 0} 帧`}
            >
              {frame ? (
                <div className="padded">
                  <Badge tone="info">第 {index + 1} 帧</Badge>
                  <pre className="json-view">
                    {JSON.stringify(frame, null, 2)}
                  </pre>
                </div>
              ) : (
                <Empty
                  title="此事件暂无回放帧"
                  detail="可以从告警中心查看事件原始证据"
                />
              )}
            </Section>
          </div>
          <div className="playback">
            <button
              className="icon-button"
              aria-label={playing ? "暂停回放" : "播放回放"}
              disabled={(replay?.frames.length ?? 0) < 2}
              onClick={() => {
                if (index === (replay?.frames.length ?? 0) - 1) setIndex(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <input
              type="range"
              aria-label="回放帧位置"
              min={0}
              max={Math.max(0, (replay?.frames.length ?? 0) - 1)}
              value={index}
              disabled={!replay?.frames.length}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
            />
            <span>
              {replay?.frames.length
                ? `${index + 1} / ${replay.frames.length}`
                : "0 / 0"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
