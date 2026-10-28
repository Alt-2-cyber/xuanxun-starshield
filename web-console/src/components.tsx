import { useEffect, useRef, type ReactNode } from "react";
import { CircleCheck, CircleAlert, X, Inbox, ArrowUpRight } from "lucide-react";
export const safetyName: Record<string, string> = {
  READY: "待命",
  PATROLLING: "巡检中",
  PAUSED: "已暂停",
  ESTOP_LATCHED: "急停锁存",
  FAULT: "故障",
};
export function safetyLabel(
  state: string | undefined,
  serviceOnline: boolean,
  robotOnline: boolean,
): string {
  if (!serviceOnline) return "待核实";
  if (state && ["ESTOP_LATCHED", "PAUSED", "FAULT"].includes(state))
    return safetyName[state];
  if (!robotOnline) return "待连接";
  return safetyName[state ?? ""] || "待同步";
}
export const modeName: Record<string, string> = {
  FIXED_PATROL: "固定巡检",
  MANUAL: "手动控制",
  LOBSTER_AI: "智能任务",
};
export const timeText = (time?: string | number | null) =>
  time
    ? new Date(time).toLocaleString("zh-CN", {
        hour12: false,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
export const valueText = (
  value: number | null | undefined,
  unit = "",
  digits = 1,
) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(digits)}${unit}`;
export const isDemo = (id: string) => id.includes("demo");
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function Level({ level }: { level: string }) {
  return <span className={`level ${level.toLowerCase()}`}>{level}</span>;
}
export function Section({
  title,
  detail,
  actions,
  children,
  className = "",
}: {
  title: string;
  detail?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          {detail && <p>{detail}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={28} strokeWidth={1.3} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
      {children}
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: ReactNode;
  detail: string;
  tone?: string;
}) {
  return (
    <div className={`stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function InlineMessage({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  return message ? (
    <div
      className={`inline-message ${success ? "success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {success ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
      <span>{message}</span>
    </div>
  ) : null;
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => {
      ref.current?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="关闭对话框"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
