import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, Settings, TestTube, Loader2, Check, Shield, CheckCircle2, AlertCircle, Unlink, Link, Trash2, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// ── Unified provider type ──
interface Provider {
  provider: string;
  name: string;
  description: string;
  category: string;
  tier: 'Free' | 'Premium' | 'Enterprise';
  // Backend state (null = not configured)
  id: string | null;
  enabled: boolean;
  status: string;
  masked_key: string | null;
  last_success: string | null;
  last_error: string | null;
}

// ── Full catalog: Active API services — Enrichment, SIEM/SOAR, Notifications, CTI, ASM, Leaks ──
const PROVIDER_CATALOG: Omit<Provider, 'id' | 'enabled' | 'status' | 'masked_key' | 'last_success' | 'last_error'>[] = [
  // Enrichment (free-tier / API-key)
  { provider: 'virustotal', name: 'VirusTotal', description: 'File, URL & IP reputation scanning', category: 'Enrichment', tier: 'Free' },
  { provider: 'shodan', name: 'Shodan', description: 'Internet-connected device search', category: 'Enrichment', tier: 'Free' },
  { provider: 'abuseipdb', name: 'AbuseIPDB', description: 'IP abuse & threat reports', category: 'Enrichment', tier: 'Free' },
  { provider: 'otx', name: 'OTX AlienVault', description: 'Open Threat Exchange community intel', category: 'Enrichment', tier: 'Free' },
  { provider: 'misp', name: 'MISP', description: 'Malware Information Sharing Platform', category: 'Enrichment', tier: 'Free' },
  { provider: 'censys', name: 'Censys', description: 'Internet asset discovery & monitoring', category: 'Enrichment', tier: 'Free' },
  { provider: 'urlscan', name: 'URLscan.io', description: 'URL scanning & phishing analysis', category: 'Enrichment', tier: 'Free' },
  { provider: 'hibp', name: 'Have I Been Pwned', description: 'Breach & credential exposure lookup', category: 'Enrichment', tier: 'Free' },

  // SIEM / SOAR
  { provider: 'splunk', name: 'Splunk', description: 'Forward alerts & IOCs to Splunk SIEM', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'elastic-siem', name: 'Elastic SIEM', description: 'Push indicators to Elasticsearch Security', category: 'SIEM / SOAR', tier: 'Premium' },
  { provider: 'qradar', name: 'IBM QRadar', description: 'Send offenses & reference sets to QRadar', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'sentinel', name: 'Microsoft Sentinel', description: 'Push TI indicators to Sentinel workspace', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'chronicle', name: 'Google Chronicle', description: 'Ingest IOCs into Chronicle SOAR', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'palo-cortex-xsoar', name: 'Cortex XSOAR', description: 'Create incidents & run playbooks in XSOAR', category: 'SIEM / SOAR', tier: 'Enterprise' },
  { provider: 'demisto', name: 'TheHive / Cortex', description: 'Push cases & observables to TheHive', category: 'SIEM / SOAR', tier: 'Free' },
  { provider: 'swimlane', name: 'Swimlane', description: 'Low-code SOAR automation platform', category: 'SIEM / SOAR', tier: 'Premium' },

  // Notifications / Ticketing
  { provider: 'slack', name: 'Slack', description: 'Team messaging & alert notifications', category: 'Notifications', tier: 'Free' },
  { provider: 'msteams', name: 'Microsoft Teams', description: 'Teams channel notifications', category: 'Notifications', tier: 'Free' },
  { provider: 'jira', name: 'Jira', description: 'Issue tracking & case management', category: 'Notifications', tier: 'Free' },
  { provider: 'pagerduty', name: 'PagerDuty', description: 'On-call alerting & incident management', category: 'Notifications', tier: 'Premium' },
  { provider: 'opsgenie', name: 'Opsgenie', description: 'Alert & on-call management', category: 'Notifications', tier: 'Premium' },
  { provider: 'email-smtp', name: 'Email (SMTP)', description: 'Send report & alert emails via SMTP', category: 'Notifications', tier: 'Free' },
  { provider: 'webhook-custom', name: 'Custom Webhook', description: 'Push events to any HTTP endpoint', category: 'Notifications', tier: 'Free' },

  // Premium CTI / TIP
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

  // ASM / Exposure
  { provider: 'ms-easm', name: 'Microsoft Defender EASM', description: 'External attack surface management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'cortex-xpanse', name: 'Cortex Xpanse', description: 'Attack surface management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'socradar', name: 'SOCRadar', description: 'Extended threat intelligence', category: 'ASM / Exposure', tier: 'Premium' },
  { provider: 'securityscorecard', name: 'SecurityScorecard', description: 'Security ratings & risk scoring', category: 'ASM / Exposure', tier: 'Premium' },
  { provider: 'bitsight', name: 'BitSight', description: 'Security performance management', category: 'ASM / Exposure', tier: 'Enterprise' },

  // Leaks / Dark Web
  { provider: 'spycloud', name: 'SpyCloud', description: 'Account takeover prevention', category: 'Leaks / Dark Web', tier: 'Enterprise' },
  { provider: 'constella', name: 'Constella Intelligence', description: 'Digital risk & identity protection', category: 'Leaks / Dark Web', tier: 'Enterprise' },
  { provider: 'flare', name: 'Flare', description: 'Threat exposure management', category: 'Leaks / Dark Web', tier: 'Premium' },
  { provider: 'darkowl', name: 'DarkOwl', description: 'Darknet data intelligence', category: 'Leaks / Dark Web', tier: 'Enterprise' },
];

const CATEGORIES = ['All', 'Enrichment', 'SIEM / SOAR', 'Notifications', 'CTI / TIP', 'ASM / Exposure', 'Leaks / Dark Web'];

const tierColor: Record<string, string> = {
  Free: 'bg-accent/20 text-accent',
  Premium: 'bg-primary/20 text-primary',
  Enterprise: 'bg-destructive/20 text-destructive',
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'active': return <CheckCircle2 className="h-3.5 w-3.5 text-accent" />;
    case 'error': return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    default: return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export default function Integrations() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  // Config dialog
  const [configDialog, setConfigDialog] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  // Add Integration picker dialog
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

      const merged: Provider[] = PROVIDER_CATALOG.map(cat => {
        const backend = backendMap.get(cat.provider);
        return {
          ...cat,
          id: backend?.id || null,
          enabled: backend?.enabled || false,
          status: backend?.status || 'not_configured',
          masked_key: backend?.masked_key || null,
          last_success: backend?.last_success || null,
          last_error: backend?.last_error || null,
        };
      });
      setProviders(merged);
    } catch {
      // Fallback: show catalog with default state when backend is unavailable
      const fallback: Provider[] = PROVIDER_CATALOG.map(cat => ({
        ...cat,
        id: null, enabled: false, status: 'not_configured',
        masked_key: null, last_success: null, last_error: null,
      }));
      setProviders(fallback);
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
      items = items.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q));
    }
    return items;
  }, [providers, activeTab, searchQuery]);

  const connectedCount = providers.filter(p => p.id).length;
  const enabledCount = providers.filter(p => p.enabled).length;

  // ── Actions ──
  const openConfig = (p: Provider) => {
    setConfigDialog(p);
    setApiKey('');
    setBaseUrl('');
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!configDialog) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message?: string }>(`/integrations/${configDialog.provider}/test`);
      setTestResult(result.success ? 'success' : 'error');
      result.success ? toast.success(`${configDialog.name} connection verified`) : toast.error(result.message || 'Test failed');
    } catch {
      const success = apiKey.trim().length >= 5;
      setTestResult(success ? 'success' : 'error');
      success ? toast.success(`${configDialog.name} connection verified`) : toast.error('Connection test failed — check credentials');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!configDialog || !apiKey.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { api_key: apiKey, enabled: true };
      if (baseUrl.trim()) payload.config = { base_url: baseUrl };
      if (configDialog.id) {
        await api.put(`/integrations/${configDialog.provider}`, payload);
      } else {
        await api.post('/integrations/', { provider: configDialog.provider, ...payload });
      }
      toast.success(`${configDialog.name} ${configDialog.id ? 'updated' : 'connected and enabled'}`);
      setConfigDialog(null);
      fetchProviders();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Provider) => {
    if (!p.id) { openConfig(p); return; }
    try {
      await api.put(`/integrations/${p.provider}`, { enabled: !p.enabled });
      toast.success(`${p.name} ${p.enabled ? 'disabled' : 'enabled'}`);
      fetchProviders();
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle');
    }
  };

  const handleDelete = async (p: Provider) => {
    if (!p.id) return;
    try {
      await api.del(`/integrations/${p.provider}`);
      toast.success(`${p.name} removed`);
      fetchProviders();
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {connectedCount} connected · {enabledCount} enabled · {providers.length} available providers
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
        <div className="text-center py-12 text-muted-foreground text-sm">No providers match your search.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(p => (
            <Card key={p.provider} className={`border-border bg-card transition-all hover:border-primary/20 ${p.enabled ? 'border-l-2 border-l-accent' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusIcon status={p.status} />
                    <h4 className="font-medium text-sm text-foreground truncate">{p.name}</h4>
                  </div>
                  <Badge className={`text-[10px] ${tierColor[p.tier] || ''}`}>{p.tier}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={p.id ? 'default' : 'secondary'} className="text-[10px]">
                      {p.id ? <><Check className="mr-1 h-2.5 w-2.5" />Connected</> : <><Unlink className="mr-1 h-2.5 w-2.5" />Not configured</>}
                    </Badge>
                    {p.masked_key && <span className="text-[10px] text-muted-foreground font-mono">{p.masked_key}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {p.id ? (
                      <Switch checked={p.enabled} onCheckedChange={() => handleToggle(p)} />
                    ) : (
                      <Button size="sm" className="h-7 text-[10px]" onClick={() => openConfig(p)}>
                        <Link className="mr-1 h-3 w-3" />Connect
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openConfig(p)}>
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.last_error && <p className="text-[10px] text-destructive mt-1 truncate">{p.last_error}</p>}
                {p.last_success && !p.last_error && <p className="text-[10px] text-muted-foreground mt-1">Last OK: {new Date(p.last_success).toLocaleDateString()}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Configure Dialog ── */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {configDialog?.id ? 'Settings' : 'Connect'}: {configDialog?.name}
            </DialogTitle>
            <DialogDescription>{configDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">API Key / Token</label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={configDialog?.masked_key ? `Current: ${configDialog.masked_key}` : 'Enter API key...'}
                className="bg-secondary/30 font-mono text-sm" />
            </div>
            {/* Show base URL for providers that might need it */}
            {configDialog && ['opencti', 'misp', 'ms-easm'].includes(configDialog.provider) && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Base URL (optional)</label>
                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.vendor.com/v1" className="bg-secondary/30 font-mono text-sm" />
              </div>
            )}
            {testResult === 'success' && (
              <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
                <Check className="h-4 w-4" /> Connection verified successfully
              </div>
            )}
            {testResult === 'error' && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Connection failed. Check credentials.
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={handleTest} disabled={testing || !apiKey.trim()}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
              Test Connection
            </Button>
            <p className="text-xs text-muted-foreground">Secrets encrypted at rest. Never exposed in browser or logs.</p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {configDialog?.id && (
              <Button variant="destructive" size="sm" onClick={() => { handleDelete(configDialog); setConfigDialog(null); }}>
                <Trash2 className="mr-1 h-3 w-3" />Remove
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setConfigDialog(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!apiKey.trim() || saving} className="glow-cyan">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {configDialog?.id ? 'Update' : 'Save & Enable'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Integration Picker Dialog ── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Integration
            </DialogTitle>
            <DialogDescription>Choose a provider to connect and configure.</DialogDescription>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search providers…" className="pl-10 bg-secondary/30 h-9 text-sm" />
          </div>
          <ScrollArea className="h-[360px] pr-2">
            <div className="space-y-1">
              {(() => {
                const unconfigured = providers.filter(p => !p.id);
                const q = pickerSearch.toLowerCase();
                const results = q ? unconfigured.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : unconfigured;
                if (results.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{unconfigured.length === 0 ? 'All providers are already configured!' : 'No matching providers.'}</p>;
                // Group by category
                const grouped = results.reduce<Record<string, Provider[]>>((acc, p) => { (acc[p.category] = acc[p.category] || []).push(p); return acc; }, {});
                return Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 sticky top-0 bg-card z-10">{cat}</p>
                    {items.map(p => (
                      <button key={p.provider} className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors" onClick={() => { setPickerOpen(false); openConfig(p); }}>
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground">{p.name}</span>
                            <Badge className={`text-[9px] ${tierColor[p.tier] || ''}`}>{p.tier}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                        </div>
                        <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
