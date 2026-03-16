export interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}

export interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface ProductionSite {
  _id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface AssemblyLine {
  _id: string;
  site_id: string | ProductionSite;
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  created_at: string;
}

export interface Parameter {
  param_id: string;
  name: string;
  unit: string;
  min_value: number;
  max_value: number;
  update_interval_sec: number;
}

export interface TechNode {
  _id: string;
  line_id: string | AssemblyLine;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'warning' | 'critical';
  ip_address: string;
  created_at: string;
  parameters: Parameter[];
}

export interface TelemetryRecord {
  _id: string;
  node_id: string;
  param_id: string;
  value: number;
  timestamp: string;
  quality_flag: 'good' | 'uncertain' | 'bad';
}

export interface LatestTelemetry {
  param_id: string;
  name: string;
  unit: string;
  min_value: number;
  max_value: number;
  value: number | null;
  timestamp: string | null;
  quality_flag: string | null;
}

export interface Alert {
  _id: string;
  node_id: string | TechNode;
  param_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  resolved_at: string | null;
}

export interface Command {
  _id: string;
  node_id: string | TechNode;
  user_id: string;
  action_type: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  created_at: string;
  executed_at: string | null;
}
