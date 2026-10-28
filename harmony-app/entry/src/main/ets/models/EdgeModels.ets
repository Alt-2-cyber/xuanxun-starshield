export type AlertLevel = 'NORMAL' | 'P1' | 'P2' | 'P3' | 'CLEARED';

export type SafetyState = 'READY' | 'PATROLLING' | 'PAUSED' | 'ESTOP_LATCHED' | 'FAULT';

export interface PairingConfig {
  serviceUrl: string;
  token?: string;
  expiresAtMs?: number;
}

export interface SensorValues {
  temperature_c?: number | null;
  smoke_ratio?: number | null;
  gas_ratio?: number | null;
}

export interface PoseSnapshot {
  frame_id?: string;
  x?: number;
  y?: number;
  yaw?: number;
  quality?: string;
}

export interface AlertEvent {
  event_id: string;
  robot_id?: string;
  source_id?: string;
  message_type?: string;
  sequence?: number;
  device_time_ms?: number;
  level: AlertLevel;
  trigger_bits?: string[];
  sensor_values?: SensorValues;
  calibration_id?: string | null;
  pose?: PoseSnapshot;
  transport?: string;
  acked?: boolean;
  status?: string;
  created_at?: string;
}

export interface SafetySnapshot {
  state: SafetyState;
  patrol_name?: string;
  patrol_progress?: number;
}

export interface LinkSnapshot {
  name: string;
  online?: boolean;
  p95_ms?: number;
  loss_ratio?: number;
  retry_ratio?: number;
}

export interface SystemSnapshot {
  service?: string;
  version?: string;
  ros_connected?: boolean;
  boards_online?: number;
  safety: SafetySnapshot;
  alert?: AlertEvent | null;
  links?: LinkSnapshot[];
}

export interface VisionStatus {
  loaded?: boolean;
  model_path?: string | null;
  model_version?: string;
  fault?: string | null;
}

export interface VisionDetection {
  event_id?: string | null;
  frame_id?: string;
  label?: string;
  confidence?: number;
  bbox?: number[];
  model_version?: string;
  timestamp?: string;
}

export interface EvidenceAsset {
  url?: string;
  uri?: string;
  thumbnail_url?: string;
  captured_at?: string;
  label?: string;
}

export interface EventEvidence {
  event_id: string;
  event?: AlertEvent;
  photos?: EvidenceAsset[];
  frames?: EvidenceAsset[];
  low_frame_rate_preview?: EvidenceAsset[];
  sensor_values?: SensorValues;
  vision_detections?: VisionDetection[];
  message?: string;
}

export interface ReplayFrame {
  event_id?: string | null;
  timestamp?: string;
  pose?: PoseSnapshot;
  sensor_values?: SensorValues;
  vision_detections?: VisionDetection[];
  safety_state?: SafetyState;
}

export interface EventReplay {
  event_id: string;
  frames: ReplayFrame[];
}

export interface TwinSnapshot {
  map_version?: string;
  robot_pose?: PoseSnapshot;
  active_alerts?: AlertEvent[];
}

export interface EdgeEnvelope {
  type: string;
  data: Object;
}

export type EdgeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type ControlMode = 'FIXED_PATROL' | 'MANUAL' | 'LOBSTER_AI';
export type TaskSource = 'WEB' | 'APP' | 'VOICE';

export interface ControlTaskPlanSummary {
  intent?: string;
  target?: string | null;
  explanation?: string;
}

export interface ControlLastTask {
  plan?: ControlTaskPlanSummary;
  status?: string;
}

export interface ControlModeRequest {
  mode: ControlMode;
}

export interface ControlTaskRequest {
  text: string;
  source: TaskSource;
}

export interface ManualVelocityRequest {
  linear_x: number;
  angular_z: number;
  duration_ms: number;
}

export interface ControlSnapshot {
  mode: ControlMode;
  safety_state: SafetyState;
  ros_connected: boolean;
  obstacle_distance_m?: number | null;
  obstacle_blocked: boolean;
  last_command: string;
  last_reason: string;
  voice_feedback: string;
  command_sequence: number;
  last_task?: ControlLastTask | null;
}

export interface ControlActionResult {
  accepted: boolean;
  reason: string;
  intent?: string | null;
  task_id?: string | null;
  linear_x?: number;
  angular_z?: number;
  duration_ms?: number;
  spoken_response?: string;
}

export interface ControlTaskResponse {
  result?: ControlActionResult;
  plan?: ControlTaskPlanSummary;
  state?: ControlSnapshot;
  provider?: string;
}

export interface AckResult {
  kind: 'acknowledged' | 'unavailable' | 'failed';
  message: string;
  event?: AlertEvent;
}

export interface PairingParseResult {
  serviceUrl?: string;
  token?: string;
  expiresAtMs?: number;
  error?: string;
}
