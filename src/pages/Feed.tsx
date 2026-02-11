import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rss, ExternalLink, Building2, RefreshCw } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { IntelItem, SeverityLevel, ObservableType } from '@/types';

const severityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

const typeOptions = [
  { value: 'ip', label: 'IP' },
  { value: 'domain', label: 'Domain' },
  { value: 'url', label: 'URL' },
  { value: 'hash_sha256', label: 'Hash' },
  { value: 'cve', label: 'CVE' },
  { value: 'email', label: 'Email' },
];

// Demo data for Dev Mode
const DEMO_FEED: IntelItem[] = [
  { id: '1', title: 'CVE-2024-3400 - PAN-OS Command Injection', description: 'Critical command injection vulnerability in Palo Alto Networks PAN-OS GlobalProtect feature.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-3400', source_id: 'cisa-kev', source_name: 'CISA KEV', fetched_at: new Date().toISOString(), published_at: new Date().toISOString(), original_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', excerpt: 'A command injection as a result of arbitrary file creation vulnerability in the GlobalProtect feature of PAN-OS.', dedup_count: 3, asset_match: true, matched_assets: ['paloalto.company.com'], confidence_score: 95, risk_score: 98, tags: ['firewall', 'rce'] },
  { id: '2', title: 'Emotet botnet C2 activity detected', description: 'New Emotet C2 server identified serving malware payloads.', severity: 'high' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '185.244.25.14', source_id: 'feodo-tracker', source_name: 'Feodo Tracker', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 3600000).toISOString(), original_url: 'https://feodotracker.abuse.ch', excerpt: 'IP address associated with Emotet C2 infrastructure.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 88, risk_score: 75, tags: ['botnet'] },
  { id: '3', title: 'Phishing campaign targeting finance sector', description: 'New phishing kit mimicking major banking portals detected on multiple domains.', severity: 'high' as SeverityLevel, observable_type: 'domain' as ObservableType, observable_value: 'secure-banklogin.com', source_id: 'openphish', source_name: 'OpenPhish', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 7200000).toISOString(), original_url: 'https://openphish.com', excerpt: 'Phishing domain impersonating banking portal.', dedup_count: 5, asset_match: true, matched_assets: ['company-bank.com'], confidence_score: 92, risk_score: 85, tags: ['phishing', 'finance'] },
  { id: '4', title: 'Malicious URL distributing AgentTesla', description: 'URL hosting executable payload identified as AgentTesla stealer.', severity: 'medium' as SeverityLevel, observable_type: 'url' as ObservableType, observable_value: 'https://malicious-downloads.xyz/update.exe', source_id: 'urlhaus', source_name: 'URLhaus', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 10800000).toISOString(), original_url: 'https://urlhaus.abuse.ch', excerpt: 'Malware distribution URL serving AgentTesla payload.', dedup_count: 2, asset_match: false, matched_assets: [], confidence_score: 80, risk_score: 60, tags: ['malware'] },
  { id: '5', title: 'CVE-2024-21887 - Ivanti Connect Secure Auth Bypass', description: 'Authentication bypass vulnerability in Ivanti Connect Secure and Policy Secure.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-21887', source_id: 'nvd-cve', source_name: 'NVD', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 14400000).toISOString(), original_url: 'https://nvd.nist.gov', excerpt: 'A command injection vulnerability allows authenticated administrators to send specially crafted requests.', dedup_count: 8, asset_match: true, matched_assets: ['vpn.company.com'], confidence_score: 99, risk_score: 97, tags: ['vpn', 'auth-bypass'] },
  { id: '6', title: 'Tor exit node scanning activity', description: 'Known Tor exit node performing port scanning against enterprise ranges.', severity: 'low' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '104.244.76.13', source_id: 'tor-exit', source_name: 'Tor Exit Nodes', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 18000000).toISOString(), original_url: 'https://check.torproject.org', excerpt: 'Tor exit node IP observed in scan activity.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 60, risk_score: 30, tags: ['tor', 'scanning'] },
  { id: '7', title: 'Ransomware group claims breach of healthcare org', description: 'LockBit 3.0 claims data exfiltration from healthcare provider.', severity: 'high' as SeverityLevel, observable_type: 'actor' as ObservableType, observable_value: 'LockBit 3.0', source_id: 'hackernews-sec', source_name: 'The Hacker News', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 21600000).toISOString(), original_url: 'https://thehackernews.com', excerpt: 'LockBit ransomware group claims to have exfiltrated patient records.', dedup_count: 4, asset_match: false, matched_assets: [], confidence_score: 70, risk_score: 65, tags: ['ransomware', 'healthcare'] },
  { id: '8', title: 'SHA256 hash linked to CobaltStrike beacon', description: 'New CobaltStrike beacon binary hash identified in wild.', severity: 'medium' as SeverityLevel, observable_type: 'hash_sha256' as ObservableType, observable_value: 'e3b0c44298fc1c149afbf4c8996fb924', source_id: 'malwarebazaar', source_name: 'MalwareBazaar', fetched_at: new Date().toISOString(), published_at: new Date(Date.now() - 25200000).toISOString(), original_url: 'https://bazaar.abuse.ch', excerpt: 'CobaltStrike beacon hash.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 85, risk_score: 55, tags: ['cobaltstrike', 'c2'] },
];

export default function Feed() {
  const navigate = useNavigate();
  const [items, setItems] = useState<IntelItem[]>(DEMO_FEED);
  const [companyFirst, setCompanyFirst] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    toast.info('Refreshing intel feed...');
    setTimeout(() => {
      // Simulate refresh with shuffled timestamps
      setItems(prev => prev.map(item => ({ ...item, fetched_at: new Date().toISOString() })));
      setRefreshing(false);
      toast.success(`Feed refreshed — ${items.length} items`);
    }, 1200);
  }, [items.length]);

  const displayItems = companyFirst
    ? [...items].sort((a, b) => (b.asset_match ? 1 : 0) - (a.asset_match ? 1 : 0))
    : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intel Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} items from enabled sources</p>
        </div>
        <div className="flex gap-2">
          <Button variant={companyFirst ? 'default' : 'outline'} size="sm" onClick={() => setCompanyFirst(!companyFirst)}>
            <Building2 className="mr-2 h-4 w-4" /> Company First
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>
      <FilterBar
        filterOptions={[
          { key: 'severity', label: 'Severity', options: severityOptions },
          { key: 'type', label: 'Type', options: typeOptions },
        ]}
        showAssetMatchToggle
      />
      <div className="space-y-2">
        {displayItems.map(item => (
          <Card key={item.id} className={`border-border bg-card transition-all hover:border-primary/20 ${item.asset_match ? 'border-l-2 border-l-primary' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={item.severity} />
                    <ObservableTypeBadge type={item.observable_type} />
                    {item.asset_match && <Badge className="bg-primary/20 text-primary text-xs">Asset Match</Badge>}
                    {item.dedup_count > 1 && <Badge variant="outline" className="text-xs">×{item.dedup_count}</Badge>}
                  </div>
                  <h3 className="font-medium text-sm text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{item.observable_value}</span>
                    <span>via {item.source_name}</span>
                    <span>{new Date(item.published_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <a href={item.original_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}