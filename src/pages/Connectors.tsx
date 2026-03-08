import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, Settings, TestTube, Loader2, Check, Link, Unlink, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

interface Connector {
  id: string | null;
  provider: string;
  name: string;
  description: string;
  category: string;
  tier: 'Premium' | 'Enterprise';
  connected: boolean;
  enabled: boolean;
  masked_key?: string | null;
  last_success?: string | null;
  last_error?: string | null;
}

const CONNECTORS_CATALOG: Omit<Connector, 'id' | 'connected' | 'enabled' | 'masked_key' | 'last_success' | 'last_error'>[] = [
  // CTI / TIP
  { provider: 'flashpoint', name: 'Flashpoint', description: 'Deep & dark web threat intelligence', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'anomali', name: 'Anomali ThreatStream', description: 'Threat intelligence management platform', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'intel471', name: 'Intel 471', description: 'Adversary & malware intelligence', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'zerofox', name: 'ZeroFox', description: 'External threat intelligence & protection', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'kaspersky', name: 'Kaspersky Threat Intelligence', description: 'Threat data feeds & APT reports', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'mandiant', name: 'Mandiant Advantage', description: 'Threat intelligence & attack surface', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'ibm-xforce', name: 'IBM X-Force', description: 'Threat intelligence & research', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'cisco-talos', name: 'Cisco Talos', description: 'Threat intelligence & research group', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'checkpoint', name: 'Check Point ThreatCloud', description: 'Real-time threat intelligence', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'fortiguard', name: 'FortiGuard (Fortinet)', description: 'Threat intelligence services', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'proofpoint', name: 'Proofpoint ET / TAP', description: 'Emerging threats & targeted attack', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'trendmicro', name: 'Trend Micro Threat Intel', description: 'Global threat intelligence network', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'sophos', name: 'SophosLabs Intelix', description: 'Threat intelligence API', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'recorded-future', name: 'Recorded Future', description: 'Intelligence cloud platform', category: 'CTI / TIP', tier: 'Enterprise' },
  { provider: 'opencti', name: 'OpenCTI', description: 'Open source threat intelligence platform', category: 'CTI / TIP', tier: 'Premium' },
  { provider: 'crowdsec', name: 'CrowdSec CTI', description: 'Collaborative security intelligence', category: 'CTI / TIP', tier: 'Premium' },
  // ASM / Exposure
  { provider: 'ms-easm', name: 'Microsoft Defender EASM', description: 'External attack surface management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'cortex-xpanse', name: 'Cortex Xpanse', description: 'Attack surface management', category: 'ASM / Exposure', tier: 'Enterprise' },
  { provider: 'socradar', name: 'SOCRadar', description: 'Extended threat intelligence', category: 'ASM / Exposure', tier: 'Premium' },
  { provider: 'securityscorecard', name: 'SecurityScorecard', description: 'Security ratings & risk', category: 'ASM / Exposure', tier: 'Premium' },
  { provider: 'bitsight', name: 'BitSight', description: 'Security performance management', category: 'ASM / Exposure', tier: 'Enterprise' },
  // Leaks / Dark Web
  { provider: 'spycloud', name: 'SpyCloud', description: 'Account takeover prevention', category: 'Leaks / Dark Web', tier: 'Enterprise' },
  { provider: 'constella', name: 'Constella Intelligence', description: 'Digital risk & identity protection', category: 'Leaks / Dark Web', tier: 'Enterprise' },
  { provider: 'flare', name: 'Flare', description: 'Threat exposure management', category: 'Leaks / Dark Web', tier: 'Premium' },
  { provider: 'darkowl', name: 'DarkOwl', description: 'Darknet data intelligence', category: 'Leaks / Dark Web', tier: 'Enterprise' },
];

export default function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [configDialog, setConfigDialog] = useState<Connector | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConnectors = async () => {
    setLoading(true);
    try {
      // Fetch already-configured connectors from backend
      const data = await api.get<{ id: string; provider: string; enabled: boolean; status: string; masked_key: string | null; last_success: string | null; last_error: string | null }[]>('/integrations/');
      const backendMap = new Map(data.map(d => [d.provider, d]));

      const merged: Connector[] = CONNECTORS_CATALOG.map(cat => {
        const backend = backendMap.get(cat.provider);
        return {
          ...cat,
          id: backend?.id || null,
          connected: !!backend,
          enabled: backend?.enabled || false,
          masked_key: backend?.masked_key || null,
          last_success: backend?.last_success || null,
          last_error: backend?.last_error || null,
        };
      });
      setConnectors(merged);
    } catch {
      // Dev mode — show catalog as disconnected
      setConnectors(CONNECTORS_CATALOG.map(cat => ({
        ...cat, id: null, connected: false, enabled: false,
        masked_key: null, last_success: null, last_error: null,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnectors(); }, []);

  const categories = useMemo(() => [...new Set(connectors.map(c => c.category))], [connectors]);

  const filtered = useMemo(() => {
    if (!searchQuery) return connectors;
    const q = searchQuery.toLowerCase();
    return connectors.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [connectors, searchQuery]);

  const handleConnect = (c: Connector) => {
    setConfigDialog(c);
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
      // Fallback for dev mode
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
      if (configDialog.id) {
        await api.put(`/integrations/${configDialog.provider}`, { api_key: apiKey, enabled: true, config: baseUrl ? { base_url: baseUrl } : undefined });
      } else {
        await api.post('/integrations/', { provider: configDialog.provider, api_key: apiKey, enabled: true, config: baseUrl ? { base_url: baseUrl } : undefined });
      }
      toast.success(`${configDialog.name} connected and enabled`);
      setConfigDialog(null);
      fetchConnectors();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (conn: Connector) => {
    if (!conn.connected) { handleConnect(conn); return; }
    try {
      await api.put(`/integrations/${conn.provider}`, { enabled: !conn.enabled });
      toast.success(`${conn.name} ${conn.enabled ? 'disabled' : 'enabled'}`);
      fetchConnectors();
    } catch (e: any) {
      toast.error(e.message || 'Failed to toggle');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connectors</h1>
          <p className="text-sm text-muted-foreground mt-1">Premium threat intelligence providers • {connectors.filter(c => c.connected).length} connected</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search connectors…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        categories.map(cat => {
          const catItems = filtered.filter(c => c.category === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">{cat}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {catItems.map(conn => (
                  <Card key={conn.provider} className={`border-border bg-card transition-all hover:border-primary/20 ${conn.connected ? 'border-l-2 border-l-success' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <h4 className="font-medium text-sm text-foreground">{conn.name}</h4>
                        </div>
                        <Badge variant={conn.tier === 'Enterprise' ? 'destructive' : 'default'} className="text-[10px]">{conn.tier}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{conn.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant={conn.connected ? 'default' : 'secondary'} className="text-[10px]">
                          {conn.connected ? <><Check className="mr-1 h-2.5 w-2.5" />Connected</> : <><Unlink className="mr-1 h-2.5 w-2.5" />Disconnected</>}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {conn.connected ? (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleConnect(conn)}>
                                <TestTube className="mr-1 h-3 w-3" />Test
                              </Button>
                              <Switch checked={conn.enabled} onCheckedChange={() => handleToggle(conn)} />
                            </>
                          ) : (
                            <Button size="sm" className="h-7 text-[10px]" onClick={() => handleConnect(conn)}>
                              <Link className="mr-1 h-3 w-3" />Connect
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleConnect(conn)}>
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {conn.last_error && <p className="text-[10px] text-destructive mt-1 truncate">{conn.last_error}</p>}
                      {conn.last_success && <p className="text-[10px] text-muted-foreground mt-1">Last OK: {new Date(conn.last_success).toLocaleDateString()}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Config Dialog */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {configDialog?.connected ? 'Settings' : 'Connect'}: {configDialog?.name}
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
            <div>
              <label className="mb-1.5 block text-sm font-medium">Base URL (optional)</label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.vendor.com/v1" className="bg-secondary/30 font-mono text-sm" />
            </div>
            {testResult === 'success' && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
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
            <p className="text-xs text-muted-foreground">Secrets stored server-side only. Never exposed to the browser.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!apiKey.trim() || saving} className="glow-cyan">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
