export interface User {
  id: number;
  name: string;
  role: string;
}

export interface AdminOverview {
  users: number;
  uploads: number;
  logs: number;
  risks: number;
  incidents: number;
  mitre_mappings: number;
  generator: { running: boolean; mode: string | null; last_error: string | null };
  model_version: string | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string | null;
  last_login: string | null;
  active: boolean;
}

export interface AdminUploadRow {
  id: number;
  file_name: string;
  file_type: string;
  processing_status: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  upload_time: string | null;
  owner_name: string;
  error_message: string | null;
}

export interface UploadRow {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  upload_time: string | null;
  processing_status: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  content_hash: string | null;
  quality: {
    quality_score: number;
    health_score: number;
    duplicate_logs: number;
  } | null;
  risk_count?: number;
  incident_count?: number;
  forensic_trust?: TrustScore;
  risks?: RiskEvent[];
}

export interface TrustScore {
  score: number;
  data_quality_score: number;
  average_risk_score: number;
  agreement_rate: number;
  coverage_rate: number;
  volume_score: number;
  mitre_coverage_rate: number;
  formula: string;
}

export interface MitreMapping {
  tactic: string;
  technique_id: string;
  technique_name: string;
  confidence_score: number;
}

export interface RiskEvent {
  id: number;
  log_id: number;
  risk_category: string;
  attack_type: string | null;
  risk_score: number;
  severity: string;
  reason: string;
  recommendation?: string;
  source?: string;
  mitre_mapping: MitreMapping | null;
  analyst_label?: string | null;
  reviewed_at?: string | null;
}

export interface Overview {
  total_logs: number;
  risk_events: number;
  incidents: number;
  average_risk: number;
  quality_score: number;
  health_score: number;
  anomaly_count: number;
  recent_events: RecentEvent[];
  recent_incidents: IncidentLite[];
}

export interface RecentEvent {
  id: number;
  created_at: string;
  endpoint: string;
  event_type: string;
  method: string;
  reason: string;
  risk_category: string;
  severity?: string;
  source_ip?: string;
}

export interface IncidentLite {
  id: number;
  title: string;
  severity: string;
  score: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface TopIp {
  ip: string;
  events: number;
  score: number;
}

export interface LogEntry {
  id: number;
  timestamp: string | null;
  source_ip: string | null;
  method: string | null;
  event_type: string | null;
  endpoint: string | null;
  status_code: number | null;
  response_time: number | null;
  log_source_type: string | null;
  message: string;
  risk: {
    id: number;
    severity: string;
    risk_category: string;
    analyst_label: string | null;
    reviewed_at: string | null;
  } | null;
}

export interface LogsFilterResult {
  source_counts: Record<string, number>;
  logs: LogEntry[];
}

export interface IncidentDetail {
  id?: number;
  title: string;
  severity: string;
  score: number;
  summary: string;
  events: IncidentEvent[];
}

export interface IncidentEvent {
  event_time: string | null;
  event_type: string | null;
  description: string;
  mitre_tactic: string | null;
  mitre_technique: string | null;
}

export interface TimelineItem {
  id: number;
  title: string;
  severity: string;
  score: number;
  start: string | null;
  end: string | null;
}

export interface LabelF1 {
  label_count: number;
  f1_score: number;
  model_version: string;
  created_at: string | null;
}

export interface GeneratorStatus {
  running: boolean;
  mode: string;
  last_error: string | null;
  source: {
    name: string;
    type: string;
    format: string;
    environment: string;
    status: string;
  };
  activity: string;
}

export interface Attack {
  name: string;
  icon: string;
  mitre: string;
  tactic: string;
  urgency: string;
  summary: string;
  history: string;
  workflow: string[];
  signals: string[];
  solutions: string[];
  example: string;
  reference: string;
}

export interface StreamEvent {
  id: number;
  file_id: number;
  category: string;
  attack_type: string | null;
  severity: string;
  score: number;
  reason: string;
  source_ip: string | null;
  timestamp: string | null;
  mitre_tactic: string | null;
}
