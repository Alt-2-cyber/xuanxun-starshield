import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  CircleStop,
  Gamepad2,
  Mic,
  Pause,
  Play,
  Route,
  ShieldAlert,
  Volume2,
  X,
} from "lucide-react";
import {
  Badge,
  InlineMessage,
  Section,
  modeName,
  safetyLabel,
  valueText,
} from "./components";
import type { ControlMode, ControlState, TaskResponse } from "./types";
export type { ControlMode, ControlState, TaskResponse } from "./types";
type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const modes = [
  {
    mode: "FIXED_PATROL" as const,
    title: "固定巡检",
    detail: "预设路线 · 环境避障",
    icon: Route,
  },
  {
    mode: "MANUAL" as const,
    title: "手动控制",
    detail: "方向操作 · 低速限幅",
    icon: Gamepad2,
  },
  {
    mode: "LOBSTER_AI" as const,
    title: "智能任务",
    detail: "文字与语音 · 任务规划",
    icon: Bot,
  },
];
export function ControlPage({
  control,
  connected,
  busy,
  onMode,
  onTask,
  onManual,
  onPause,
  onEstop,
  taskStatus,
}: {
  control: ControlState | null;
  connected: boolean;
  busy: boolean;
  onMode: (mode: ControlMode) => void;
  onTask: (
    text: string,
    source: "WEB" | "VOICE",
  ) => Promise<TaskResponse | undefined>;
  onManual: (linear: number, angular: number) => void;
  onPause: () => void;
  onEstop: () => void;
  taskStatus: string;
}) {
  const [prompt, setPrompt] = useState(""),
    [listening, setListening] = useState(false),
    [voiceError, setVoiceError] = useState("");
  const [source, setSource] = useState<"WEB" | "VOICE">("WEB");
  const recognitionRef = useRef<Recognition | null>(null);
  const locked =
    !connected ||
    !control ||
    control.safety_state === "ESTOP_LATCHED" ||
    control.safety_state === "FAULT";
  const canTask = !locked && !busy && control?.mode === "LOBSTER_AI";
  const canMove =
    !locked && !busy && !!control?.ros_connected && control?.mode === "MANUAL";
  useEffect(
    () => () => {
      const r = recognitionRef.current;
      if (r) {
        r.onend = null;
        r.onresult = null;
        r.onerror = null;
        r.abort();
      }
    },
    [],
  );
  useEffect(() => {
    if (locked || control?.mode !== "LOBSTER_AI") {
      recognitionRef.current?.abort();
      setListening(false);
    }
  }, [locked, control?.mode]);
  const voice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Speech =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) {
      setVoiceError("此浏览器不支持语音输入，可以继续使用文字输入。");
      return;
    }
    try {
      const r = new Speech();
      r.lang = "zh-CN";
      r.interimResults = false;
      r.continuous = false;
      r.onresult = (event) => {
        if (recognitionRef.current !== r) return;
        const text =
          event.results[event.results.length - 1]?.[0]?.transcript?.trim();
        if (text) {
          setPrompt(text);
          setSource("VOICE");
        }
      };
      r.onerror = (event) => {
        if (recognitionRef.current === r)
          setVoiceError(
            event.error === "not-allowed"
              ? "麦克风权限未开启，请在浏览器设置中允许访问。"
              : "语音识别未完成，请重试或输入文字。",
          );
      };
      r.onend = () => {
        if (recognitionRef.current === r) {
          recognitionRef.current = null;
          setListening(false);
        }
      };
      recognitionRef.current = r;
      setVoiceError("");
      r.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError("无法启动麦克风，请检查权限。");
    }
  };
  return (
    <div className="stack">
      <div className="mode-grid">
        {modes.map(({ mode, title, detail, icon: Icon }) => (
          <button
            key={mode}
            className={`mode-card ${control?.mode === mode ? "selected" : ""}`}
            disabled={locked || busy}
            onClick={() => onMode(mode)}
          >
            <Icon size={23} strokeWidth={1.5} />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
            {control?.mode === mode ? (
              <Badge tone="good">当前模式</Badge>
            ) : (
              <span className="mode-arrow">↗</span>
            )}
          </button>
        ))}
      </div>
      <div className="two-columns control-columns">
        <div className="stack">
          <Section
            title="智能任务"
            detail="将巡检意图交给机器人，执行前由边缘服务进行仲裁"
          >
            <div className="task-content">
              <div className="task-presets">
                {["去 B 区巡检点", "返回起点", "开始巡检"].map((text) => (
                  <button
                    className="preset"
                    key={text}
                    onClick={() => {
                      setPrompt(text);
                      setSource("WEB");
                    }}
                    disabled={!canTask}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <label className="visually-hidden" htmlFor="task-prompt">
                任务内容
              </label>
              <textarea
                id="task-prompt"
                value={prompt}
                maxLength={500}
                disabled={!canTask}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setSource("WEB");
                }}
                placeholder="例如：去 B 区巡检点，完成后返回起点"
                rows={4}
              />
              <div className="task-submit">
                <small>
                  {control?.mode !== "LOBSTER_AI"
                    ? "切换到智能任务模式后可输入"
                    : "语音会先转为文字，确认后下达任务"}{" "}
                  · {prompt.length}/500
                </small>
                <button
                  className={`icon-button ${listening ? "recording" : ""}`}
                  disabled={!canTask}
                  aria-label={listening ? "停止语音输入" : "语音输入"}
                  onClick={voice}
                >
                  {listening ? <X size={18} /> : <Mic size={18} />}
                </button>
                <button
                  className="button primary"
                  disabled={!canTask || !prompt.trim()}
                  onClick={() => {
                    recognitionRef.current?.stop();
                    void onTask(prompt.trim(), source);
                  }}
                >
                  <Play size={15} />
                  {busy ? "处理中…" : "下达任务"}
                </button>
              </div>
              <InlineMessage message={voiceError} />
              {taskStatus && (
                <div className="task-feedback" role="status">
                  <Volume2 size={16} />
                  {taskStatus}
                </div>
              )}
            </div>
          </Section>
          <Section
            title="手动驾驶"
            detail="点击发送短时运动指令；实际执行以机器人状态为准"
          >
            <div className="manual-content">
              <div className="d-pad">
                <button
                  aria-label="前进"
                  className="up"
                  disabled={!canMove}
                  onClick={() => onManual(0.18, 0)}
                >
                  <ArrowUp />
                </button>
                <button
                  aria-label="左转"
                  className="left"
                  disabled={!canMove}
                  onClick={() => onManual(0, 0.55)}
                >
                  <ArrowLeft />
                </button>
                <button
                  aria-label="停止"
                  className="stop"
                  disabled={!connected}
                  onClick={onPause}
                >
                  <CircleStop />
                </button>
                <button
                  aria-label="右转"
                  className="right"
                  disabled={!canMove}
                  onClick={() => onManual(0, -0.55)}
                >
                  <ArrowRight />
                </button>
                <button
                  aria-label="后退"
                  className="down"
                  disabled={!canMove}
                  onClick={() => onManual(-0.12, 0)}
                >
                  <ArrowDown />
                </button>
              </div>
              <dl className="manual-readout">
                <div>
                  <dt>ROS 2</dt>
                  <dd>
                    <Badge
                      tone={
                        control?.ros_connected && connected ? "good" : "neutral"
                      }
                    >
                      {control?.ros_connected && connected
                        ? "已连接"
                        : "未连接"}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>前方障碍距离</dt>
                  <dd>{valueText(control?.obstacle_distance_m, " m", 2)}</dd>
                </div>
                <div>
                  <dt>指令时长</dt>
                  <dd>350 ms</dd>
                </div>
                <div>
                  <dt>当前模式</dt>
                  <dd>{modeName[control?.mode ?? ""] ?? "待连接"}</dd>
                </div>
              </dl>
            </div>
          </Section>
        </div>
        <div className="stack">
          <Section
            title="执行状态"
            actions={
              <Badge
                tone={
                  locked ? "warn" : control?.ros_connected ? "good" : "neutral"
                }
              >
                {safetyLabel(
                  control?.safety_state,
                  connected,
                  !!control?.ros_connected,
                )}
              </Badge>
            }
          >
            <dl className="detail-list">
              <div>
                <dt>最近命令</dt>
                <dd>{control?.last_command ?? "—"}</dd>
              </div>
              <div>
                <dt>返回原因</dt>
                <dd className="break">{control?.last_reason ?? "—"}</dd>
              </div>
              <div>
                <dt>命令序号</dt>
                <dd className="mono">{control?.command_sequence ?? "—"}</dd>
              </div>
              <div>
                <dt>任务状态</dt>
                <dd>{control?.last_task?.status ?? "暂无任务"}</dd>
              </div>
            </dl>
          </Section>
          <Section title="安全操作" detail="发送后显示服务端确认结果">
            <div className="safety-actions">
              <button
                className="button secondary"
                onClick={onPause}
                disabled={!connected}
              >
                <Pause size={17} />
                暂停巡检
              </button>
              <button
                className="button danger"
                onClick={onEstop}
                disabled={
                  !connected || control?.safety_state === "ESTOP_LATCHED"
                }
              >
                <ShieldAlert size={17} />
                急停并锁存
              </button>
              <p>急停解除需要现场授权。网络中断时请使用车端急停。</p>
            </div>
          </Section>
          <div className="operator-note">
            <span className="live-line" />
            <div>
              <strong>每条指令都有反馈</strong>
              <p>
                {control?.voice_feedback ||
                  "选择控制模式后，任务和执行结果会显示在这里。"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
