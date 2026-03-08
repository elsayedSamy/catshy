import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, Settings, TestTube, Loader2, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface ProviderInfo {
  name?: string;
  description?: string;
  category?: string;
}

interface Integration {
  id: string | null;
  provider: string;
  enabled: boolean;
  status: string;
  masked_key: string | null;
  last_success: string | null;
  last_error: string | null;
  last_checked: string | null;
  config: Record<string, any>;
  provider_info: ProviderInfo;
}

// Static catalog for providers not yet in the backend
const EXTRA_CATALOG = [
  { provider: 'misp', info: { name: 'MISP', description: 'Malware Information Sharing Platform', category: 'Threat Intel' } },
  { provider: 'censys', info: { name: 'Censys', description: 'Internet asset discovery', category: 'Threat Intel' } },
  { provider: 'urlscan', info: { name: 'URLscan.io', description: 'URL scanning & analysis', category: 'Threat Intel' } },
  { provider: 'hibp', info: { name: 'Have I Been Pwned', description: 'Breach notification', category: 'Breach / Leak' } },
  { provider: 'slack', info: { name: 'Slack', description: 'Team messaging notifications', category: 'Notification' } },
  { provider: 'msteams', info: { name: 'Microsoft Teams', description: 'Teams channel notifications', category: 'Notification' } },
  { provider: 'jira', info: { name: 'Jira', description: 'Issue tracking & case management', category: 'Ticketing / SIEM' } },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [configDialog, setConfigDialog] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const data = await api.get<Integration[]>('/integrations/');
      const backendProviders = new Set(data.map(d => d.provider));
      const extras: Integration[] = EXTRA_CATALOG
        .filter(e => !backendProviders.has(e.provider))
        .map(e => ({
          id: null, provider: e.provider, enabled: false, status: 'not_configured',
          masked_key: null, last_success: null, last_error: null, last_checked: null,
          config: {}, provider_info: e.info,
        }));
      setIntegrations([...data, ...extras]);
    } catch {
      const static_: Integration[] = [
        ...EXTRA_CATALOG.map(e => ({
          id: null, provider: e.provider, enabled: false, status: 'not_configured',
          masked_key: null, last_success: null, last_error: null, last_checked: null,
          config: {}, provider_info: e.info,
        })),
        { id: null, provider: 'virustotal', enabled: false, status: 'not_configured', masked_key: null, last_success: null, last_error: null, last_checked: null, config: {}, provider_info: { name: 'VirusTotal', description: 'File/URL/IP reputation', category: 'Threat Intel' } },
        { id: null, provider: 'shodan', enabled: false, status: 'not_configured', masked_key: null, last_success: null, last_error: null, last_checked: null, config: {}, provider_info: { name: 'Shodan', description: 'Internet device search', category: 'Threat Intel' } },
        { id: null, provider: 'abuseipdb', enabled: false, status: 'not_configured', masked_key: null, last_success: null, last_error: null, last_checked: null, config: {}, provider_info: { name: 'AbuseIPDB', description: 'IP abuse reports', category: 'Threat Intel' } },
        { id: null, provider: 'otx', enabled: false, status: 'not_configured', masked_key: null, last_success: null, last_error: null, last_checked: null, config: {}, provider_info: { name: 'OTX AlienVault', description: 'Open Threat Exchange', category: 'Threat Intel' } },
      ];
      setIntegrations(static_);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const categories = useMemo(() => {
    const cats = new Set(integrations.map(i => i.provider_info?.category || 'Other'));
    return [...cats];
  }, [integrations]);

  const filtered = useMemo(() => {
    if (!searchQuery) return integrations;
    const q = searchQuery.toLowerCase();
    return integrations.filter(i =>
      (i.provider_info?.name || i.provider).toLowerCase().includes(q) ||
      (i.provider_info?.description || '').toLowerCase().includes(q)
    );
  }, [integrations, searchQuery]);

  const handleConfigure = async () => {
    if (!configDialog || !apiKey.trim()) return;
    setSaving(true);
    try {
      if (configDialog.id) {
        await api.put(`/integrations/${configDialog.provider}`, { api_key: apiKey, enabled: true });
      } else {
        await api.post('/integrations/', { provider: configDialog.provider, api_key: apiKey, enabled: true });
      }
      toast.success(`${configDialog.provider_info?.name || configDialog.provider} configured`);
      setConfigDialog(null);
      setApiKey('');
      fetchIntegrations();
    } catch (e: any) {
      toast.error(e.message || 'Failed to configure');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!configDialog) return;
    setTesting(true);
    try {
      const result = await api.post<{ success: boolean; message: string }>(`/integrations/${configDialog.provider}/test`);
      result.success ? toast.success(result.message) : toast.error(result.message);
      fetchIntegrations();
    } catch (e: any) {
      toast.error(e.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleToggle = async (integ: Integration) => {
    if (!integ.id) {
      setConfigDialog(integ);
      setApiKey('');
      return;
    }
    try {
      await api.put(`/integrations/${integ.provider}`, { enabled: !integ.enabled });
      toast.success(`${integ.provider_info?.name || integ.provider} ${integ.enabled ? 'disabled' : 'enabled'}`);
      fetchIntegrations();
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle');
    }
  };

  const handleDelete = async (integ: Integration) => {
    if (!integ.id) return;
    try {
      await api.del(`/integrations/${integ.provider}`);
      toast.success(`${integ.provider_info?.name || integ.provider} removed`);
      fetchIntegrations();
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove');
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case 'error': return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            API-key based enrichment & notification providers • {integrations.filter(i => i.enabled).length} of {integrations.length} enabled
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search integrations…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        categories.map(cat => {
          const catItems = filtered.filter(i => (i.provider_info?.category || 'Other') === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{cat}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catItems.map(integ => (
                  <Card key={integ.provider} className={`border-border bg-card transition-all hover:border-primary/20 ${integ.enabled ? 'border-l-2 border-l-success' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <StatusIcon status={integ.status} />
                          <h4 className="font-medium text-sm text-foreground">{integ.provider_info?.name || integ.provider}</h4>
                        </div>
                        <Switch checked={integ.enabled} onCheckedChange={() => handleToggle(integ)} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{integ.provider_info?.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={integ.status === 'active' ? 'default' : integ.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
                            {integ.status.replace('_', ' ')}
                          </Badge>
                          {integ.masked_key && (
                            <span className="text-[10px] text-muted-foreground font-mono">{integ.masked_key}</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setConfigDialog(integ); setApiKey(''); }}>
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {integ.last_error && (
                        <p className="text-[10px] text-destructive mt-1 truncate">{integ.last_error}</p>
                      )}
                      {integ.last_success && (
                        <p className="text-[10px] text-muted-foreground mt-1">Last OK: {new Date(integ.last_success).toLocaleDateString()}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Configure Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Configure {configDialog?.provider_info?.name || configDialog?.provider}</DialogTitle>
            <DialogDescription>{configDialog?.provider_info?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">API Key / Token</label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={configDialog?.masked_key ? `Current: ${configDialog.masked_key}` : 'Enter API key...'}
                className="bg-secondary/30 font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Encrypted at rest. Never exposed in logs.</p>
            </div>
            {configDialog?.id && (
              <Button variant="outline" className="w-full" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {configDialog?.id && (
              <Button variant="destructive" size="sm" onClick={() => { handleDelete(configDialog); setConfigDialog(null); }}>
                Remove
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setConfigDialog(null)}>Cancel</Button>
              <Button onClick={handleConfigure} disabled={!apiKey.trim() || saving} className="glow-cyan">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {configDialog?.id ? 'Update Key' : 'Save & Enable'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
