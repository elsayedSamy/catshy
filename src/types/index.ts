// ── Auth & RBAC ──
export type UserRole = 'admin' | 'analyst' | 'hunter' | 'manager' | 'readonly';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  is_active: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ── Feature Flags ──
export interface FeatureFlags {
  graph_explorer: boolean;
  risk_scoring: boolean;
  alerts_rules: boolean;
  investigations: boolean;
  cases_reports: boolean;
  leaks_center: boolean;
  leaks_tor: boolean;
  threat_map_3d: boolean;
  playbooks: boolean;
  integrations_marketplace: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  graph_explorer: true,
  risk_scoring: true,
  alerts_rules: true,
  investigations: true,
  cases_reports: true,
  leaks_center: true,
  leaks_tor: false,
  threat_map_3d: true,
  playbooks: true,
  integrations_marketplace: true,
};

// ── Assets ──
export type AssetType = 'domain' | 'ip_range' | 'asn' | 'brand' | 'email_domain' | 'app' | 'subsidiary';
export type CriticalityTier = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Asset {
  id: string;
  type: AssetType;
  value: string;
  label: string;
  criticality: CriticalityTier;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

// ── Sources ──
export type ConnectorType = 'rss_atom' | 'http_json' | 'http_csv' | 'rest_api' | 'taxii2' | 'imap' | 'webhook';
export type SourceCategory = 'vuln_exploit' | 'abuse_malware' | 'vendor_advisory' | 'research' | 'phishing_web';
export type SourceHealthState = 'disabled' | 'healthy' | 'degraded' | 'error' | 'unknown';

export interface SourceTemplate {
  id: string;
  name: string;
  description: string;
  category: SourceCategory;
  connector_type: ConnectorType;
  default_url: string;
  requires_auth: boolean;
  auth_type?: 'api_key' | 'bearer' | 'basic' | 'header';
  polling_interval_minutes: number;
  enabled: boolean;
  health: SourceHealthState;
  last_fetch_at?: string;
  item_count: number;
  resolved_url?: string;
  rate_limit_rpm?: number;
  error_message?: string;
}

// ── Intel Feed ──
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ObservableType = 'ip' | 'domain' | 'url' | 'email' | 'hash_md5' | 'hash_sha1' | 'hash_sha256' | 'cve' | 'actor' | 'malware' | 'other';

export interface IntelItem {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  observable_type: ObservableType;
  observable_value: string;
  source_id: string;
  source_name: string;
  fetched_at: string;
  published_at: string;
  original_url: string;
  excerpt: string;
  dedup_count: number;
  asset_match: boolean;
  matched_assets: string[];
  confidence_score: number;
  risk_score: number;
  tags: string[];
}

// ── Entities (Graph / STIX-like) ──
export type EntityType = 'indicator' | 'vulnerability' | 'malware' | 'threat_actor' | 'campaign' | 'tool' | 'infrastructure' | 'organization' | 'report' | 'source' | 'sighting' | 'ttp';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  description: string;
  properties: Record<string, unknown>;
  first_seen: string;
  last_seen: string;
  confidence: number;
  created_at: string;
  source_refs: string[];
}

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  confidence: number;
  first_seen: string;
  last_seen: string;
  evidence_refs: string[];
}

// ── Alerts & Rules ──
export type AlertStatus = 'new' | 'acknowledged' | 'resolved' | 'false_positive';
export type RuleOperator = 'equals' | 'contains' | 'regex' | 'gt' | 'lt' | 'in' | 'not_in';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: string;
  logic?: 'AND' | 'OR';
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  severity: SeverityLevel;
  channels: ('email' | 'webhook')[];
  enabled: boolean;
  created_by: string;
  created_at: string;
  last_triggered_at?: string;
  trigger_count: number;
}

export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: SeverityLevel;
  status: AlertStatus;
  matched_items: string[];
  triggered_at: string;
  acknowledged_by?: string;
  resolved_at?: string;
  notes: string;
}

// ── Investigations & Cases ──
export type CaseStatus = 'open' | 'in_progress' | 'pending' | 'closed' | 'archived';
export type CasePriority = 'critical' | 'high' | 'medium' | 'low';

export interface Investigation {
  id: string;
  title: string;
  description: string;
  notebook_content: string;
  pinned_evidence: string[];
  linked_entities: string[];
  linked_intel: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'completed' | 'archived';
}

export interface Case {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  assignee_id?: string;
  assignee_name?: string;
  investigation_ids: string[];
  evidence_ids: string[];
  tasks: CaseTask[];
  sla_due_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface CaseTask {
  id: string;
  title: string;
  completed: boolean;
  assignee_id?: string;
}

// ── Reports ──
export type ReportFormat = 'executive_pdf' | 'technical_pdf' | 'html' | 'csv' | 'json';

export interface Report {
  id: string;
  title: string;
  case_id?: string;
  investigation_id?: string;
  format: ReportFormat;
  generated_at: string;
  generated_by: string;
  file_url?: string;
  sections: ReportSection[];
}

export interface ReportSection {
  heading: string;
  content: string;
  type: 'narrative' | 'evidence' | 'assets' | 'scoring' | 'recommendations';
}

// ── Leaks ──
export type LeakType = 'credential' | 'paste' | 'breach' | 'brand_mention' | 'typosquat' | 'code_leak';

export interface LeakItem {
  id: string;
  type: LeakType;
  title: string;
  description: string;
  severity: SeverityLevel;
  source_name: string;
  source_url: string;
  discovered_at: string;
  matched_assets: string[];
  evidence_excerpt: string;
  provenance: string;
  is_tor_source: boolean;
}

// ── Playbooks ──
export type PlaybookStepType = 'enrich' | 'create_case' | 'export_iocs' | 'notify' | 'webhook' | 'condition' | 'transform';

export interface PlaybookStep {
  id: string;
  type: PlaybookStepType;
  name: string;
  config: Record<string, unknown>;
  next_step_id?: string;
  on_failure_step_id?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
  version: number;
  enabled: boolean;
  created_by: string;
  created_at: string;
  last_run_at?: string;
  run_count: number;
}

// ── Audit ──
export interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_email: string;
  details: Record<string, unknown>;
  ip_address: string;
  timestamp: string;
}

// ── Filters (shared across pages) ──
export interface FilterState {
  severity?: SeverityLevel[];
  source_id?: string[];
  observable_type?: ObservableType[];
  date_from?: string;
  date_to?: string;
  asset_match_only?: boolean;
  search_query?: string;
  status?: string[];
  category?: SourceCategory[];
  leak_type?: LeakType[];
  [key: string]: unknown;
}

// ── Navigation ──
export interface NavItem {
  label: string;
  path: string;
  icon: string;
  phase: 1 | 2 | 3;
  feature_flag?: keyof FeatureFlags;
  roles?: UserRole[];
  section: 'core' | 'intelligence' | 'operations' | 'advanced' | 'system';
}
