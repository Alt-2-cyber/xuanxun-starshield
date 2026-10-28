import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  History,
  LayoutDashboard,
  Layers3,
  MapPin,
  Menu,
  Pause,
  Radio,
  RefreshCw,
  Route,
  ScanSearch,
  Settings,
  ShieldCheck,
  ShieldAlert,
  X,
  Wifi,
} from "lucide-react";
import {
  TwinMap,
  TwinPage,
  VisionPage,
  ReplayPage,
  RiskZonePage,
} from "./AdvancedViews";
import { ControlPage } from "./ControlPage";
import { ExperimentPage } from "./ExperimentPage";
import { EventDetail, EventsPage, exportEvents } from "./EventsPage";
import { ConnectionForm, DiagnosticsPage, PatrolPage } from "./OperationsPages";
import {
  Badge,
  Dialog,
  Empty,
  Level,
  Section,
  Stat,
  TextLink,
  isDemo,
  modeName,
  safetyLabel,
  timeText,
  valueText,
} from "./components";
import { explain, post, saveServiceUrl } from "./api";
import { useEdge, type EdgeData } from "./useEdge";
import { PatrolHero, SystemReadiness, LinkSculpture } from "./PatrolScene";
import type {
  AlertEvent,
  ControlMode,
  ControlState,
  PageKey,
  RiskZone,
  SystemSnapshot,
  TaskResponse,
} from "./types";

const navigation: Array<{
  key: PageKey;
  label: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
  group: number;
}> = [
  {
    key: "overview",
    label: "态势总览",
    subtitle: "实时掌握现场态势，协同每一次巡检。",
    icon: LayoutDashboard,
    group: 0,
  },
  {
    key: "patrol",
    label: "巡检任务",
    subtitle: "查看路线、进度与机器人执行状态。",
    icon: Route,
    group: 0,
  },
  {
    key: "alerts",
    label: "告警中心",
    subtitle: "从异常发现到人工确认，每一条都有据可查。",
    icon: Bell,
    group: 0,
  },
  {
    key: "control",
    label: "任务驾驶台",
    subtitle: "选择控制模式，查看指令的受理与执行反馈。",
    icon: Bot,
    group: 0,
  },
  {
    key: "twin",
    label: "空间态势",
    subtitle: "在同一坐标视图中查看机器人、风险区域与事件。",
    icon: Layers3,
    group: 1,
  },
  {
    key: "vision",
    label: "视觉识别",
    subtitle: "查看识别服务与模型状态，验证视觉事件联动。",
    icon: ScanSearch,
    group: 1,
  },
  {
    key: "replay",
    label: "证据回放",
    subtitle: "沿时间查看历史帧，复核事件发生过程。",
    icon: History,
    group: 1,
  },
  {
    key: "experiment",
    label: "双链路实验",
    subtitle: "基于同源事件，比较星闪与 Wi-Fi 的到达时间。",
    icon: Activity,
    group: 1,
  },
  {
    key: "risk-zones",
    label: "风险区域",
    subtitle: "维护需要重点关注的巡检位置。",
    icon: MapPin,
    group: 2,
  },
  {
    key: "diagnostics",
    label: "设备与连接",
    subtitle: "查看设备状态、数据质量与连接诊断。",
    icon: Settings,
    group: 2,
  },
];
function hashPage(): PageKey {
  const hash = window.location.hash.slice(1);
  return navigation.some((n) => n.key === hash)
    ? (hash as PageKey)
    : "overview";
}

export default function App() {
  const data = useEdge();
  const [page, setPage] = useState<PageKey>(hashPage),
    [menu, setMenu] = useState(false),
    [config, setConfig] = useState(false),
    [demo, setDemo] = useState(false);
  const [selection, setSelection] = useState<AlertEvent | null>(null),
    [pending, setPending] = useState<string[]>([]),
    [taskStatus, setTaskStatus] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: string } | null>(
    null,
  );
  const actions = useRef(new Set<string>()),
    currentBase = useRef(data.base);
  const actionRevision = useRef(0);
  currentBase.current = data.base;
  const online = data.connection === "online" || data.connection === "degraded";
  const unacked = data.events.filter((e) => !e.acked && e.status !== "CLEARED");
  const active = navigation.find((n) => n.key === page)!;
  const busy = pending.some((p) => ["mode", "task", "manual"].includes(p));
  const selected = selection
    ? (data.events.find((e) => e.event_id === selection.event_id) ?? selection)
    : null;
  useEffect(() => {
    const listener = () => setPage(hashPage());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    actionRevision.current++;
    setSelection(null);
    setTaskStatus("");
    setNotice(null);
    setDemo(false);
  }, [data.base]);
  const go = (next: PageKey) => {
    window.location.hash = next;
    setPage(next);
    setMenu(false);
    window.scrollTo(0, 0);
  };
  const perform = async <T,>(
    key: string,
    job: (isCurrent: () => boolean) => Promise<T>,
    success?: string,
  ): Promise<T | undefined> => {
    if (
      actions.current.has(key) ||
      (["mode", "task", "manual"].includes(key) &&
        [...actions.current].some((action) =>
          ["mode", "task", "manual"].includes(action),
        ))
    )
      return;
    const base = data.base;
    const revision = actionRevision.current;
    const isCurrent = () =>
      currentBase.current === base && actionRevision.current === revision;
    actions.current.add(key);
    setPending([...actions.current]);
    try {
      const result = await job(isCurrent);
      if (!isCurrent()) return undefined;
      if (success) setNotice({ text: success, tone: "success" });
      return result;
    } catch (error) {
      if (isCurrent())
        setNotice({
          text: error instanceof Error ? error.message : "操作未完成，请重试",
          tone: "error",
        });
      return undefined;
    } finally {
      actions.current.delete(key);
      setPending([...actions.current]);
    }
  };
  const safety = (kind: "pause" | "estop") => {
    if (!online) {
      setNotice({
        text: "服务未连接，远程操作无法送达。请检查连接。",
        tone: "error",
      });
      return;
    }
    void perform<SystemSnapshot>(
      kind,
      async (isCurrent) => {
        const result = await post<SystemSnapshot>(
          data.base,
          `/api/v1/safety/${kind}`,
          { request_id: crypto.randomUUID() },
        );
        if (isCurrent()) await data.refresh();
        return result;
      },
      kind === "pause"
        ? "服务已确认暂停请求。"
        : "服务已确认急停锁存请求，请核对车端状态。",
    );
  };
  const changeMode = (mode: ControlMode) => {
    if (busy) return;
    void perform(
      "mode",
      async (isCurrent) => {
        const result = await post<{ state: ControlState }>(
          data.base,
          "/api/v1/control/mode",
          { mode, request_id: crypto.randomUUID() },
        );
        if (isCurrent()) await data.refresh();
        if (isCurrent())
          setTaskStatus(
            result.state.voice_feedback || `当前模式：${modeName[mode]}`,
          );
        return result;
      },
      "控制模式已更新",
    );
  };
  const sendTask = async (text: string, source: "WEB" | "VOICE") => {
    if (busy) return;
    return perform<TaskResponse>(
      "task",
      async (isCurrent) => {
        const result = await post<TaskResponse>(
          data.base,
          "/api/v1/control/task",
          { text, source, request_id: crypto.randomUUID() },
        );
        if (result.result?.accepted === false)
          throw new Error(explain(result.result.reason || "任务未被受理"));
        if (isCurrent()) await data.refresh();
        if (isCurrent())
          setTaskStatus(
            result.result?.spoken_response ||
              result.plan?.explanation ||
              "任务已受理",
          );
        return result;
      },
      "任务已受理，请查看执行反馈",
    );
  };
  const manual = (linear_x: number, angular_z: number) => {
    if (busy) return;
    void perform("manual", async (isCurrent) => {
      const result = await post<{ state: ControlState }>(
        data.base,
        "/api/v1/control/manual",
        {
          linear_x,
          angular_z,
          duration_ms: 350,
          request_id: crypto.randomUUID(),
        },
      );
      if (isCurrent()) await data.refresh();
      if (isCurrent())
        setTaskStatus(
          result.state.voice_feedback || explain(result.state.last_reason),
        );
      return result;
    });
  };
  const ack = async (event: AlertEvent) => {
    await perform(
      `ack:${event.event_id}`,
      async (isCurrent) => {
        const changed = await post<AlertEvent>(
          data.base,
          `/api/v1/alerts/${encodeURIComponent(event.event_id)}/ack`,
        );
        if (isCurrent()) setSelection(changed);
        if (isCurrent()) await data.refresh();
        return changed;
      },
      "已记录人工确认，原始证据已保留",
    );
  };
  const simulate = (vision = false) => {
    void perform(
      "demo",
      async (isCurrent) => {
        const event = await post<AlertEvent>(
          data.base,
          vision ? "/api/v1/demo/vision" : "/api/v1/demo/alert",
        );
        if (isCurrent()) await data.refresh();
        if (isCurrent()) {
          setDemo(false);
          setSelection(event);
        }
        return event;
      },
      "演示事件已生成",
    );
  };
  const saveZone = async (zone: RiskZone) => {
    const result = await perform<RiskZone>(
      "zone",
      async (isCurrent) => {
        const result = await post<RiskZone>(
          data.base,
          "/api/v1/risk-zones",
          zone,
        );
        if (isCurrent()) await data.refresh();
        return result;
      },
      "风险区域已更新",
    );
    return !!result;
  };
  const link = (name: string) => data.transport.find((p) => p.label === name);

  return (
    <div className="app-shell">
      <aside id="primary-sidebar" className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#overview" onClick={() => go("overview")}>
          <span className="brand-mark">
            <img src="/brand-shield.svg" alt="" width="36" height="36" />
          </span>
          <span>
            <strong>
              智巡<span>消防</span>
            </strong>
            <small>ZHIXUN / FIELD OPS</small>
          </span>
        </a>
        <div className="site-label">
          <i />
          地下空间巡检工作台<span>R01</span>
        </div>
        <nav aria-label="主要导航">
          {["现场工作台", "感知与证据", "系统管理"].map((group, index) => (
            <div className="nav-group" key={group}>
              <div className="nav-caption">
                <span>0{index + 1}</span>
                {group}
              </div>
              {navigation
                .filter((n) => n.group === index)
                .map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    className={`nav-item ${page === key ? "active" : ""}`}
                    aria-current={page === key ? "page" : undefined}
                    onClick={() => go(key)}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    <span>{label}</span>
                    {key === "alerts" && unacked.length > 0 ? (
                      <b className="nav-count">{unacked.length}</b>
                    ) : page === key ? (
                      <ChevronRight size={15} />
                    ) : null}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-link">
            <Radio size={15} />
            <span>星闪接收端</span>
            <i
              className={
                online && link("C-SF")?.online ? "online-dot" : "offline-dot"
              }
            />
          </div>
          <div className="sidebar-link">
            <Wifi size={15} />
            <span>Wi-Fi 接收端</span>
            <i
              className={
                online && link("C-WIFI")?.online ? "online-dot" : "offline-dot"
              }
            />
          </div>
          <div className="workspace-label">
            <span>单车巡检系统</span>
            <span>V1.2</span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="收起导航"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="展开导航"
              aria-expanded={menu}
              aria-controls="primary-sidebar"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span className="topbar-path">
              现场工作台
              <ChevronRight size={14} />
              <strong>{active.label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <Badge
              tone={
                online
                  ? "good"
                  : data.connection === "connecting"
                    ? "info"
                    : "warn"
              }
            >
              {online
                ? "边缘服务已连接"
                : data.connection === "connecting"
                  ? "连接中"
                  : "服务未连接"}
            </Badge>
            <span className="stream-label">
              <i className={data.streamOnline ? "online-dot" : "offline-dot"} />
              {data.streamOnline ? "实时同步" : "轮询重连"}
            </span>
            <button
              className="icon-button notification-button"
              aria-label={`告警中心，${unacked.length} 条待确认`}
              onClick={() => go("alerts")}
            >
              <Bell size={19} />
              {unacked.length > 0 && <i />}
            </button>
            <span className="avatar" title="本地操作台">
              巡
            </span>
          </div>
        </header>
        <main className="main-content" id="main">
          <div className="page-header">
            <div>
              <div className="eyebrow">
                ROBOT OPERATIONS <span>/</span>{" "}
                {page === "overview"
                  ? "LIVE OVERVIEW"
                  : active.key.toUpperCase()}
              </div>
              <h1>{page === "overview" ? "巡检工作台" : active.label}</h1>
              <p>{active.subtitle}</p>
            </div>
            <div className="header-actions">
              <button
                className="button secondary"
                disabled={data.loading}
                onClick={() => void data.refresh()}
              >
                <RefreshCw size={16} className={data.loading ? "spin" : ""} />
                {data.loading ? "同步中…" : "刷新"}
              </button>
              <button
                className="button secondary"
                onClick={() => exportEvents(data.events)}
                disabled={!data.events.length}
              >
                <Download size={16} />
                导出记录
              </button>
              {page === "overview" && (
                <button
                  className="button primary"
                  onClick={() => setDemo(true)}
                  disabled={!online}
                >
                  <PlayIcon />
                  演示验证
                </button>
              )}
            </div>
          </div>
          {(data.connection === "offline" ||
            data.connection === "degraded") && (
            <div className="connection-banner" role="status">
              <CircleAlert size={17} />
              <span>
                {data.connection === "offline"
                  ? "边缘服务未连接，正在重试。当前显示上次同步的数据。"
                  : "部分数据接口暂不可用，其他功能可继续查看。"}
              </span>
              <button onClick={() => setConfig(true)}>检查连接 ↗</button>
            </div>
          )}
          {page === "overview" ? (
            <Overview data={data} onPage={go} onEvent={setSelection} />
          ) : page === "alerts" ? (
            <EventsPage
              events={data.events}
              connected={online}
              onOpen={setSelection}
              onRefresh={() => void data.refresh()}
            />
          ) : page === "control" ? (
            <ControlPage
              control={data.control}
              connected={online}
              busy={busy}
              onMode={changeMode}
              onTask={sendTask}
              onManual={manual}
              onPause={() => safety("pause")}
              onEstop={() => safety("estop")}
              taskStatus={taskStatus}
            />
          ) : page === "patrol" ? (
            <PatrolPage
              data={data}
              onControl={() => go("control")}
              onPause={() => safety("pause")}
              onEstop={() => safety("estop")}
            />
          ) : page === "twin" ? (
            <TwinPage
              twin={data.twin}
              live={online && !!data.control?.ros_connected}
              onEvent={setSelection}
            />
          ) : page === "vision" ? (
            <VisionPage
              vision={data.vision}
              connected={online}
              onVision={() => simulate(true)}
              demoRunning={pending.includes("demo")}
            />
          ) : page === "experiment" ? (
            <ExperimentPage
              summary={data.ab}
              loading={data.loading}
              onRefresh={() => void data.refresh()}
            />
          ) : page === "replay" ? (
            <ReplayPage
              base={data.base}
              events={data.events}
              twin={data.twin}
            />
          ) : page === "risk-zones" ? (
            <RiskZonePage
              twin={data.twin}
              connected={online}
              onSave={saveZone}
            />
          ) : (
            <DiagnosticsPage data={data} onConfigure={() => setConfig(true)} />
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} />
              感知现场 · 协同巡检 · 留存证据
            </span>
            <span>
              最近同步 {data.updated ? timeText(data.updated) : "等待连接"}
              <i />
              R01 · 智巡消防
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div
          className={`toast ${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "error" ? (
            <CircleAlert size={19} />
          ) : (
            <Check size={19} />
          )}
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {config && (
        <Dialog title="服务连接设置" onClose={() => setConfig(false)}>
          <ConnectionForm
            base={data.base}
            onSave={(base) => {
              try {
                saveServiceUrl(base);
                data.setBase(base);
                setConfig(false);
              } catch {
                setNotice({
                  text: "浏览器无法保存连接设置，请检查存储权限",
                  tone: "error",
                });
              }
            }}
          />
        </Dialog>
      )}
      {demo && (
        <Dialog title="演示验证" onClose={() => setDemo(false)}>
          <div className="demo-options">
            <p>生成有明确标记的演示事件，用于检查告警、地图与回放联动。</p>
            <button
              className="demo-option"
              disabled={pending.includes("demo")}
              onClick={() => simulate()}
            >
              <Bell size={24} />
              <span>
                <strong>传感器异常事件</strong>
                <small>温度与烟雾 · P2 告警</small>
              </span>
              <ArrowRight size={18} />
            </button>
            <button
              className="demo-option"
              disabled={pending.includes("demo")}
              onClick={() => simulate(true)}
            >
              <ScanSearch size={24} />
              <span>
                <strong>视觉确认事件</strong>
                <small>视觉确认窗口 · P3 告警</small>
              </span>
              <ArrowRight size={18} />
            </button>
            {pending.includes("demo") && <p role="status">正在生成演示事件…</p>}
          </div>
        </Dialog>
      )}
      {selected && (
        <EventDetail
          key={`${data.base}:${selected.event_id}`}
          event={selected}
          base={data.base}
          connected={online}
          onClose={() => setSelection(null)}
          onAck={ack}
          ackBusy={pending.includes(`ack:${selected.event_id}`)}
        />
      )}
    </div>
  );
}

function PlayIcon() {
  return <span className="play-glyph">▷</span>;
}
function Overview({
  data,
  onPage,
  onEvent,
}: {
  data: EdgeData;
  onPage: (page: PageKey) => void;
  onEvent: (e: AlertEvent) => void;
}) {
  const online = data.connection === "online" || data.connection === "degraded",
    live = online && !!data.control?.ros_connected;
  const unacked = data.events.filter((e) => !e.acked && e.status !== "CLEARED"),
    last = data.events[0];
  const safety = safetyLabel(data.control?.safety_state, online, live);
  return (
    <div className="stack overview">
      <PatrolHero
        data={data}
        onControl={() => onPage("control")}
        onDiagnostics={() => onPage("diagnostics")}
      />
      <SystemReadiness data={data} />
      <div className="overview-status">
        <span>
          <i className={live ? "online-dot" : "offline-dot"} />
          {live ? "机器人已连接" : "机器人未连接"}
          <b>R01</b>
          <span className="status-divider" />
          {modeName[data.control?.mode ?? ""] || "等待运行模式"}
        </span>
        <button className="text-link" onClick={() => onPage("diagnostics")}>
          设备诊断
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="stats-grid">
        <Stat
          label="机器人运行状态"
          value={safety}
          detail={live ? "已建立 ROS 2 数据链路" : "等待实车接入，暂无运动数据"}
          tone="teal-stat"
        />
        <Stat
          label="待确认告警"
          value={data.system ? unacked.length : "—"}
          detail={`最近 ${data.events.length} 条事件`}
          tone={unacked.length ? "alert-stat" : ""}
        />
        <Stat
          label="接收端在线"
          value={
            online
              ? `${data.transport.filter((p) => p.online).length} / ${data.transport.length}`
              : "—"
          }
          detail="按实际串口连接统计"
        />
        <Stat
          label="双链路配对样本"
          value={data.system ? data.ab.paired_events : "—"}
          detail="同一事件 · 星闪 / Wi-Fi"
        />
      </div>
      {unacked[0] && (
        <div className="attention-strip">
          <span className="attention-symbol">
            <Bell size={20} />
          </span>
          <div>
            <strong>{unacked.length} 条告警等待人工复核</strong>
            <p>
              {unacked[0].robot_id} · {unacked[0].trigger_bits.join(" / ")} ·{" "}
              {timeText(unacked[0].created_at)}
            </p>
          </div>
          <button
            className="button warning"
            onClick={() => onEvent(unacked[0])}
          >
            查看最新告警
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div className="two-columns map-columns">
        <Section
          title="巡检空间态势"
          detail="机器人位姿 · 风险区域 · 事件位置"
          actions={<TextLink onClick={() => onPage("twin")}>完整视图</TextLink>}
        >
          <TwinMap twin={data.twin} live={live} onEvent={onEvent} />
          <div className="map-info">
            <div>
              <span>当前路线</span>
              <strong>{data.system?.safety.patrol_name || "待配置"}</strong>
            </div>
            <div>
              <span>当前位置</span>
              <strong className="mono">
                {live
                  ? `${valueText(data.twin?.robot_pose.x)} / ${valueText(data.twin?.robot_pose.y)} m`
                  : "等待位姿"}
              </strong>
            </div>
            <div>
              <span>前方距离</span>
              <strong className="mono">
                {live
                  ? valueText(data.control?.obstacle_distance_m, " m", 2)
                  : "—"}
              </strong>
            </div>
          </div>
        </Section>
        <div className="stack overview-side">
          <Section
            title="最新事件摘要"
            actions={
              last ? <Level level={last.level} /> : <Badge>无事件</Badge>
            }
          >
            {last ? (
              <>
                <div className="event-summary">
                  <div className="event-summary-label">
                    <Clock3 size={14} />
                    {timeText(last.created_at)}
                    {isDemo(last.event_id) && <span>演示</span>}
                  </div>
                  <h3>
                    {last.trigger_bits.includes("VISION")
                      ? "视觉异常待复核"
                      : "传感器异常事件"}
                  </h3>
                  <p>
                    {last.robot_id} · {last.source_id} · {last.transport}
                  </p>
                  <div className="sensor-grid">
                    <div>
                      <span>温度</span>
                      <strong>
                        {valueText(last.sensor_values?.temperature_c, "°")}
                      </strong>
                    </div>
                    <div>
                      <span>烟雾</span>
                      <strong>
                        {valueText(last.sensor_values?.smoke_ratio, "", 2)}
                      </strong>
                    </div>
                    <div>
                      <span>气体</span>
                      <strong>
                        {valueText(last.sensor_values?.gas_ratio, "", 2)}
                      </strong>
                    </div>
                  </div>
                  <button
                    className="button full secondary"
                    onClick={() => onEvent(last)}
                  >
                    查看完整证据
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            ) : (
              <Empty title="暂无告警事件" detail="设备告警将自动显示在这里" />
            )}
          </Section>
          <Section
            title="通信链路"
            actions={
              <TextLink onClick={() => onPage("experiment")}>实验分析</TextLink>
            }
          >
            <div className="link-summary">
              {[
                { label: "SLE 星闪", key: "C-SF", icon: Radio },
                { label: "Wi-Fi", key: "C-WIFI", icon: Wifi },
              ].map(({ label, key, icon: Icon }) => {
                const port = data.transport.find((p) => p.label === key);
                const metric = data.system?.links.find(
                  (l) => l.name === (key === "C-SF" ? "SLE" : "Wi-Fi"),
                );
                return (
                  <div key={key}>
                    <span className="link-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{port?.port || "接收端未接入"}</small>
                    </span>
                    <span className="link-value">
                      <Badge tone={online && port?.online ? "good" : "neutral"}>
                        {online && port?.online ? "在线" : "未连接"}
                      </Badge>
                      <small>P95 {valueText(metric?.p95_ms, " ms")}</small>
                    </span>
                  </div>
                );
              })}
            </div>
            <LinkSculpture
              sle={data.ab.sle_wins}
              wifi={data.ab.wifi_wins}
              ties={data.ab.ties}
              total={data.ab.paired_events}
            />
          </Section>
        </div>
      </div>
      <Section
        title="最近告警"
        detail="记录异常发现、确认与证据"
        actions={<TextLink onClick={() => onPage("alerts")}>所有事件</TextLink>}
      >
        {data.events.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>事件编号</th>
                  <th>时间</th>
                  <th>风险</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th className="align-right">详情</th>
                </tr>
              </thead>
              <tbody>
                {data.events.slice(0, 4).map((e) => (
                  <tr key={e.event_id}>
                    <td>
                      <button className="event-id" onClick={() => onEvent(e)}>
                        {e.event_id}
                      </button>
                      {isDemo(e.event_id) && <small>演示事件</small>}
                    </td>
                    <td>{timeText(e.created_at)}</td>
                    <td>
                      <Level level={e.level} />
                    </td>
                    <td>
                      {e.robot_id} · {e.transport}
                    </td>
                    <td>
                      <Badge tone={e.acked ? "neutral" : "warn"}>
                        {e.acked ? "已确认" : "待确认"}
                      </Badge>
                    </td>
                    <td className="align-right">
                      <button
                        className="text-link"
                        aria-label={`查看 ${e.event_id}`}
                        onClick={() => onEvent(e)}
                      >
                        查看 ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="compact-empty">
            暂无事件。设备告警或演示验证产生的数据会记录在这里。
          </div>
        )}
      </Section>
    </div>
  );
}
