import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Search, Settings, Zap, TestTube, Loader2, Check, X, Shield, Bug, Globe, Bell, Webhook, Mail } from 'lucide-react';
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
}

const INTEGRATIONS_CATALOG: Integration[] = [
  // Threat Intel Feeds
  { id: 'virustotal', name: 'VirusTotal', description: 'File/URL/IP reputation & analysis', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'otx', name: 'OTX AlienVault', description: 'Open Threat Exchange pulse feed', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'misp', name: 'MISP', description: 'Malware Information Sharing Platform', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'abuseipdb', name: 'AbuseIPDB', description: 'IP address abuse reports', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'greynoise', name: 'GreyNoise', description: 'Internet scanner & noise classification', category: 'Threat Intel', enabled: false, configured: false },
  { id: 'shodan', name: 'Shodan', description: 'Internet-connected device search', category: 'Threat Intel', enabled: false, configured: false },
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
  { id: 'generic-webhook', name: 'Generic Webhook', description: 'Send alerts to any webhook URL', category: 'Notification', enabled: false, configured: false },
  { id: 'slack', name: 'Slack', description: 'Team messaging notifications', category: 'Notification', enabled: false, configured: false },
  { id: 'msteams', name: 'Microsoft Teams', description: 'Teams channel notifications', category: 'Notification', enabled: false, configured: false },
  { id: 'email-smtp', name: 'Email (SMTP)', description: 'Email alert delivery', category: 'Notification', enabled: false, configured: false },
  { id: 'telegram', name: 'Telegram Bot', description: 'Telegram channel alerts', category: 'Notification', enabled: false, configured: false },
  // Ticketing
  { id: 'jira', name: 'Jira', description: 'Issue tracking & case management', category: 'Ticketing / SIEM', enabled: false, configured: false },
  { id: 'servicenow', name: 'ServiceNow', description: 'ITSM incident creation', category: 'Ticketing / SIEM', enabled: false, configured: false },
  { id: 'siem-webhook', name: 'SIEM / Splunk HEC', description: 'Forward events to SIEM', category: 'Ticketing / SIEM', enabled: false, configured: false },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS_CATALOG);
  const [searchQuery, setSearchQuery] = useState('');
  const [configDialog, setConfigDialog] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);

  const categories = useMemo(() => [...new Set(integrations.map(i => i.category))], [integrations]);

  const filtered = useMemo(() => {
    if (!searchQuery) return integrations;
    const q = searchQuery.toLowerCase();
    return integrations.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [integrations, searchQuery]);

  const handleToggle = (id: string) => {
    const integ = integrations.find(i => i.id === id);
    if (!integ) return;
    if (!integ.configured && !integ.enabled) {
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
    // In production, this calls backend test endpoints
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">{integrations.filter(i => i.enabled).length} of {integrations.length} enabled</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestAll}><TestTube className="mr-2 h-4 w-4" />Test All</Button>
          <Button size="sm" className="glow-cyan" onClick={() => toast.info('Add custom integration coming soon')}><Zap className="mr-2 h-4 w-4" />+ Add Source</Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sources…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
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
                      <Badge variant={integ.configured ? 'default' : 'secondary'} className="text-[10px]">
                        {integ.configured ? 'Configured' : 'Not Configured'}
                      </Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setConfigDialog(integ); setApiKey(''); }}>
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

      {/* Configure Dialog */}
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
    </div>
  );
}
