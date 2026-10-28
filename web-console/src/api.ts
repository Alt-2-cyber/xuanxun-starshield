export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const reasons: Record<string, string> = {
  ROS_DISCONNECTED: "机器人尚未连接，请检查 ROS 2 桥接",
  MODE_NOT_LOBSTER_AI: "请先切换到智能任务模式",
  MODE_NOT_MANUAL: "请先切换到手动控制模式",
  ESTOP_LATCHED: "急停已锁存，需要现场授权解除",
  OBSTACLE_BLOCKED: "前方障碍距离过近，指令已拒绝",
  SCAN_UNAVAILABLE: "尚未收到有效激光测距，无法执行运动",
  PAUSED: "机器人已暂停",
};
export const explain = (reason: string) => reasons[reason] ?? reason;

export function normalizeServiceUrl(input: string): string {
  const text = input.trim().replace(/\/+$/, "");
  if (!text) return "";
  const url = new URL(text);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "" && url.pathname !== "/")
  ) {
    throw new Error(
      "请输入 http:// 或 https:// 开头的服务地址，不要包含路径、账号或参数",
    );
  }
  return url.origin;
}
export function loadServiceUrl(): string {
  try {
    return normalizeServiceUrl(
      localStorage.getItem("starshield.service.v1") ?? "",
    );
  } catch {
    return "";
  }
}
export function saveServiceUrl(value: string) {
  localStorage.setItem("starshield.service.v1", normalizeServiceUrl(value));
}

export async function request<T>(
  base: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = window.setTimeout(abort, 8000);
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: timeout.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const detail =
        typeof error.detail === "string"
          ? explain(error.detail)
          : `请求失败（HTTP ${response.status}）`;
      throw new ApiError(response.status, detail);
    }
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error("服务返回格式异常，请检查服务地址");
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("请求超时或已取消，请重试");
    throw new Error(
      error instanceof Error && error.message.includes("格式异常")
        ? error.message
        : "无法连接边缘服务，请检查网络或服务地址",
    );
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export const post = <T>(base: string, path: string, data?: unknown) =>
  request<T>(base, path, { method: "POST", body: JSON.stringify(data ?? {}) });

export function downloadFile(
  filename: string,
  content: string,
  type = "application/json",
) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export const csvText = (rows: unknown[][]) =>
  "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
