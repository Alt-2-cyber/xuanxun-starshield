import { useCallback, useEffect, useRef, useState } from "react";
import { loadServiceUrl, request } from "./api";
import type {
  AbSummary,
  AlertEvent,
  Connection,
  ControlState,
  SystemSnapshot,
  Transport,
  TwinSnapshot,
  VisionStatus,
} from "./types";

type Resources = {
  system: SystemSnapshot | null;
  control: ControlState | null;
  twin: TwinSnapshot | null;
  vision: VisionStatus | null;
  transport: Transport[];
  events: AlertEvent[];
  ab: AbSummary;
};
const empty = (): Resources => ({
  system: null,
  control: null,
  twin: null,
  vision: null,
  transport: [],
  events: [],
  ab: {
    paired_events: 0,
    sle_wins: 0,
    wifi_wins: 0,
    ties: 0,
    mean_abs_delta_ms: 0,
    p95_abs_delta_ms: 0,
    samples: [],
  },
});
const endpoints: Array<[keyof Resources, string]> = [
  ["system", "/api/v1/system/snapshot"],
  ["control", "/api/v1/control/state"],
  ["twin", "/api/v1/digital-twin/snapshot"],
  ["vision", "/api/v1/vision/status"],
  ["transport", "/api/v1/transport/status"],
  ["events", "/api/v1/events?limit=200"],
  ["ab", "/api/v1/experiments/ab/summary"],
];
const streamKeys: Record<string, keyof Resources> = {
  "control.state": "control",
  "twin.snapshot": "twin",
  "system.snapshot": "system",
  "safety.changed": "system",
  "alert.created": "events",
  "alert.updated": "events",
};

export function useEdge() {
  const [base, setBase] = useState(loadServiceUrl);
  const [resources, setResources] = useState<Resources>(empty);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [streamOnline, setStreamOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const cycle = useRef(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    const generation = ++cycle.current;
    let disposed = false,
      inFlight: Promise<void> | null = null;
    let socket: WebSocket | null = null,
      retry: number | undefined;
    let attempts = 0;
    const controller = new AbortController();
    const confirmed = new Set<string>();
    const revisions: Partial<Record<keyof Resources, number>> = {};
    setResources(empty());
    setConnection("connecting");
    setLoading(true);
    setUpdated(null);
    setErrors([]);
    setStreamOnline(false);
    const run = async () => {
      setLoading(true);
      const revisionAtStart = { ...revisions };
      const results = await Promise.allSettled([
        request<{ status: string }>(base, "/api/v1/health", {
          signal: controller.signal,
        }),
        ...endpoints.map(([, path]) =>
          request<unknown>(base, path, { signal: controller.signal }),
        ),
      ]);
      if (disposed || generation !== cycle.current) return;
      const messages: string[] = [];
      if (results[0].status === "rejected") {
        setConnection("offline");
        setErrors(["边缘服务暂不可用，正在自动重试。页面保留上次数据。"]);
        setLoading(false);
        return;
      }
      const patch: Partial<Resources> = {};
      endpoints.forEach(([key], i) => {
        const result = results[i + 1];
        if (result.status === "fulfilled")
          Object.assign(patch, { [key]: result.value });
        else
          messages.push(
            `${key}: ${result.reason instanceof Error ? result.reason.message : "读取失败"}`,
          );
      });
      setResources((old) => {
        if (patch.events) {
          patch.events = patch.events.map((event) => {
            if (event.acked) confirmed.add(event.event_id);
            return confirmed.has(event.event_id)
              ? { ...event, acked: true }
              : event;
          });
        }
        // Only a newer push for the same resource supersedes its HTTP read.
        for (const key of ["control", "system", "twin"] as const) {
          if (revisionAtStart[key] !== revisions[key]) delete patch[key];
        }
        if (patch.events && revisionAtStart.events !== revisions.events) {
          const merged = new Map(
            patch.events.map((event) => [event.event_id, event]),
          );
          old.events.forEach((event) => merged.set(event.event_id, event));
          patch.events = [...merged.values()]
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
            .slice(0, 200);
        }
        return { ...old, ...patch };
      });
      setConnection(messages.length ? "degraded" : "online");
      setErrors(messages);
      setUpdated(Date.now());
      setLoading(false);
    };
    const poll = () => {
      if (inFlight) return inFlight;
      inFlight = run().finally(() => {
        inFlight = null;
      });
      return inFlight;
    };
    refreshRef.current = async () => {
      if (inFlight) await inFlight;
      if (!disposed) await poll();
    };
    const connect = () => {
      if (disposed) return;
      const url = new URL(base || window.location.origin);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/ws";
      socket = new WebSocket(url);
      socket.onopen = () => {
        if (!disposed) {
          attempts = 0;
          setStreamOnline(true);
          void poll();
        }
      };
      socket.onmessage = (event) => {
        if (disposed) return;
        try {
          const message = JSON.parse(event.data) as {
            type: string;
            data?: unknown;
          };
          const revisionKey = streamKeys[message.type];
          if (!message.data || !revisionKey) return;
          revisions[revisionKey] = (revisions[revisionKey] ?? 0) + 1;
          if (message.type === "control.state")
            setResources((old) => ({
              ...old,
              control: message.data as ControlState,
            }));
          if (message.type === "twin.snapshot")
            setResources((old) => ({
              ...old,
              twin: message.data as TwinSnapshot,
            }));
          if (
            message.type === "system.snapshot" ||
            message.type === "safety.changed"
          )
            setResources((old) => ({
              ...old,
              system: message.data as SystemSnapshot,
            }));
          if (
            message.type === "alert.created" ||
            message.type === "alert.updated"
          ) {
            const incoming = message.data as AlertEvent;
            if (typeof incoming.event_id !== "string") return;
            if (incoming.acked) confirmed.add(incoming.event_id);
            if (confirmed.has(incoming.event_id)) incoming.acked = true;
            setResources((old) => ({
              ...old,
              events: [
                incoming,
                ...old.events.filter((e) => e.event_id !== incoming.event_id),
              ]
                .sort(
                  (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
                )
                .slice(0, 200),
            }));
          }
        } catch {
          /* Ignore malformed frames; the next HTTP snapshot reconciles state. */
        }
      };
      socket.onerror = () => {
        if (!disposed) setStreamOnline(false);
      };
      socket.onclose = () => {
        if (disposed) return;
        setStreamOnline(false);
        retry = window.setTimeout(
          connect,
          Math.min(15000, 1000 * 2 ** attempts++),
        );
      };
    };
    void poll();
    const connectTimer = window.setTimeout(connect, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 5000);
    const visible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(connectTimer);
      window.clearInterval(timer);
      window.clearTimeout(retry);
      document.removeEventListener("visibilitychange", visible);
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        socket.close();
      }
      if (generation === cycle.current) refreshRef.current = async () => {};
    };
  }, [base]);
  return {
    ...resources,
    base,
    setBase,
    connection,
    streamOnline,
    loading,
    updated,
    errors,
    refresh,
  };
}
export type EdgeData = ReturnType<typeof useEdge>;
