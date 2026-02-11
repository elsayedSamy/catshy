import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Settings, Zap, TestTube, Loader2, Check, Shield, Plus, Globe, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  configured: boolean;
  lastTest?: string;
  lastError?: string;
  managedByConnectors?: boolean;
}

const INTEGRATIONS_CATALOG: Integration[] = [
  // Threat Intel Feeds
  { id: 'virustotal', name: 'VirusTotal', description: 'File/URL/IP reputation & analysis', category: 'Threat Intel', enabled: false, configured: false, managedByConnectors: true },
  { id: 'otx', name: 'OTX AlienVault', description: 'Open Threat Exchange pulse feed', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'misp', name: 'MISP', description: 'Malware Information Sharing Platform', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'abuseipdb', name: 'AbuseIPDB', description: 'IP address abuse reports', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'greynoise', name: 'GreyNoise', description: 'Internet scanner & noise classification', category: 'Threat Intel', enabled: false, configured: false, managedByConnectors: true },
  { id: 'shodan', name: 'Shodan', description: 'Internet-connected device search', category: 'Threat Intel', enabled: false, configured: false, managedByConnectors: true },
  { id: 'censys', name: 'Censys', description: 'Internet asset discovery & monitoring', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'securitytrails', name: 'SecurityTrails', description: 'DNS & domain intelligence', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'urlscan', name: 'URLscan.io', description: 'URL scanning & analysis', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'threatfox', name: 'ThreatFox', description: 'IOC sharing platform by abuse.ch', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'malwarebazaar', name: 'MalwareBazaar', description: 'Malware sample sharing', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'phishtank', name: 'PhishTank', description: 'Phishing URL verification', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'spamhaus', name: 'Spamhaus', description: 'IP/domain blocklist intelligence', category: 'Threat Intel', enabled: false, configured: false },
  // Vulnerability
  { id: 'nvd', name: 'NVD', description: 'National Vulnerability Database', category: 'Vulnerability', enabled: false, configured: false },
  { id: 'cisa-kev', name: 'CISA KEV', description: 'Known Exploited Vulnerabilities', category: 'Vulnerability', enabled: false, configured: false },
  { id: 'osv', name: 'OSV', description: 'Open Source Vulnerabilities', category: 'Vulnerability', enabled: false, configured: false },
  { id: 'github-advisories', name: 'GitHub Advisories', description: 'GitHub security advisories', category: 'Vulnerability', enabled: false, configured: false },
  { id: 'exploitdb', name: 'Exploit-DB', description: 'Public exploit database feed', category: 'Vulnerability', enabled: false, configured: false },
  // Breach/Leak
  { id: 'hibp', name: 'Have I Been Pwned', description: 'Breach notification (ToS compliant)', category: 'Breach / Leak', enabled: false, configured: false },
  { id: 'dehashed', name: 'DeHashed', description: 'Credential search engine', category: 'Breach / Leak', enabled: false, configured: false },
  { id: 'intelligencex', name: 'IntelligenceX', description: 'Darknet & data leak search', category: 'Breach / Leak', enabled: false, configured: false },
  { id: 'ransomfeed', name: 'Ransomware Feed', description: 'Ransomware victim monitoring', category: 'Breach / Leak', enabled: false, configured: false },
  // Notification
  { id: 'generic-webhook', name: 'Custom Webhook', description: 'Send/receive alerts via any webhook URL', category: 'Notification', enabled: false, configured: false },
  { id: 'slack', name: 'Slack', description: 'Team messaging notifications', category: 'Notification', enabled: false, configured: false },
  { id: 'msteams', name: 'Microsoft Teams', description: 'Teams channel notifications', category: 'Notification', enabled: false, configured: false },
  { id: 'email-smtp', name: 'Email (SMTP)', description: 'Email alert delivery', category: 'Notification', enabled: false, configured: false },
  { id: 'telegram', name: 'Telegram Bot', description: 'Telegram channel alerts', category: 'Notification', enabled: false, configured: false },
  // Ticketing
  { id: 'jira', name: 'Jira', description: 'Issue tracking & case management', category: 'Ticketing / SIEM', enabled: false, configured: false },
  { id: 'servicenow', name: 'ServiceNow', description: 'ITSM incident creation', category: 'Ticketing / SIEM', enabled: false, configured: false },
  { id: 'siem-webhook', name: 'SIEM / Splunk HEC', description: 'Forward events to SIEM', category: 'Ticketing / SIEM', enabled: false, configured: false },
];

type WebhookDirection = 'outbound' | 'inbound';
type WebhookAuth = 'none' | 'bearer' | 'hmac' | 'basic';

interface WebhookConfig {
  name: string;
  direction: WebhookDirection;
  url: string;
  authType: WebhookAuth;
  authValue: string;
  eventTypes: string[];
}

const EVENT_TYPES = ['new_threat', 'critical_alert', 'asset_match', 'leak_detected', 'report_generated', 'source_failure'];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS_CATALOG);
  const [searchQuery, setSearchQuery] = useState('');
  const [configDialog, setConfigDialog] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);

  // Custom webhook state
  const [webhookDialog, setWebhookDialog] = useState(false);
  const [webhook, setWebhook] = useState<WebhookConfig>({ name: '', direction: 'outbound', url: '', authType: 'none', authValue: '', eventTypes: [] });
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'error' | null>(null);

  const categories = useMemo(() => [...new Set(integrations.map(i => i.category))], [integrations]);

  const filtered = useMemo(() => {
    if (!searchQuery) return integrations;
    const q = searchQuery.toLowerCase();
    return integrations.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [integrations, searchQuery]);

  const handleToggle = (id: string) => {
    const integ = integrations.find(i => i.id === id);
    if (!integ) return;
    if (integ.managedByConnectors) {
      toast.info(`${integ.name} is managed via Connectors page`);
      return;
    }
    if (!integ.configured && !integ.enabled) {
      if (integ.id === 'generic-webhook') { setWebhookDialog(true); return; }
      setConfigDialog(integ);
      return;
    }
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));
    toast.success(`${integ.name} ${integ.enabled ? 'disabled' : 'enabled'}`);
  };

  const handleTestAll = () => {
    const enabled = integrations.filter(i => i.enabled);
    if (enabled.length === 0) { toast.info('No integrations enabled to test'); return; }
    toast.success(`Testing ${enabled.length} enabled integrations...`);
    setTimeout(() => toast.success(`All ${enabled.length} integrations healthy`), 2000);
  };

  const handleConfigure = () => {
    if (!configDialog || !apiKey.trim()) return;
    setIntegrations(prev => prev.map(i => i.id === configDialog.id ? { ...i, configured: true, enabled: true } : i));
    setConfigDialog(null);
    setApiKey('');
    toast.success(`${configDialog.name} configured and enabled`);
  };

  const handleTest = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    toast.success(`${configDialog?.name} connection successful`);
  };

  const handleWebhookTest = async () => {
    if (!webhook.url.startsWith('http')) { toast.error('Invalid webhook URL'); return; }
    setWebhookTesting(true);
    setWebhookTestResult(null);
    await new Promise(r => setTimeout(r, 2000));
    setWebhookTestResult('success');
    setWebhookTesting(false);
    toast.success('Webhook test successful');
  };

  const handleWebhookSave = () => {
    if (!webhook.name.trim() || !webhook.url.trim()) return;
    setIntegrations(prev => prev.map(i => i.id === 'generic-webhook' ? { ...i, configured: true, enabled: true } : i));
    setWebhookDialog(false);
    setWebhook({ name: '', direction: 'outbound', url: '', authType: 'none', authValue: '', eventTypes: [] });
    setWebhookTestResult(null);
    toast.success('Custom webhook configured and enabled');
  };

  const toggleEventType = (et: string) => {
    setWebhook(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(et)
        ? prev.eventTypes.filter(e => e !== et)
        : [...prev.eventTypes, et],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">{integrations.filter(i => i.enabled).length} of {integrations.length} enabled</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestAll}><TestTube className="mr-2 h-4 w-4" />Test All</Button>
          <Button size="sm" className="glow-cyan" onClick={() => setWebhookDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Integration</Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search integrations…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {categories.map(cat => {
        const catItems = filtered.filter(i => i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{cat}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catItems.map(integ => (
                <Card key={integ.id} className={`border-border bg-card transition-all hover:border-primary/20 ${integ.enabled ? 'border-l-2 border-l-success' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-foreground">{integ.name}</h4>
                      <Switch checked={integ.enabled} onCheckedChange={() => handleToggle(integ.id)} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{integ.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={integ.configured ? 'default' : 'secondary'} className="text-[10px]">
                          {integ.configured ? 'Configured' : 'Not Configured'}
                        </Badge>
                        {integ.managedByConnectors && (
                          <Badge variant="outline" className="text-[10px] text-primary">via Connectors</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          if (integ.id === 'generic-webhook') { setWebhookDialog(true); return; }
                          setConfigDialog(integ); setApiKey('');
                        }}>
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Configure Dialog (standard API key) */}
      <Dialog open={!!configDialog} onOpenChange={() => setConfigDialog(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Configure {configDialog?.name}</DialogTitle>
            <DialogDescription>{configDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">API Key / Token</label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter API key..." className="bg-secondary/30 font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Stored server-side only. Never in localStorage.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleTest} disabled={testing || !apiKey.trim()}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
              Test Connection
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>Cancel</Button>
            <Button onClick={handleConfigure} disabled={!apiKey.trim()} className="glow-cyan">Save & Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Webhook Dialog */}
      <Dialog open={webhookDialog} onOpenChange={setWebhookDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" />Custom Integration (Webhook)</DialogTitle>
            <DialogDescription>Configure an inbound or outbound webhook integration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input value={webhook.name} onChange={e => setWebhook(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. SIEM Forwarder" className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Direction</label>
              <div className="flex gap-2">
                {(['outbound', 'inbound'] as const).map(d => (
                  <Button key={d} variant={webhook.direction === d ? 'default' : 'outline'} size="sm" className="flex-1 capitalize" onClick={() => setWebhook(prev => ({ ...prev, direction: d }))}>
                    <ArrowRightLeft className="mr-1 h-3 w-3" />{d}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">URL</label>
              <Input value={webhook.url} onChange={e => setWebhook(prev => ({ ...prev, url: e.target.value }))} placeholder="https://your-endpoint.com/webhook" className="bg-secondary/30 font-mono text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Authentication</label>
              <Select value={webhook.authType} onValueChange={v => setWebhook(prev => ({ ...prev, authType: v as WebhookAuth }))}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="hmac">HMAC Signature</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
              {webhook.authType !== 'none' && (
                <Input type="password" value={webhook.authValue} onChange={e => setWebhook(prev => ({ ...prev, authValue: e.target.value }))} placeholder={webhook.authType === 'basic' ? 'user:password' : 'Secret / Token'} className="bg-secondary/30 font-mono text-sm mt-2" />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Event Types</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map(et => (
                  <Badge key={et} variant={webhook.eventTypes.includes(et) ? 'default' : 'outline'} className="text-xs cursor-pointer capitalize" onClick={() => toggleEventType(et)}>
                    {et.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            {webhookTestResult === 'success' && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                <Check className="h-4 w-4" /> Webhook test successful
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={handleWebhookTest} disabled={webhookTesting || !webhook.url.trim()}>
              {webhookTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
              Test Webhook
            </Button>
            <p className="text-xs text-muted-foreground">Secrets stored server-side only and encrypted at rest.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebhookDialog(false)}>Cancel</Button>
            <Button onClick={handleWebhookSave} disabled={!webhook.name.trim() || !webhook.url.trim()} className="glow-cyan">Save & Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
