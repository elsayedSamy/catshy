/**
 * Mock threat event generator — realistic global cyber threat simulation.
 * All coordinates are real-world city locations with accurate ASN data.
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
  // Russia
  { city: 'Moscow', country: 'Russia', code: 'RU', lat: 55.75, lon: 37.62, asn: 'AS12389', org: 'Rostelecom' },
  { city: 'St. Petersburg', country: 'Russia', code: 'RU', lat: 59.93, lon: 30.32, asn: 'AS31133', org: 'MegaFon' },
  { city: 'Novosibirsk', country: 'Russia', code: 'RU', lat: 55.03, lon: 82.92, asn: 'AS12389', org: 'Rostelecom' },
  // China
  { city: 'Beijing', country: 'China', code: 'CN', lat: 39.91, lon: 116.40, asn: 'AS4808', org: 'China Unicom' },
  { city: 'Shanghai', country: 'China', code: 'CN', lat: 31.23, lon: 121.47, asn: 'AS4812', org: 'China Telecom' },
  { city: 'Shenzhen', country: 'China', code: 'CN', lat: 22.54, lon: 114.06, asn: 'AS4134', org: 'ChinaNet' },
  { city: 'Guangzhou', country: 'China', code: 'CN', lat: 23.13, lon: 113.26, asn: 'AS4134', org: 'ChinaNet' },
  { city: 'Chengdu', country: 'China', code: 'CN', lat: 30.57, lon: 104.07, asn: 'AS4812', org: 'China Telecom' },
  // Iran
  { city: 'Tehran', country: 'Iran', code: 'IR', lat: 35.69, lon: 51.39, asn: 'AS44244', org: 'Irancell' },
  { city: 'Isfahan', country: 'Iran', code: 'IR', lat: 32.65, lon: 51.68, asn: 'AS12880', org: 'DCI' },
  // North Korea
  { city: 'Pyongyang', country: 'North Korea', code: 'KP', lat: 39.02, lon: 125.75, asn: 'AS131279', org: 'Star JV' },
  // Nigeria
  { city: 'Lagos', country: 'Nigeria', code: 'NG', lat: 6.52, lon: 3.38, asn: 'AS36873', org: 'Globacom' },
  { city: 'Abuja', country: 'Nigeria', code: 'NG', lat: 9.06, lon: 7.49, asn: 'AS29465', org: 'MTN Nigeria' },
  // Brazil
  { city: 'São Paulo', country: 'Brazil', code: 'BR', lat: -23.55, lon: -46.63, asn: 'AS28573', org: 'Claro SA' },
  { city: 'Rio de Janeiro', country: 'Brazil', code: 'BR', lat: -22.91, lon: -43.17, asn: 'AS18881', org: 'Vivo' },
  // India
  { city: 'Mumbai', country: 'India', code: 'IN', lat: 19.08, lon: 72.88, asn: 'AS9829', org: 'BSNL' },
  { city: 'Delhi', country: 'India', code: 'IN', lat: 28.61, lon: 77.21, asn: 'AS55836', org: 'Reliance Jio' },
  { city: 'Bangalore', country: 'India', code: 'IN', lat: 12.97, lon: 77.59, asn: 'AS9829', org: 'BSNL' },
  // Southeast Asia
  { city: 'Jakarta', country: 'Indonesia', code: 'ID', lat: -6.21, lon: 106.85, asn: 'AS17974', org: 'Telkom' },
  { city: 'Hanoi', country: 'Vietnam', code: 'VN', lat: 21.03, lon: 105.85, asn: 'AS45899', org: 'VNPT' },
  { city: 'Ho Chi Minh City', country: 'Vietnam', code: 'VN', lat: 10.82, lon: 106.63, asn: 'AS7552', org: 'Viettel' },
  { city: 'Bangkok', country: 'Thailand', code: 'TH', lat: 13.76, lon: 100.50, asn: 'AS23969', org: 'TOT' },
  { city: 'Manila', country: 'Philippines', code: 'PH', lat: 14.60, lon: 120.98, asn: 'AS9299', org: 'PLDT' },
  // Eastern Europe
  { city: 'Kyiv', country: 'Ukraine', code: 'UA', lat: 50.45, lon: 30.52, asn: 'AS13249', org: 'Kyivstar' },
  { city: 'Bucharest', country: 'Romania', code: 'RO', lat: 44.43, lon: 26.10, asn: 'AS8708', org: 'RCS & RDS' },
  { city: 'Warsaw', country: 'Poland', code: 'PL', lat: 52.23, lon: 21.01, asn: 'AS5617', org: 'Orange Polska' },
  { city: 'Minsk', country: 'Belarus', code: 'BY', lat: 53.90, lon: 27.57, asn: 'AS6697', org: 'Beltelecom' },
  { city: 'Sofia', country: 'Bulgaria', code: 'BG', lat: 42.70, lon: 23.32, asn: 'AS8866', org: 'Vivacom' },
  // Middle East
  { city: 'Istanbul', country: 'Turkey', code: 'TR', lat: 41.01, lon: 28.98, asn: 'AS9121', org: 'Turk Telekom' },
  { city: 'Cairo', country: 'Egypt', code: 'EG', lat: 30.04, lon: 31.24, asn: 'AS36935', org: 'Telecom Egypt' },
  { city: 'Riyadh', country: 'Saudi Arabia', code: 'SA', lat: 24.69, lon: 46.72, asn: 'AS25019', org: 'STC' },
  // Africa
  { city: 'Johannesburg', country: 'South Africa', code: 'ZA', lat: -26.20, lon: 28.04, asn: 'AS3741', org: 'Telkom SA' },
  { city: 'Nairobi', country: 'Kenya', code: 'KE', lat: -1.29, lon: 36.82, asn: 'AS33771', org: 'Safaricom' },
  { city: 'Casablanca', country: 'Morocco', code: 'MA', lat: 33.57, lon: -7.59, asn: 'AS6713', org: 'IAM' },
  // Americas
  { city: 'Buenos Aires', country: 'Argentina', code: 'AR', lat: -34.60, lon: -58.38, asn: 'AS7303', org: 'Telecom Argentina' },
  { city: 'Mexico City', country: 'Mexico', code: 'MX', lat: 19.43, lon: -99.13, asn: 'AS8151', org: 'Uninet' },
  { city: 'Bogotá', country: 'Colombia', code: 'CO', lat: 4.71, lon: -74.07, asn: 'AS13489', org: 'EPM Telecomunicaciones' },
  { city: 'Lima', country: 'Peru', code: 'PE', lat: -12.05, lon: -77.04, asn: 'AS6147', org: 'Telefonica del Peru' },
];

const TARGET_CITIES: CityDef[] = [
  // US Data Centers
  { city: 'Ashburn', country: 'USA', code: 'US', lat: 39.04, lon: -77.49, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'New York', country: 'USA', code: 'US', lat: 40.71, lon: -74.01, asn: 'AS22394', org: 'Verizon Business' },
  { city: 'San Francisco', country: 'USA', code: 'US', lat: 37.77, lon: -122.42, asn: 'AS15169', org: 'Google Cloud' },
  { city: 'Dallas', country: 'USA', code: 'US', lat: 32.78, lon: -96.80, asn: 'AS36351', org: 'SoftLayer' },
  { city: 'Chicago', country: 'USA', code: 'US', lat: 41.88, lon: -87.63, asn: 'AS20940', org: 'Akamai' },
  { city: 'Seattle', country: 'USA', code: 'US', lat: 47.61, lon: -122.33, asn: 'AS8075', org: 'Microsoft Azure' },
  { city: 'Los Angeles', country: 'USA', code: 'US', lat: 34.05, lon: -118.24, asn: 'AS13335', org: 'Cloudflare' },
  // Europe
  { city: 'London', country: 'UK', code: 'GB', lat: 51.51, lon: -0.13, asn: 'AS8075', org: 'Microsoft Azure' },
  { city: 'Frankfurt', country: 'Germany', code: 'DE', lat: 50.11, lon: 8.68, asn: 'AS8075', org: 'Microsoft Azure' },
  { city: 'Amsterdam', country: 'Netherlands', code: 'NL', lat: 52.37, lon: 4.90, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Paris', country: 'France', code: 'FR', lat: 48.86, lon: 2.35, asn: 'AS3215', org: 'Orange SA' },
  { city: 'Stockholm', country: 'Sweden', code: 'SE', lat: 59.33, lon: 18.07, asn: 'AS1299', org: 'Telia' },
  { city: 'Dublin', country: 'Ireland', code: 'IE', lat: 53.35, lon: -6.26, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Zurich', country: 'Switzerland', code: 'CH', lat: 47.38, lon: 8.54, asn: 'AS15169', org: 'Google Cloud' },
  // Asia Pacific
  { city: 'Tokyo', country: 'Japan', code: 'JP', lat: 35.69, lon: 139.69, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Singapore', country: 'Singapore', code: 'SG', lat: 1.35, lon: 103.82, asn: 'AS15169', org: 'Google Cloud' },
  { city: 'Sydney', country: 'Australia', code: 'AU', lat: -33.87, lon: 151.21, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Seoul', country: 'South Korea', code: 'KR', lat: 37.57, lon: 126.98, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Mumbai', country: 'India', code: 'IN', lat: 19.08, lon: 72.88, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Hong Kong', country: 'Hong Kong', code: 'HK', lat: 22.32, lon: 114.17, asn: 'AS15169', org: 'Google Cloud' },
  // Other
  { city: 'Toronto', country: 'Canada', code: 'CA', lat: 43.65, lon: -79.38, asn: 'AS812', org: 'Rogers' },
  { city: 'São Paulo', country: 'Brazil', code: 'BR', lat: -23.55, lon: -46.63, asn: 'AS16509', org: 'Amazon AWS' },
  { city: 'Dubai', country: 'UAE', code: 'AE', lat: 25.20, lon: 55.27, asn: 'AS8966', org: 'Emirates Telecom' },
  { city: 'Tel Aviv', country: 'Israel', code: 'IL', lat: 32.09, lon: 34.77, asn: 'AS8551', org: 'Bezeq' },
];

const CATEGORIES: ThreatCategory[] = [
  'phishing', 'malware', 'ddos', 'exploit', 'ransomware',
  'credential_stuffing', 'recon', 'data_exfiltration', 'botnet',
];

const SEVERITIES: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
const SEVERITY_WEIGHTS = [0.05, 0.15, 0.4, 0.4];

const SOURCE_TYPES: SourceType[] = [
  'edr', 'siem', 'honeypot', 'osint', 'threat_intel_feed', 'user_reports',
];

const MITRE_MAP = [
  { tactic: 'Initial Access', id: 'T1566', name: 'Phishing' },
  { tactic: 'Initial Access', id: 'T1190', name: 'Exploit Public-Facing Application' },
  { tactic: 'Execution', id: 'T1059', name: 'Command and Scripting Interpreter' },
  { tactic: 'Execution', id: 'T1204', name: 'User Execution' },
  { tactic: 'Persistence', id: 'T1547', name: 'Boot or Logon Autostart Execution' },
  { tactic: 'Persistence', id: 'T1136', name: 'Create Account' },
  { tactic: 'Privilege Escalation', id: 'T1068', name: 'Exploitation for Privilege Escalation' },
  { tactic: 'Defense Evasion', id: 'T1027', name: 'Obfuscated Files or Information' },
  { tactic: 'Defense Evasion', id: 'T1562', name: 'Impair Defenses' },
  { tactic: 'Credential Access', id: 'T1110', name: 'Brute Force' },
  { tactic: 'Credential Access', id: 'T1003', name: 'OS Credential Dumping' },
  { tactic: 'Discovery', id: 'T1046', name: 'Network Service Discovery' },
  { tactic: 'Discovery', id: 'T1087', name: 'Account Discovery' },
  { tactic: 'Lateral Movement', id: 'T1021', name: 'Remote Services' },
  { tactic: 'Collection', id: 'T1005', name: 'Data from Local System' },
  { tactic: 'Exfiltration', id: 'T1041', name: 'Exfiltration Over C2 Channel' },
  { tactic: 'Exfiltration', id: 'T1048', name: 'Exfiltration Over Alternative Protocol' },
  { tactic: 'Impact', id: 'T1486', name: 'Data Encrypted for Impact' },
  { tactic: 'Impact', id: 'T1498', name: 'Network Denial of Service' },
  { tactic: 'Command and Control', id: 'T1071', name: 'Application Layer Protocol' },
  { tactic: 'Command and Control', id: 'T1573', name: 'Encrypted Channel' },
];

const DOMAINS = [
  'malware-c2.evil.com', 'phish-login.net', 'exfil-data.xyz',
  'botnet-ctrl.ru', 'ransomware-pay.onion.ws', 'stealer-panel.top',
  'cobaltstrike-cdn.com', 'apt-dropper.info', 'fast-flux-net.org',
  'darkside-ransom.net', 'lazarus-c2.xyz', 'turla-proxy.org',
  'kimsuky-beacon.com', 'sandworm-relay.net',
];

const CVES = [
  'CVE-2024-3400', 'CVE-2024-21887', 'CVE-2023-46805',
  'CVE-2024-1709', 'CVE-2023-22515', 'CVE-2024-23897',
  'CVE-2024-0012', 'CVE-2023-4966', 'CVE-2024-27198',
  'CVE-2024-38856', 'CVE-2023-20198', 'CVE-2024-6387',
];

const CAMPAIGNS = [
  'APT29-SolarWinds', 'Lazarus-CryptoHeist', 'FancyBear-2024',
  'CharmingKitten-Phish', 'Sandworm-Wiper', 'Kimsuky-Recon',
  'Turla-Satellite', 'APT41-SupplyChain', 'Volt-Typhoon',
  null, null, null, null, null,
];

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
      lat: src.lat + (Math.random() - 0.5) * 0.5,
      lon: src.lon + (Math.random() - 0.5) * 0.5,
      asn: src.asn,
      org: src.org,
    },
    target: {
      ip: randomIp(),
      port: pick([80, 443, 22, 3389, 8080, 8443, 25, 53, 993, 5432]),
      country: tgt.country,
      country_code: tgt.code,
      city: tgt.city,
      lat: tgt.lat + (Math.random() - 0.5) * 0.3,
      lon: tgt.lon + (Math.random() - 0.5) * 0.3,
      asn: tgt.asn,
      org: tgt.org,
    },
    indicators: {
      domain: Math.random() > 0.4 ? pick(DOMAINS) : undefined,
      url: Math.random() > 0.6 ? `https://${pick(DOMAINS)}/payload/${randomHash().slice(0, 8)}` : undefined,
      hash: Math.random() > 0.4 ? randomHash() : undefined,
      cve: Math.random() > 0.65 ? pick(CVES) : undefined,
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
      first_seen: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString().split('T')[0],
      threat_type: category,
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
