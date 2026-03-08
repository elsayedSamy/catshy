import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Webhook, Server, History, Plus, TestTube, Loader2, Trash2, Settings, CheckCircle2, AlertCircle, ArrowRightLeft, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const EVENT_TYPES = ['new_intel', 'new_alert', 'new_leak', 'vuln_kev', 'report_generated', 'source_failure'];

interface WebhookItem {
  id: string; name: string; url: string; auth_type: string; masked_secret: string | null;
  custom_headers: Record<string, string>; event_types: string[]; enabled: boolean;
  last_triggered_at: string | null; last_status_code: number | null; last_error: string | null;
  consecutive_failures: number; created_at: string;
}

interface SyslogItem {
  id: string; name: string; host: string; port: number; protocol: string; format: string;
  event_types: string[]; enabled: boolean; last_sent_at: string | null; last_error: string | null; created_at: string;
}

interface ExportJobItem {
  id: string; job_type: string; target: string; event_type: string; status: string;
  status_code: number | null; error_message: string | null; retry_count: number;
  payload_summary: string | null; created_at: string; completed_at: string | null;
}

export default function Outputs() {
  const [tab, setTab] = useState('webhooks');
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [syslogs, setSyslogs] = useState<SyslogItem[]>([]);
  const [jobs, setJobs] = useState<ExportJobItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Webhook dialog
  const [whDialog, setWhDialog] = useState(false);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whAuth, setWhAuth] = useState('none');
  const [whSecret, setWhSecret] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Syslog dialog
  const [slDialog, setSlDialog] = useState(false);
  const [slName, setSlName] = useState('');
  const [slHost, setSlHost] = useState('');
  const [slPort, setSlPort] = useState('514');
  const [slProto, setSlProto] = useState('udp');
  const [slFmt, setSlFmt] = useState('cef');
  const [slEvents, setSlEvents] = useState<string[]>([]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [wh, sl, jb] = await Promise.all([
        api.get<WebhookItem[]>('/outputs/webhooks'),
        api.get<SyslogItem[]>('/outputs/syslog'),
        api.get<{ items: ExportJobItem[] }>('/outputs/jobs?limit=50'),
      ]);
      setWebhooks(wh);
      setSyslogs(sl);
      setJobs(jb.items);
    } catch {
      // Dev mode fallback
      setWebhooks([]);
      setSyslogs([]);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreateWebhook = async () => {
    if (!whName.trim() || !whUrl.trim()) return;
    setSaving(true);
    try {
      await api.post('/outputs/webhooks', {
        name: whName, url: whUrl, auth_type: whAuth,
        secret: whSecret || undefined, event_types: whEvents,
      });
      toast.success('Webhook created');
      setWhDialog(false);
      resetWhForm();
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const resetWhForm = () => { setWhName(''); setWhUrl(''); setWhAuth('none'); setWhSecret(''); setWhEvents([]); };

  const handleTestWebhook = async (id: string) => {
    setTesting(id);
    try {
      const r = await api.post<{ success: boolean; error?: string }>(`/outputs/webhooks/${id}/test`);
      r.success ? toast.success('Test event delivered') : toast.error(r.error || 'Delivery failed');
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(null); }
  };

  const handleDeleteWebhook = async (id: string) => {
    try { await api.del(`/outputs/webhooks/${id}`); toast.success('Webhook deleted'); fetchAll(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleToggleWebhook = async (wh: WebhookItem) => {
    try {
      await api.put(`/outputs/webhooks/${wh.id}`, { enabled: !wh.enabled });
      toast.success(`${wh.name} ${wh.enabled ? 'disabled' : 'enabled'}`);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateSyslog = async () => {
    if (!slName.trim() || !slHost.trim()) return;
    setSaving(true);
    try {
      await api.post('/outputs/syslog', {
        name: slName, host: slHost, port: parseInt(slPort), protocol: slProto,
        format: slFmt, event_types: slEvents,
      });
      toast.success('Syslog output created');
      setSlDialog(false);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteSyslog = async (id: string) => {
    try { await api.del(`/outputs/syslog/${id}`); toast.success('Syslog deleted'); fetchAll(); }
    catch (e: any) { toast.error(e.message); }
  };

  const toggleEvent = (list: string[], setList: (v: string[]) => void, ev: string) => {
    setList(list.includes(ev) ? list.filter(e => e !== ev) : [...list, ev]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outputs & Connectors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} • {syslogs.length} syslog • {jobs.length} recent jobs
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="webhooks" className="gap-1.5"><Webhook className="h-3.5 w-3.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="syslog" className="gap-1.5"><Server className="h-3.5 w-3.5" />Syslog / CEF</TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5"><History className="h-3.5 w-3.5" />Export Jobs</TabsTrigger>
        </TabsList>

        {/* ── Webhooks Tab ── */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="glow-cyan" onClick={() => { resetWhForm(); setWhDialog(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Webhook
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : webhooks.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="py-12 text-center">
              <Webhook className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No webhooks configured. Add one to forward events to your SIEM/SOAR.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {webhooks.map(wh => (
                <Card key={wh.id} className={`border-border bg-card ${wh.enabled ? 'border-l-2 border-l-primary' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {wh.last_error ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          <h4 className="font-medium text-sm text-foreground">{wh.name}</h4>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{wh.url}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {wh.event_types.slice(0, 2).map(et => (
                          <Badge key={et} variant="secondary" className="text-[10px] capitalize">{et.replace(/_/g, ' ')}</Badge>
                        ))}
                        {wh.event_types.length > 2 && <Badge variant="outline" className="text-[10px]">+{wh.event_types.length - 2}</Badge>}
                        <Badge variant={wh.auth_type === 'none' ? 'outline' : 'default'} className="text-[10px] uppercase">{wh.auth_type}</Badge>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleTestWebhook(wh.id)} disabled={testing === wh.id}>
                          {testing === wh.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteWebhook(wh.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Switch checked={wh.enabled} onCheckedChange={() => handleToggleWebhook(wh)} />
                      </div>
                    </div>
                    {wh.last_error && <p className="text-[10px] text-destructive mt-1">{wh.last_error} ({wh.consecutive_failures} failures)</p>}
                    {wh.last_triggered_at && !wh.last_error && <p className="text-[10px] text-muted-foreground mt-1">Last OK: {new Date(wh.last_triggered_at).toLocaleString()} • HTTP {wh.last_status_code}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Syslog Tab ── */}
        <TabsContent value="syslog" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="glow-cyan" onClick={() => setSlDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />Add Syslog
            </Button>
          </div>

          {syslogs.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="py-12 text-center">
              <Server className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No syslog outputs. Forward events in CEF or RFC 5424 format.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {syslogs.map(s => (
                <Card key={s.id} className="border-border bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Server className="h-4 w-4 text-primary" />
                      <div>
                        <h4 className="font-medium text-sm text-foreground">{s.name}</h4>
                        <p className="text-xs text-muted-foreground font-mono">{s.host}:{s.port} ({s.protocol.toUpperCase()}) • {s.format.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.event_types.slice(0, 2).map(et => (
                        <Badge key={et} variant="secondary" className="text-[10px] capitalize">{et.replace(/_/g, ' ')}</Badge>
                      ))}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSyslog(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Switch checked={s.enabled} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Export Jobs Tab ── */}
        <TabsContent value="jobs" className="space-y-4">
          {jobs.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="py-12 text-center">
              <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No export jobs yet. Jobs appear when webhooks fire, reports generate, or STIX exports run.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {jobs.map(j => (
                <Card key={j.id} className="border-border bg-card">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge variant={j.status === 'success' ? 'default' : j.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] capitalize shrink-0">
                        {j.status}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{j.event_type || j.job_type}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{j.target}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] uppercase">{j.job_type}</Badge>
                      {j.status_code && <span className="text-[10px] text-muted-foreground">{j.status_code}</span>}
                      <span className="text-[10px] text-muted-foreground">{new Date(j.created_at).toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Webhook Dialog ── */}
      <Dialog open={whDialog} onOpenChange={setWhDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" />New Webhook</DialogTitle>
            <DialogDescription>Forward events to your SIEM, SOAR, or any REST endpoint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Splunk Forwarder" className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Endpoint URL</label>
              <Input value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://your-siem.com/api/events" className="bg-secondary/30 font-mono text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Authentication</label>
              <Select value={whAuth} onValueChange={setWhAuth}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="hmac">HMAC Signature</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                </SelectContent>
              </Select>
              {whAuth !== 'none' && (
                <Input type="password" value={whSecret} onChange={e => setWhSecret(e.target.value)}
                  placeholder={whAuth === 'basic' ? 'user:password' : 'Secret / Token'}
                  className="bg-secondary/30 font-mono text-sm mt-2" />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Event Types</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map(et => (
                  <Badge key={et}
                    variant={whEvents.includes(et) ? 'default' : 'outline'}
                    className="text-xs cursor-pointer capitalize"
                    onClick={() => toggleEvent(whEvents, setWhEvents, et)}>
                    {et.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave empty to receive all events.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook} disabled={!whName.trim() || !whUrl.trim() || saving} className="glow-cyan">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Syslog Dialog ── */}
      <Dialog open={slDialog} onOpenChange={setSlDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" />New Syslog Output</DialogTitle>
            <DialogDescription>Forward events in CEF or RFC 5424 to your SIEM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Name</label>
              <Input value={slName} onChange={e => setSlName(e.target.value)} placeholder="e.g. QRadar Syslog" className="bg-secondary/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Host</label>
                <Input value={slHost} onChange={e => setSlHost(e.target.value)} placeholder="syslog.internal" className="bg-secondary/30 font-mono text-sm" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Port</label>
                <Input value={slPort} onChange={e => setSlPort(e.target.value)} type="number" className="bg-secondary/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Protocol</label>
                <Select value={slProto} onValueChange={setSlProto}>
                  <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="tls">TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Format</label>
                <Select value={slFmt} onValueChange={setSlFmt}>
                  <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cef">CEF</SelectItem>
                    <SelectItem value="rfc5424">RFC 5424</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Event Types</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map(et => (
                  <Badge key={et}
                    variant={slEvents.includes(et) ? 'default' : 'outline'}
                    className="text-xs cursor-pointer capitalize"
                    onClick={() => toggleEvent(slEvents, setSlEvents, et)}>
                    {et.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSyslog} disabled={!slName.trim() || !slHost.trim() || saving} className="glow-cyan">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
