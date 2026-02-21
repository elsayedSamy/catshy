/**
 * Mock threat event generator — simulates live WebSocket /threats/stream.
 * Each event follows the canonical ThreatEvent schema.
 * All coordinates are real-world city locations.
 */
import { ThreatEvent, ThreatCategory, SeverityLevel, SourceType } from './types';

interface CityDef {
  city: string;
  country: string;
  code: string;
  lat: number;
  lon: number;
  asn: string;
  org: string;
}

const SOURCE_CITIES: CityDef[] = [
  { city: 'Moscow', country: 'Russia', code: 'RU', lat: 55.75, lon: 37.62, asn: 'AS12389', org: 'Rostelecom' },
  { city: 'Beijing', country: 'China', code: 'CN', lat: 39.91, lon: 116.40, asn: 'AS4808', org: 'China Unicom' },
  { city: 'Shanghai', country: 'China', code: 'CN', lat: 31.23, lon: 121.47, asn: 'AS4812', org: 'China Telecom' },
  { city: 'Tehran', country: 'Iran', code: 'IR', lat: 35.69, lon: 51.39, asn: 'AS44244', org: 'Irancell' },
  { city: 'Pyongyang', country: 'North Korea', code: 'KP', lat: 39.02, lon: 125.75, asn: 'AS131279', org: 'Star JV' },
  { city: 'Lagos', country: 'Nigeria', code: 'NG', lat: 6.52, lon: 3.38, asn: 'AS36873', org: 'Globacom' },
  { city: 'São Paulo', country: 'Brazil', code: 'BR', lat: -23.55, lon: -46.63, asn: 'AS28573', org: 'Claro SA' },
  { city: 'Mumbai', country: 'India', code: 'IN', lat: 19.08, lon: 72.88, asn: 'AS9829', org: 'BSNL' },
  { city: 'Jakarta', country: 'Indonesia', code: 'ID', lat: -6.21, lon: 106.85, asn: 'AS17974', org: 'Telkom' },
  { city: 'Kyiv', country: 'Ukraine', code: 'UA', lat: 50.45, lon: 30.52, asn: 'AS13249', org: 'Kyivstar' },
  { city: 'Bucharest', country: 'Romania', code: 'RO', lat: 44.43, lon: 26.10, asn: 'AS8708', org: 'RCS & RDS' },
  { city: 'Berlin', country: 'Germany', code: 'DE', lat: 52.52, lon: 13.41, asn: 'AS3320', org: 'Deutsche Telekom' },
  { city: 'Istanbul', country: 'Turkey', code: 'TR', lat: 41.01, lon: 28.98, asn: 'AS9121', org: 'Turk Telekom' },
  { city: 'Cairo', country: 'Egypt', code: 'EG', lat: 30.04, lon: 31.24, asn: 'AS36935', org: 'Telecom Egypt' },
  { city: 'Riyadh', country: 'Saudi Arabia', code: 'SA', lat: 24.69, lon: 46.72, asn: 'AS25019', org: 'STC' },
  { city: 'Hanoi', country: 'Vietnam', code: 'VN', lat: 21.03, lon: 105.85, asn: 'AS45899', org: 'VNPT' },
  { city: 'Buenos Aires', country: 'Argentina', code: 'AR', lat: -34.60, lon: -58.38, asn: 'AS7303', org: 'Telecom Argentina' },
  { city: 'Warsaw', country: 'Poland', code: 'PL', lat: 52.23, lon: 21.01, asn: 'AS5617', org: 'Orange Polska' },
  { city: 'Minsk', country: 'Belarus', code: 'BY', lat: 53.90, lon: 27.57, asn: 'AS6697', org: 'Beltelecom' },
  { city: 'Bangkok', country: 'Thailand', code: 'TH', lat: 13.76, lon: 100.50, asn: 'AS23969', org: 'TOT' },
];

const TARGET_CITIES: CityDef[] = [
  { city: 'Ashburn', country: 'USA', code: 'US', lat: 39.04, lon: -77.49, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'New York', country: 'USA', code: 'US', lat: 40.71, lon: -74.01, asn: 'AS22394', org: 'Verizon Business' },
  { city: 'San Francisco', country: 'USA', code: 'US', lat: 37.77, lon: -122.42, asn: 'AS15169', org: 'Google Cloud' },
  { city: 'London', country: 'UK', code: 'GB', lat: 51.51, lon: -0.13, asn: 'AS8075', org: 'Microsoft Azure' },
  { city: 'Frankfurt', country: 'Germany', code: 'DE', lat: 50.11, lon: 8.68, asn: 'AS8075', org: 'Microsoft Azure' },
  { city: 'Tokyo', country: 'Japan', code: 'JP', lat: 35.69, lon: 139.69, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Singapore', country: 'Singapore', code: 'SG', lat: 1.35, lon: 103.82, asn: 'AS15169', org: 'Google Cloud' },
  { city: 'Sydney', country: 'Australia', code: 'AU', lat: -33.87, lon: 151.21, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Toronto', country: 'Canada', code: 'CA', lat: 43.65, lon: -79.38, asn: 'AS812', org: 'Rogers' },
  { city: 'Paris', country: 'France', code: 'FR', lat: 48.86, lon: 2.35, asn: 'AS3215', org: 'Orange SA' },
];

const CATEGORIES: ThreatCategory[] = [
  'phishing', 'malware', 'ddos', 'exploit', 'ransomware',
  'credential_stuffing', 'recon', 'data_exfiltration', 'botnet',
];

const SEVERITIES: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
/* Weighted distribution: critical 5 %, high 15 %, medium 40 %, low 40 % */
const SEVERITY_WEIGHTS = [0.05, 0.15, 0.4, 0.4];

const SOURCE_TYPES: SourceType[] = [
  'edr', 'siem', 'honeypot', 'osint', 'threat_intel_feed', 'user_reports',
];

const MITRE_MAP = [
  { tactic: 'Initial Access', id: 'T1566', name: 'Phishing' },
  { tactic: 'Execution', id: 'T1059', name: 'Command and Scripting Interpreter' },
  { tactic: 'Persistence', id: 'T1547', name: 'Boot or Logon Autostart Execution' },
  { tactic: 'Privilege Escalation', id: 'T1068', name: 'Exploitation for Privilege Escalation' },
  { tactic: 'Defense Evasion', id: 'T1027', name: 'Obfuscated Files or Information' },
  { tactic: 'Credential Access', id: 'T1110', name: 'Brute Force' },
  { tactic: 'Discovery', id: 'T1046', name: 'Network Service Discovery' },
  { tactic: 'Lateral Movement', id: 'T1021', name: 'Remote Services' },
  { tactic: 'Collection', id: 'T1005', name: 'Data from Local System' },
  { tactic: 'Exfiltration', id: 'T1041', name: 'Exfiltration Over C2 Channel' },
  { tactic: 'Impact', id: 'T1486', name: 'Data Encrypted for Impact' },
];

const DOMAINS = [
  'malware-c2.evil.com', 'phish-login.net', 'exfil-data.xyz',
  'botnet-ctrl.ru', 'ransomware-pay.onion.ws', 'stealer-panel.top',
];

const CVES = [
  'CVE-2024-3400', 'CVE-2024-21887', 'CVE-2023-46805',
  'CVE-2024-1709', 'CVE-2023-22515', 'CVE-2024-23897',
];

const CAMPAIGNS = [
  'APT29-SolarWinds', 'Lazarus-CryptoHeist', 'FancyBear-2024',
  'CharmingKitten-Phish', null, null, null, null,
];

/* ── Helpers ── */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomIp(): string {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function randomHash(): string {
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

let counter = 0;

export function generateThreatEvent(): ThreatEvent {
  const src = pick(SOURCE_CITIES);
  const tgt = pick(TARGET_CITIES);
  const severity = weightedPick(SEVERITIES, SEVERITY_WEIGHTS);
  const category = pick(CATEGORIES);
  const mitre = pick(MITRE_MAP);
  const campaign = pick(CAMPAIGNS);
  counter++;

  const severityScore =
    severity === 'critical' ? 90 + Math.random() * 10 :
    severity === 'high' ? 70 + Math.random() * 20 :
    severity === 'medium' ? 40 + Math.random() * 30 :
    10 + Math.random() * 30;

  return {
    id: `EVT-${Date.now()}-${counter}`,
    timestamp: new Date().toISOString(),
    category,
    severity,
    severity_score: Math.round(severityScore),
    confidence: Math.floor(30 + Math.random() * 70),
    source: {
      ip: randomIp(),
      port: 1024 + Math.floor(Math.random() * 64000),
      country: src.country,
      country_code: src.code,
      city: src.city,
      lat: src.lat,
      lon: src.lon,
      asn: src.asn,
      org: src.org,
    },
    target: {
      ip: randomIp(),
      port: pick([80, 443, 22, 3389, 8080, 8443]),
      country: tgt.country,
      country_code: tgt.code,
      city: tgt.city,
      lat: tgt.lat,
      lon: tgt.lon,
      asn: tgt.asn,
      org: tgt.org,
    },
    indicators: {
      domain: Math.random() > 0.5 ? pick(DOMAINS) : undefined,
      url: Math.random() > 0.65 ? `https://${pick(DOMAINS)}/payload` : undefined,
      hash: Math.random() > 0.5 ? randomHash() : undefined,
      cve: Math.random() > 0.7 ? pick(CVES) : undefined,
    },
    mitre: {
      tactic: mitre.tactic,
      technique_id: mitre.id,
      technique_name: mitre.name,
    },
    tags: [category, severity, src.code.toLowerCase()].filter(Boolean),
    raw_log: `[${new Date().toISOString()}] ${severity.toUpperCase()} ${category} from ${src.city} (${randomIp()}) → ${tgt.city} (${randomIp()})`,
    enrichment: {
      reputation_score: Math.floor(Math.random() * 100),
      virustotal_detections: Math.floor(Math.random() * 72),
      abuseipdb_score: Math.floor(Math.random() * 100),
    },
    campaign_id: campaign || undefined,
    source_type: pick(SOURCE_TYPES),
  };
}

export function generateInitialEvents(count: number): ThreatEvent[] {
  const now = Date.now();
  const events: ThreatEvent[] = [];
  for (let i = 0; i < count; i++) {
    const event = generateThreatEvent();
    event.timestamp = new Date(now - Math.random() * 3600000).toISOString();
    events.push(event);
  }
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
