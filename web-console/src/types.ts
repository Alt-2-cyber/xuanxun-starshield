export type SafetyState =
  "READY" | "PATROLLING" | "PAUSED" | "ESTOP_LATCHED" | "FAULT";
export type ControlMode = "FIXED_PATROL" | "MANUAL" | "LOBSTER_AI";
export type Pose = {
  x: number;
  y: number;
  yaw: number;
  quality: string;
  frame_id?: string;
};
export type AlertEvent = {
  event_id: string;
  robot_id: string;
  source_id: string;
  level: string;
  trigger_bits: string[];
  pose: Pose;
  transport: string;
  acked: boolean;
  status: string;
  created_at: string;
  sensor_values: {
    temperature_c?: number | null;
    smoke_ratio?: number | null;
    gas_ratio?: number | null;
  };
};
export type Link = {
  name: string;
  online?: boolean;
  p95_ms?: number | null;
  loss_ratio?: number | null;
  retry_ratio?: number | null;
};
export type SystemSnapshot = {
  service: string;
  version: string;
  ros_connected: boolean;
  boards_online: number;
  safety: {
    state: SafetyState;
    patrol_name?: string;
    patrol_progress?: number;
  };
  alert: AlertEvent | null;
  links: Link[];
};
export type ControlState = {
  mode: ControlMode;
  safety_state: SafetyState;
  ros_connected: boolean;
  obstacle_distance_m: number | null;
  obstacle_blocked: boolean;
  last_command: string;
  last_reason: string;
  voice_feedback: string;
  command_sequence: number;
  last_task?: {
    plan?: { intent?: string; target?: string | null };
    status?: string;
  } | null;
};
export type RiskZone = {
  zone_id: string;
  name: string;
  level: string;
  x: number;
  y: number;
  radius_m: number;
};
export type HeatPoint = {
  x: number;
  y: number;
  intensity: number;
  radius_m: number;
  label: string;
  source_event_id?: string | null;
};
export type TwinSnapshot = {
  map_version: string;
  robot_pose: Pose;
  trail: Pose[];
  risk_zones: RiskZone[];
  heat_points: HeatPoint[];
  active_alerts: AlertEvent[];
  link_status?: Link[];
};
export type VisionStatus = {
  loaded: boolean;
  model_path?: string | null;
  model_version: string;
  fault?: string | null;
};
export type Transport = {
  port: string;
  label: string;
  online: boolean;
  bytes_received: number;
  frames_received: number;
  crc_errors: number;
  unsupported_versions: number;
  last_frame_ns: number | null;
  last_error: string | null;
};
export type TaskResponse = {
  result?: { accepted?: boolean; reason?: string; spoken_response?: string };
  plan?: { intent?: string; target?: string | null; explanation?: string };
  provider?: string;
  state?: ControlState;
};
export type ReplayState = {
  event_id: string;
  frames: Array<Record<string, unknown>>;
};
export type PageKey =
  | "overview"
  | "patrol"
  | "alerts"
  | "control"
  | "twin"
  | "vision"
  | "experiment"
  | "replay"
  | "risk-zones"
  | "diagnostics";
export type Connection = "connecting" | "online" | "degraded" | "offline";
export type AbSummary = {
  paired_events: number;
  sle_wins: number;
  wifi_wins: number;
  ties: number;
  mean_abs_delta_ms: number;
  p95_abs_delta_ms: number;
  samples: Array<{
    event_id: string;
    sle_minus_wifi_ms: number;
    winner: "SLE" | "Wi-Fi" | "TIE";
    sle_retry_count: number;
    wifi_retry_count: number;
  }>;
};
