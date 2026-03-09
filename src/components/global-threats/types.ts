/* ── Global Threat Monitoring – Type Definitions ── */

export interface GeoEndpoint {
  ip: string;
  port?: number;
  country: string;
  country_code: string;
  city: string;
  lat: number;
  lon: number;
  asn?: string;
  org?: string;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  category: ThreatCategory;
  severity: SeverityLevel;
  severity_score: number;
  confidence: number;
  source: GeoEndpoint;
  target: GeoEndpoint;
  indicators: {
    domain?: string;
    url?: string;
    hash?: string;
    cve?: string;
    user_agent?: string;
    port?: number;
    protocol?: string;
  };
  mitre?: {
    tactic: string;
    technique_id: string;
    technique_name: string;
  };
  tags: string[];
  raw_log?: string;
  enrichment?: Record<string, unknown>;
  campaign_id?: string;
  source_type: SourceType;
}

export type ThreatCategory =
  | 'phishing'
  | 'malware'
  | 'ddos'
  | 'exploit'
  | 'ransomware'
  | 'credential_stuffing'
  | 'recon'
  | 'data_exfiltration'
  | 'botnet';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export type SourceType =
  | 'edr'
  | 'siem'
  | 'honeypot'
  | 'osint'
  | 'threat_intel_feed'
  | 'user_reports';

export type TimeRange = '5m' | '1h' | '24h' | '7d' | 'custom';

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#ff2d55',
  high: '#ff9500',
  medium: '#ffcc00',
  low: '#30d158',
};

export const SEVERITY_ORDER: Record<SeverityLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const CATEGORY_LABELS: Record<ThreatCategory, string> = {
  phishing: 'Phishing',
  malware: 'Malware',
  ddos: 'DDoS',
  exploit: 'Exploit',
  ransomware: 'Ransomware',
  credential_stuffing: 'Credential Stuffing',
  recon: 'Reconnaissance',
  data_exfiltration: 'Data Exfiltration',
  botnet: 'Botnet',
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  edr: 'EDR',
  siem: 'SIEM',
  honeypot: 'Honeypot',
  osint: 'OSINT',
  threat_intel_feed: 'Threat Intel Feed',
  user_reports: 'User Reports',
};

export interface ThreatFilters {
  search: string;
  severity: SeverityLevel[];
  confidenceMin: number;
  category: ThreatCategory[];
  sourceType: SourceType[];
}

export const DEFAULT_FILTERS: ThreatFilters = {
  search: '',
  severity: [],
  confidenceMin: 0,
  category: [],
  sourceType: [],
};
