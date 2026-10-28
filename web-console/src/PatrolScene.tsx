import {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent,
} from "react";
import {
  ArrowUpRight,
  Box,
  Camera,
  Radio,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { Badge } from "./components";
import type { EdgeData } from "./useEdge";

const faces = ["front", "back", "right", "left", "top", "bottom"] as const;

function Solid({
  w,
  h,
  d,
  x = 0,
  y = 0,
  z = 0,
  className = "",
  children,
}: {
  w: number;
  h: number;
  d: number;
  x?: number;
  y?: number;
  z?: number;
  className?: string;
  children?: ReactNode;
}) {
  const style = {
    "--w": `${w}px`,
    "--h": `${h}px`,
    "--d": `${d}px`,
    "--x": `${x}px`,
    "--y": `${y}px`,
    "--z": `${z}px`,
  } as CSSProperties;
  return (
    <div className={`solid ${className}`} style={style}>
      {faces.map((face) => (
        <div key={face} className={`solid-face face-${face}`}>
          {face === "front" ? children : null}
        </div>
      ))}
    </div>
  );
}

export function PatrolScene({
  live,
  visionReady,
  serviceOnline,
}: {
  live: boolean;
  visionReady: boolean;
  serviceOnline: boolean;
}) {
  const [front, setFront] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType !== "mouse" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--pointer-x",
      `${((event.clientX - rect.left) / rect.width - 0.5) * 12}deg`,
    );
    event.currentTarget.style.setProperty(
      "--pointer-y",
      `${((event.clientY - rect.top) / rect.height - 0.5) * -8}deg`,
    );
  };
  const reset = () => {
    stage.current?.style.setProperty("--pointer-x", "0deg");
    stage.current?.style.setProperty("--pointer-y", "0deg");
  };
  return (
    <div
      ref={stage}
      className={`patrol-scene ${front ? "front-view" : ""} ${live ? "scene-online" : ""}`}
      onPointerMove={tilt}
      onPointerLeave={reset}
    >
      <div className="scene-grid" aria-hidden="true" />
      <div className="scene-coordinate">
        <span>ROBOT / R01</span>
        <span>STRUCTURE VIEW</span>
      </div>
      <div
        className="scene-camera"
        role="img"
        aria-label="R01 巡检机器人立体结构示意：四轮底盘、传感塔和视觉单元"
      >
        <div className="scene-object">
          <Solid w={338} h={9} d={224} y={72} className="scene-plinth" />
          <div className="vehicle">
            <Solid w={213} h={33} d={116} y={15} className="vehicle-base">
              <span className="vehicle-label">
                R01 <i>ZHIXUN</i>
              </span>
            </Solid>
            <Solid w={167} h={23} d={100} y={-13} className="vehicle-deck" />
            {[-76, 76].flatMap((x) =>
              [-66, 66].map((z) => (
                <Solid
                  key={`${x}-${z}`}
                  w={43}
                  h={43}
                  d={20}
                  x={x}
                  y={35}
                  z={z}
                  className="vehicle-wheel"
                >
                  <i />
                </Solid>
              )),
            )}
            <Solid
              w={61}
              h={41}
              d={54}
              x={30}
              y={-45}
              className="vehicle-sensor"
            >
              <span className="camera-lens" />
            </Solid>
            <Solid
              w={58}
              h={7}
              d={64}
              x={30}
              y={-70}
              className="vehicle-sensor-cap"
            />
            <Solid
              w={8}
              h={62}
              d={8}
              x={-48}
              y={-57}
              className="vehicle-mast"
            />
            <Solid
              w={48}
              h={10}
              d={38}
              x={-48}
              y={-93}
              className="vehicle-lidar"
            >
              <span className="lidar-window" />
            </Solid>
            <Solid
              w={16}
              h={14}
              d={16}
              x={-48}
              y={-104}
              className="vehicle-beacon"
            />
          </div>
        </div>
      </div>
      <div className="scene-callout callout-vision">
        <Camera size={16} />
        <span>
          <strong>视觉单元</strong>
          <small>{visionReady ? "模型已就绪" : "等待图像接入"}</small>
        </span>
        <i className={visionReady ? "status-light online" : "status-light"} />
      </div>
      <div className="scene-callout callout-link">
        <Radio size={16} />
        <span>
          <strong>双链路通信</strong>
          <small>{live ? "机器人链路已连接" : "星闪 · Wi-Fi"}</small>
        </span>
      </div>
      <div className="scene-bottom">
        <span>
          <i className={serviceOnline ? "online-dot" : "offline-dot"} />
          设备结构示意 · 非实车画面
        </span>
        <button
          className="scene-view-button"
          aria-label="切换机器人模型视角"
          aria-pressed={front}
          onClick={() => setFront(!front)}
        >
          <RotateCcw size={13} />
          {front ? "斜视" : "正视"}
        </button>
      </div>
    </div>
  );
}

export function PatrolHero({
  data,
  onControl,
  onDiagnostics,
}: {
  data: EdgeData;
  onControl: () => void;
  onDiagnostics: () => void;
}) {
  const online = data.connection === "online" || data.connection === "degraded";
  const live = online && !!data.control?.ros_connected;
  const fault =
    data.control?.safety_state === "ESTOP_LATCHED" ||
    data.control?.safety_state === "FAULT";
  return (
    <section className="patrol-hero">
      <div className="hero-story">
        <span className="hero-kicker">
          <span className="hero-kicker-line" />
          INTELLIGENT FIELD OPERATIONS
        </span>
        <h2>
          每一程巡检，
          <br />
          <em>多一分安心。</em>
        </h2>
        <p>从环境感知到风险复核，让现场的每一次变化都有迹可循。</p>
        <div className="hero-current">
          <span className="unit-avatar">
            <ScanLine size={21} />
          </span>
          <span>
            <strong>R01 巡检机器人</strong>
            <small>
              {!online
                ? "等待边缘服务连接"
                : fault
                  ? "存在安全记录，请核对现场"
                  : live
                    ? "机器人数据链路已建立"
                    : "边缘服务在线 · 等待机器人接入"}
            </small>
          </span>
          <Badge tone={live ? "good" : fault ? "danger" : "neutral"}>
            {live ? "在线" : fault ? "待核实" : "待连接"}
          </Badge>
        </div>
        <div className="hero-actions">
          <button className="button primary" onClick={onControl}>
            打开任务驾驶台
            <ArrowUpRight size={16} />
          </button>
          <button className="hero-secondary" onClick={onDiagnostics}>
            查看设备
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <PatrolScene
        live={live}
        serviceOnline={online}
        visionReady={!!data.vision?.loaded}
      />
    </section>
  );
}

export function SystemReadiness({ data }: { data: EdgeData }) {
  const online = data.connection === "online" || data.connection === "degraded";
  const entries = [
    {
      icon: ShieldCheck,
      title: "边缘服务",
      detail: "REST / WebSocket",
      value: online ? "已连接" : "待连接",
      good: online,
    },
    {
      icon: Box,
      title: "机器人链路",
      detail: "ROS 2 / Micro-ROS",
      value: online && data.control?.ros_connected ? "已接入" : "待接入",
      good: online && !!data.control?.ros_connected,
    },
    {
      icon: Camera,
      title: "视觉识别",
      detail: data.vision?.model_version || "模型状态",
      value: online && data.vision?.loaded ? "已就绪" : "待就绪",
      good: online && !!data.vision?.loaded,
    },
    {
      icon: Wifi,
      title: "消息推送",
      detail: "实时事件与状态",
      value: data.streamOnline ? "同步中" : "重连中",
      good: data.streamOnline,
    },
  ];
  return (
    <div className="system-readiness">
      {entries.map(({ icon: Icon, title, detail, value, good }) => (
        <div key={title}>
          <span className={`readiness-icon ${good ? "ready" : ""}`}>
            <Icon size={18} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
          <span className={`readiness-value ${good ? "ready" : ""}`}>
            <i />
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LinkSculpture({
  sle,
  wifi,
  ties,
  total,
}: {
  sle: number;
  wifi: number;
  ties: number;
  total: number;
}) {
  const max = Math.max(1, sle, wifi, ties);
  return (
    <div
      className="link-sculpture"
      aria-label={`双链路配对：SLE 胜出 ${sle}，Wi-Fi 胜出 ${wifi}，相同 ${ties}`}
    >
      <div className="sculpture-bars">
        {[
          { label: "SLE", value: sle },
          { label: "Wi-Fi", value: wifi },
          { label: "同达", value: ties },
        ].map((item) => (
          <div key={item.label} className="sculpture-column">
            <strong>{item.value}</strong>
            <div className="sculpture-track">
              <i
                style={
                  {
                    "--bar-height": `${(item.value / max) * 90}px`,
                  } as CSSProperties
                }
              />
            </div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <span className="sculpture-note">
        {total
          ? `基于 ${total} 个同源配对事件`
          : "等待同源事件，暂不生成对比结论"}
      </span>
    </div>
  );
}
