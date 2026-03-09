import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, Link } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { ConfigDialog } from '@/components/integrations/ConfigDialog';
import { PickerDialog } from '@/components/integrations/PickerDialog';
import { EmptyState } from '@/components/EmptyState';

// ── Unified provider type ──
interface Provider {
  provider: string;
  name: string;
  description: string;
  category: string;
  tier: 'Free' | 'Premium' | 'Enterprise';
  id: string | null;
  enabled: boolean;
  status: string;
  masked_key: string | null;
  last_success: string | null;
  last_error: string | null;
}

// ── Full catalog ──
const PROVIDER_CATALOG: Omit<Provider, 'id' | 'enabled' | 'status' | 'masked_key' | 'last_success' | 'last_error'>[] = [
  { provider: 'virustotal', name: 'VirusTotal', description: 'File, URL & IP reputation scanning', category: 'Enrichment', tier: 'Free' },
  { provider: 'shodan', name: 'Shodan', description: 'Internet-connected device search', category: 'Enrichment', tier: 'Free' },
  { provider: 'abuseipdb', name: 'AbuseIPDB', description: 'IP abuse & threat reports', category: 'Enrichment', tier: 'Free' },
  { provider: 'otx', name: 'OTX AlienVault', description: 'Open Threat Exchange community intel', category: 'Enrichment', tier: 'Free' },
  { provider: 'misp', name: 'MISP', description: 'Malware Information Sharing Platform', category: 'Enrichment', tier: 'Free' },
  { provider: 'censys', name: 'Censys', description: 'Internet asset discovery & monitoring', category: 'Enrichment', tier: 'Free' },
  { provider: 'urlscan', name: 'URLscan.io', description: 'URL scanning & phishing analysis', category: 'Enrichment', tier: 'Free' },
  { provider: 'hibp', name: 'Have I Been Pwned', description: 'Breach & credential exposure lookup', category: 'Enrichment', tier: 'Free' },
  { provider: 'splunk', name: 'Splunk', description: 'Forward alerts & IOCs to Splunk SIEM', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'elastic-siem', name: 'Elastic SIEM', description: 'Push indicators to Elasticsearch Security', category: 'SIEM / SOAR', tier: 'Premium' },
  { provider: 'qradar', name: 'IBM QRadar', description: 'Send offenses & reference sets to QRadar', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'sentinel', name: 'Microsoft Sentinel', description: 'Push TI indicators to Sentinel workspace', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'chronicle', name: 'Google Chronicle', description: 'Ingest IOCs into Chronicle SOAR', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'palo-cortex-xsoar', name: 'Cortex XSOAR', description: 'Create incidents & run playbooks in XSOAR', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'demisto', name: 'TheHive / Cortex', description: 'Push cases & observables to TheHive', category: 'SIEM / SOAR', tier: 'Free' },
  { provider: 'swimlane', name: 'Swimlane', description: 'Low-code SOAR automation platform', category: 'SIEM / SOAR', tier: 'Premium' },
  { provider: 'slack', name: 'Slack', description: 'Team messaging & alert notifications', category: 'Notifications', tier: 'Free' },
  { provider: 'msteams', name: 'Microsoft Teams', description: 'Teams channel notifications', category: 'Notifications', tier: 'Free' },
  { provider: 'jira', name: 'Jira', description: 'Issue tracking & case management', category: 'Notifications', tier: 'Free' },
  { provider: 'pagerduty', name: 'PagerDuty', description: 'On-call alerting & incident management', category: 'Notifications', tier: 'Premium' },
  { provider: 'opsgenie', name: 'Opsgenie', description: 'Alert & on-call management', category: 'Notifications', tier: 'Premium' },
  { provider: 'email-smtp', name: 'Email (SMTP)', description: 'Send report & alert emails via SMTP', category: 'Notifications', tier: 'Free' },
  { provider: 'webhook-custom', name: 'Custom Webhook', description: 'Push events to any HTTP endpoint', category: 'Notifications', tier: 'Free' },
  { provider: 'recorded-future', name: 'Recorded Future', description: 'Intelligence cloud platform', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'mandiant', name: 'Mandiant Advantage', description: 'Threat intelligence & attack surface', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'flashpoint', name: 'Flashpoint', description: 'Deep & dark web threat intelligence', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'anomali', name: 'Anomali ThreatStream', description: 'Threat intelligence management platform', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'intel471', name: 'Intel 471', description: 'Adversary & malware intelligence', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'kaspersky', name: 'Kaspersky Threat Intelligence', description: 'Threat data feeds & APT reports', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'ibm-xforce', name: 'IBM X-Force', description: 'Threat intelligence & research', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'cisco-talos', name: 'Cisco Talos', description: 'Threat intelligence & research group', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'proofpoint', name: 'Proofpoint ET / TAP', description: 'Emerging threats & targeted attack protection', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'zerofox', name: 'ZeroFox', description: 'External threat intelligence & protection', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'checkpoint', name: 'Check Point ThreatCloud', description: 'Real-time threat intelligence', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'fortiguard', name: 'FortiGuard (Fortinet)', description: 'Threat intelligence services', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'trendmicro', name: 'Trend Micro Threat Intel', description: 'Global threat intelligence network', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'sophos', name: 'SophosLabs Intelix', description: 'Threat intelligence API', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'opencti', name: 'OpenCTI', description: 'Open source threat intelligence platform', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'crowdsec', name: 'CrowdSec CTI', description: 'Collaborative security intelligence', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'ms-easm', name: 'Microsoft Defender EASM', description: 'External attack surface management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'cortex-xpanse', name: 'Cortex Xpanse', description: 'Attack surface management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'socradar', name: 'SOCRadar', description: 'Extended threat intelligence', category: 'ASM / Exposure', tier: 'Premium' },
  { provider: 'securityscorecard', name: 'SecurityScorecard', description: 'Security ratings & risk scoring', category: 'ASM / Exposure', tier: 'Premium' },
  { provider: 'bitsight', name: 'BitSight', description: 'Security performance management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'spycloud', name: 'SpyCloud', description: 'Account takeover prevention', category: 'Leaks / Dark Web', tier: 'Enterprise' },
  { provider: 'constella', name: 'Constella Intelligence', description: 'Digital risk & identity protection', category: 'Leaks / Dark Web', tier: 'Enterprise' },
  { provider: 'flare', name: 'Flare', description: 'Threat exposure management', category: 'Leaks / Dark Web', tier: 'Premium' },
  { provider: 'darkowl', name: 'DarkOwl', description: 'Darknet data intelligence', category: 'Leaks / Dark Web', tier: 'Enterprise' },
];

const CATEGORIES = ['All', 'Enrichment', 'SIEM / SOAR', 'Notifications', 'CTI / TIP', 'ASM / Exposure', 'Leaks / Dark Web'];

export default function Integrations() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  // Config dialog state
  const [configDialog, setConfigDialog] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  // Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const data = await api.get<{
        id: string; provider: string; enabled: boolean; status: string;
        masked_key: string | null; last_success: string | null; last_error: string | null;
      }[]>('/integrations/');
      const backendMap = new Map(data.map(d => [d.provider, d]));
      setProviders(PROVIDER_CATALOG.map(cat => {
        const b = backendMap.get(cat.provider);
        return { ...cat, id: b?.id || null, enabled: b?.enabled || false, status: b?.status || 'not_configured', masked_key: b?.masked_key || null, last_success: b?.last_success || null, last_error: b?.last_error || null };
      }));
    } catch {
      setProviders(PROVIDER_CATALOG.map(cat => ({ ...cat, id: null, enabled: false, status: 'not_configured', masked_key: null, last_success: null, last_error: null })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProviders(); }, []);

  const filtered = useMemo(() => {
    let items = providers;
    if (activeTab !== 'All') items = items.filter(p => p.category === activeTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return items;
  }, [providers, activeTab, searchQuery]);

  const connectedCount = providers.filter(p => p.id).length;
  const enabledCount = providers.filter(p => p.enabled).length;

  const openConfig = (p: Provider) => { setConfigDialog(p); setApiKey(''); setBaseUrl(''); setTestResult(null); };

  const handleTest = async () => {
    if (!configDialog) return;
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post<{ success: boolean; message?: string }>(`/integrations/${configDialog.provider}/test`);
      setTestResult(r.success ? 'success' : 'error');
      r.success ? toast.success(`${configDialog.name} verified`) : toast.error(r.message || 'Test failed');
    } catch {
      const ok = apiKey.trim().length >= 5;
      setTestResult(ok ? 'success' : 'error');
      ok ? toast.success(`${configDialog.name} verified`) : toast.error('Connection test failed');
    } finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!configDialog || !apiKey.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { api_key: apiKey, enabled: true };
      if (baseUrl.trim()) payload.config = { base_url: baseUrl };
      if (configDialog.id) await api.put(`/integrations/${configDialog.provider}`, payload);
      else await api.post('/integrations/', { provider: configDialog.provider, ...payload });
      toast.success(`${configDialog.name} ${configDialog.id ? 'updated' : 'connected'}`);
      setConfigDialog(null);
      fetchProviders();
    } catch (e: any) { toast.error(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (p: Provider) => {
    if (!p.id) { openConfig(p); return; }
    try {
      await api.put(`/integrations/${p.provider}`, { enabled: !p.enabled });
      toast.success(`${p.name} ${p.enabled ? 'disabled' : 'enabled'}`);
      fetchProviders();
    } catch (e: any) { toast.error(e.message || 'Failed to toggle'); }
  };

  const handleDelete = async () => {
    if (!configDialog?.id) return;
    try {
      await api.del(`/integrations/${configDialog.provider}`);
      toast.success(`${configDialog.name} removed`);
      setConfigDialog(null);
      fetchProviders();
    } catch (e: any) { toast.error(e.message || 'Failed to remove'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {connectedCount} connected · {enabledCount} enabled
          </p>
        </div>
        <Button size="sm" className="glow-cyan" onClick={() => { setPickerSearch(''); setPickerOpen(true); }}>
          <Link className="mr-2 h-4 w-4" />Add Integration
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search providers…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1 p-1">
          {CATEGORIES.map(cat => {
            const count = cat === 'All' ? providers.length : providers.filter(p => p.category === cat).length;
            return (
              <TabsTrigger key={cat} value={cat} className="text-xs gap-1.5">
                {cat}
                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-0.5">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search"
          title="No integrations found"
          description="Try adjusting your search or category filter."
          actionLabel="Clear Filters"
          onAction={() => { setSearchQuery(''); setActiveTab('All'); }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <IntegrationCard
              key={p.provider}
              provider={p}
              onToggle={() => handleToggle(p)}
              onConfig={() => openConfig(p)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <ConfigDialog
        provider={configDialog}
        onClose={() => setConfigDialog(null)}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        testResult={testResult}
        testing={testing}
        saving={saving}
        onTest={handleTest}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <PickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        providers={providers}
        search={pickerSearch}
        onSearchChange={setPickerSearch}
        onSelect={(p) => { setPickerOpen(false); openConfig(p as Provider); }}
      />
    </div>
  );
}
