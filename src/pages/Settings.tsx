import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  User, Key, Shield, Moon, Sun, Settings2, Bell, Clock, Zap, Loader2, Save, Volume2, VolumeX,
  Smartphone, Monitor, RefreshCw, LogOut, Webhook, Server, History, Plus, Send, Trash2,
  CheckCircle2, AlertCircle, ArrowRightLeft
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import AIConfigPanel from '@/components/ai/AIConfigPanel';
import { isSoundEnabled, setSoundEnabled, useSoundAlert } from '@/hooks/useSoundAlert';

// ── Workspace Settings types ──
interface WsSettings {
  retention_days: number;
  default_polling_interval_minutes: number;
  risk_weight_severity: number;
  risk_weight_asset_relevance: number;
  risk_weight_confidence: number;
  risk_weight_recency: number;
  notify_on_critical: boolean;
  notify_on_high: boolean;
  notify_on_medium: boolean;
  notify_on_low: boolean;
  notify_on_asset_match: boolean;
  timezone: string;
  auto_enrich: boolean;
}

const DEFAULT_SETTINGS: WsSettings = {
  retention_days: 30, default_polling_interval_minutes: 5,
  risk_weight_severity: 0.4, risk_weight_asset_relevance: 0.3,
  risk_weight_confidence: 0.2, risk_weight_recency: 0.1,
  notify_on_critical: true, notify_on_high: true,
  notify_on_medium: false, notify_on_low: false,
  notify_on_asset_match: true, timezone: 'UTC', auto_enrich: true,
};

// ── Outputs types ──
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

export default function Settings() {
  const { user, canAccess } = useAuth();
  const isAdmin = canAccess(['system_owner', 'team_admin']);
  const { isDark, toggleTheme } = useTheme();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const { playCritical } = useSoundAlert();
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [wsSettings, setWsSettings] = useState<WsSettings>(DEFAULT_SETTINGS);
  const [wsLoading, setWsLoading] = useState(true);
  const [wsSaving, setWsSaving] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.get<WsSettings>('/settings/workspace');
        setWsSettings(data);
      } catch { /* defaults */ } finally { setWsLoading(false); }
    };
    loadSettings();
  }, []);

  const handlePasswordChange = async () => {
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    try {
      await api.post('/auth/change-password', { current_password: currentPw, new_password: newPw });
      toast.success('Password changed successfully');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch {
      toast.error(api.getDevMode() ? 'Password change requires a running backend' : 'Failed to change password');
    }
  };

  const handleSaveWorkspaceSettings = async () => {
    setWsSaving(true);
    try {
      const data = await api.put<WsSettings>('/settings/workspace', wsSettings);
      setWsSettings(data);
      toast.success('Workspace settings saved');
    } catch (e: any) { toast.error(e.message || 'Failed to save settings'); }
    finally { setWsSaving(false); }
  };

  const updateSetting = <K extends keyof WsSettings>(key: K, value: WsSettings[K]) => {
    setWsSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground mt-1">Account, workspace, and output settings</p></div>

      <Tabs value={settingsTab} onValueChange={setSettingsTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="general" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />General</TabsTrigger>
          <TabsTrigger value="outputs" className="gap-1.5"><Webhook className="h-3.5 w-3.5" />Outputs</TabsTrigger>
        </TabsList>

        {/* ── General Tab ── */}
        <TabsContent value="general">
          <div className="space-y-6 max-w-3xl mt-4">
            {/* Profile */}
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4 text-primary" />Profile</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Email</span><span className="text-sm font-medium">{user?.email || 'Not connected'}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Name</span><span className="text-sm font-medium">{user?.name || 'N/A'}</span></div>
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Role</span><Badge variant="outline" className="capitalize">{user?.role || 'N/A'}</Badge></div>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Key className="h-4 w-4 text-primary" />Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="bg-secondary/30" />
                <Input type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} className="bg-secondary/30" />
                <Input type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="bg-secondary/30" />
                <Button size="sm" onClick={handlePasswordChange} disabled={!currentPw || !newPw || !confirmPw}>Update Password</Button>
              </CardContent>
            </Card>

            {/* Appearance & Sound */}
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base">{isDark ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}Appearance & Sound</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Switch between dark and light mode</p></div>
                  <Button variant="outline" size="sm" onClick={toggleTheme}>{isDark ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}{isDark ? 'Light' : 'Dark'} Mode</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Sound Alerts</p><p className="text-xs text-muted-foreground">Play sound on critical threat events</p></div>
                  <div className="flex items-center gap-2">
                    {soundOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                    <Switch checked={soundOn} onCheckedChange={(v) => { setSoundEnabled(v); setSoundOn(v); if (v) playCritical(); }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />Security</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Two-Factor Authentication</p><p className="text-xs text-muted-foreground">Add an extra layer of security</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">Not Configured</Badge>
                    <Button variant="outline" size="sm" onClick={() => toast.info('2FA setup requires backend configuration')}><Smartphone className="mr-1.5 h-3.5 w-3.5" />Setup 2FA</Button>
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div><p className="text-sm font-medium">Active Sessions</p><p className="text-xs text-muted-foreground">Manage your logged-in devices</p></div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => toast.info('Session revocation requires backend')}><LogOut className="mr-1.5 h-3.5 w-3.5" />Revoke All</Button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4 text-primary" />
                      <div><p className="text-xs font-medium text-foreground">Current Session</p><p className="text-[10px] text-muted-foreground">{navigator.userAgent.split('(')[0].trim()} • {new Date().toLocaleDateString()}</p></div>
                    </div>
                    <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px]">Active</Badge>
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Reset Onboarding Tour</p><p className="text-xs text-muted-foreground">Show the welcome tour again on next visit</p></div>
                    <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('catshy_onboarding_done'); toast.success('Tour will show on next page load'); }}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reset Tour</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Configuration (admin only) */}
            {isAdmin && <AIConfigPanel />}

            {/* Workspace Settings (admin only) */}
            {isAdmin && (
              <>
                <div className="border-t border-border pt-6">
                  <h2 className="text-lg font-semibold mb-1">Workspace Settings</h2>
                  <p className="text-sm text-muted-foreground">Configure workspace-wide settings. Only admins can edit.</p>
                </div>

                {wsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  <>
                    <Card className="border-border bg-card">
                      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" />Data Retention</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div><p className="text-sm font-medium">Retention Period</p><p className="text-xs text-muted-foreground">Intel items older than this are auto-deleted</p></div>
                          <div className="flex items-center gap-2"><Input type="number" min={1} max={365} value={wsSettings.retention_days} onChange={e => updateSetting('retention_days', parseInt(e.target.value) || 30)} className="w-20 bg-secondary/30 text-center" /><span className="text-sm text-muted-foreground">days</span></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div><p className="text-sm font-medium">Default Polling Interval</p><p className="text-xs text-muted-foreground">How often sources are polled for new data</p></div>
                          <div className="flex items-center gap-2"><Input type="number" min={1} max={1440} value={wsSettings.default_polling_interval_minutes} onChange={e => updateSetting('default_polling_interval_minutes', parseInt(e.target.value) || 5)} className="w-20 bg-secondary/30 text-center" /><span className="text-sm text-muted-foreground">min</span></div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />Risk Scoring Weights</CardTitle></CardHeader>
                      <CardContent className="space-y-5">
                        {([
                          { key: 'risk_weight_severity' as const, label: 'Severity' },
                          { key: 'risk_weight_asset_relevance' as const, label: 'Asset Relevance' },
                          { key: 'risk_weight_confidence' as const, label: 'Confidence' },
                          { key: 'risk_weight_recency' as const, label: 'Recency' },
                        ]).map(({ key, label }) => (
                          <div key={key} className="space-y-1.5">
                            <div className="flex items-center justify-between"><span className="text-sm">{label}</span><span className="text-sm font-mono text-muted-foreground">{(wsSettings[key] * 100).toFixed(0)}%</span></div>
                            <Slider value={[wsSettings[key] * 100]} min={0} max={100} step={5} onValueChange={([v]) => updateSetting(key, v / 100)} />
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          Total: {((wsSettings.risk_weight_severity + wsSettings.risk_weight_asset_relevance + wsSettings.risk_weight_confidence + wsSettings.risk_weight_recency) * 100).toFixed(0)}%
                          {Math.abs(wsSettings.risk_weight_severity + wsSettings.risk_weight_asset_relevance + wsSettings.risk_weight_confidence + wsSettings.risk_weight_recency - 1) > 0.01 && (
                            <span className="text-destructive ml-2">(should equal 100%)</span>
                          )}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" />Notification Preferences</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {([
                          { key: 'notify_on_critical' as const, label: 'Critical severity alerts', badge: 'Critical' },
                          { key: 'notify_on_high' as const, label: 'High severity alerts', badge: 'High' },
                          { key: 'notify_on_medium' as const, label: 'Medium severity alerts', badge: 'Medium' },
                          { key: 'notify_on_low' as const, label: 'Low severity alerts', badge: 'Low' },
                          { key: 'notify_on_asset_match' as const, label: 'Asset match notifications' },
                        ]).map(({ key, label, badge }) => (
                          <div key={key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><span className="text-sm">{label}</span>{badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}</div>
                            <Switch checked={wsSettings[key]} onCheckedChange={v => updateSetting(key, v)} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" />Enrichment & General</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div><p className="text-sm font-medium">Auto-Enrich</p><p className="text-xs text-muted-foreground">Automatically enrich ingested IOCs</p></div>
                          <Switch checked={wsSettings.auto_enrich} onCheckedChange={v => updateSetting('auto_enrich', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Timezone</p>
                          <Select value={wsSettings.timezone} onValueChange={v => updateSetting('timezone', v)}>
                            <SelectTrigger className="w-48 bg-secondary/30"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[
                                'UTC','Africa/Cairo','Africa/Johannesburg','Africa/Lagos','Africa/Nairobi','Africa/Casablanca',
                                'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto','America/Sao_Paulo','America/Mexico_City','America/Argentina/Buenos_Aires','America/Bogota',
                                'Asia/Dubai','Asia/Riyadh','Asia/Qatar','Asia/Kuwait','Asia/Bahrain','Asia/Muscat','Asia/Baghdad','Asia/Amman','Asia/Beirut','Asia/Jerusalem','Asia/Kolkata','Asia/Karachi','Asia/Dhaka','Asia/Bangkok','Asia/Singapore','Asia/Hong_Kong','Asia/Shanghai','Asia/Tokyo','Asia/Seoul','Asia/Jakarta','Asia/Kuala_Lumpur',
                                'Australia/Sydney','Australia/Melbourne','Australia/Perth',
                                'Europe/London','Europe/Berlin','Europe/Paris','Europe/Madrid','Europe/Rome','Europe/Amsterdam','Europe/Brussels','Europe/Zurich','Europe/Vienna','Europe/Warsaw','Europe/Moscow','Europe/Istanbul','Europe/Athens',
                                'Pacific/Auckland','Pacific/Honolulu',
                              ].map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button onClick={handleSaveWorkspaceSettings} disabled={wsSaving} className="glow-cyan">
                        {wsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Workspace Settings
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Outputs Tab ── */}
        <TabsContent value="outputs">
          <OutputsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Outputs Panel (moved from standalone Outputs page)
   ══════════════════════════════════════════════════════════ */
function OutputsPanel() {
  const [tab, setTab] = useState('webhooks');
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [syslogs, setSyslogs] = useState<SyslogItem[]>([]);
  const [jobs, setJobs] = useState<ExportJobItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [whDialog, setWhDialog] = useState(false);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whAuth, setWhAuth] = useState('none');
  const [whSecret, setWhSecret] = useState('');
  const [whEvents, setWhEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

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
      setWebhooks(wh); setSyslogs(sl); setJobs(jb.items);
    } catch {
      setWebhooks([]); setSyslogs([]); setJobs([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const resetWhForm = () => { setWhName(''); setWhUrl(''); setWhAuth('none'); setWhSecret(''); setWhEvents([]); };

  const handleCreateWebhook = async () => {
    if (!whName.trim() || !whUrl.trim()) return;
    setSaving(true);
    try {
      await api.post('/outputs/webhooks', { name: whName, url: whUrl, auth_type: whAuth, secret: whSecret || undefined, event_types: whEvents });
      toast.success('Webhook created'); setWhDialog(false); resetWhForm(); fetchAll();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleTestWebhook = async (id: string) => {
    setTesting(id);
    try {
      const r = await api.post<{ success: boolean; error?: string }>(`/outputs/webhooks/${id}/test`);
      r.success ? toast.success('Test event delivered') : toast.error(r.error || 'Delivery failed');
      fetchAll();
    } catch (e: any) { toast.error(e.message); } finally { setTesting(null); }
  };

  const handleDeleteWebhook = async (id: string) => {
    try { await api.del(`/outputs/webhooks/${id}`); toast.success('Webhook deleted'); fetchAll(); } catch (e: any) { toast.error(e.message); }
  };

  const handleToggleWebhook = async (wh: WebhookItem) => {
    try { await api.put(`/outputs/webhooks/${wh.id}`, { enabled: !wh.enabled }); toast.success(`${wh.name} ${wh.enabled ? 'disabled' : 'enabled'}`); fetchAll(); } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateSyslog = async () => {
    if (!slName.trim() || !slHost.trim()) return;
    setSaving(true);
    try {
      await api.post('/outputs/syslog', { name: slName, host: slHost, port: parseInt(slPort), protocol: slProto, format: slFmt, event_types: slEvents });
      toast.success('Syslog output created'); setSlDialog(false); fetchAll();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDeleteSyslog = async (id: string) => {
    try { await api.del(`/outputs/syslog/${id}`); toast.success('Syslog deleted'); fetchAll(); } catch (e: any) { toast.error(e.message); }
  };

  const toggleEvent = (list: string[], setList: (v: string[]) => void, ev: string) => {
    setList(list.includes(ev) ? list.filter(e => e !== ev) : [...list, ev]);
  };

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        {webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} • {syslogs.length} syslog • {jobs.length} recent jobs
      </p>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="webhooks" className="gap-1.5"><Webhook className="h-3.5 w-3.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="syslog" className="gap-1.5"><Server className="h-3.5 w-3.5" />Syslog / CEF</TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5"><History className="h-3.5 w-3.5" />Export Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-end"><Button size="sm" className="glow-cyan" onClick={() => { resetWhForm(); setWhDialog(true); }}><Plus className="mr-2 h-4 w-4" />Add Webhook</Button></div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : webhooks.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="py-12 text-center"><Webhook className="h-10 w-10 mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">No webhooks configured.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">{webhooks.map(wh => (
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
                      {wh.event_types.slice(0, 2).map(et => <Badge key={et} variant="secondary" className="text-[10px] capitalize">{et.replace(/_/g, ' ')}</Badge>)}
                      {wh.event_types.length > 2 && <Badge variant="outline" className="text-[10px]">+{wh.event_types.length - 2}</Badge>}
                      <Badge variant={wh.auth_type === 'none' ? 'outline' : 'default'} className="text-[10px] uppercase">{wh.auth_type}</Badge>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleTestWebhook(wh.id)} disabled={testing === wh.id}>
                        {testing === wh.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteWebhook(wh.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      <Switch checked={wh.enabled} onCheckedChange={() => handleToggleWebhook(wh)} />
                    </div>
                  </div>
                  {wh.last_error && <p className="text-[10px] text-destructive mt-1">{wh.last_error} ({wh.consecutive_failures} failures)</p>}
                  {wh.last_triggered_at && !wh.last_error && <p className="text-[10px] text-muted-foreground mt-1">Last OK: {new Date(wh.last_triggered_at).toLocaleString()} • HTTP {wh.last_status_code}</p>}
                </CardContent>
              </Card>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="syslog" className="space-y-4">
          <div className="flex justify-end"><Button size="sm" className="glow-cyan" onClick={() => setSlDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Syslog</Button></div>
          {syslogs.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="py-12 text-center"><Server className="h-10 w-10 mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">No syslog outputs.</p></CardContent></Card>
          ) : (
            <div className="space-y-3">{syslogs.map(s => (
              <Card key={s.id} className="border-border bg-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3"><Server className="h-4 w-4 text-primary" /><div><h4 className="font-medium text-sm text-foreground">{s.name}</h4><p className="text-xs text-muted-foreground font-mono">{s.host}:{s.port} ({s.protocol.toUpperCase()}) • {s.format.toUpperCase()}</p></div></div>
                  <div className="flex items-center gap-2">
                    {s.event_types.slice(0, 2).map(et => <Badge key={et} variant="secondary" className="text-[10px] capitalize">{et.replace(/_/g, ' ')}</Badge>)}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSyslog(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    <Switch checked={s.enabled} onCheckedChange={async () => {
                      try { await api.put(`/outputs/syslog/${s.id}`, { enabled: !s.enabled }); toast.success(`${s.name} ${s.enabled ? 'disabled' : 'enabled'}`); fetchAll(); } catch (e: any) { toast.error(e.message); }
                    }} />
                  </div>
                </CardContent>
              </Card>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {jobs.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="py-12 text-center"><History className="h-10 w-10 mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">No export jobs yet.</p></CardContent></Card>
          ) : (
            <div className="space-y-2">{jobs.map(j => (
              <Card key={j.id} className="border-border bg-card">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant={j.status === 'success' ? 'default' : j.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] capitalize shrink-0">{j.status}</Badge>
                    <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{j.event_type || j.job_type}</p><p className="text-[10px] text-muted-foreground truncate">{j.target}</p></div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] uppercase">{j.job_type}</Badge>
                    {j.status_code && <span className="text-[10px] text-muted-foreground">{j.status_code}</span>}
                    <span className="text-[10px] text-muted-foreground">{new Date(j.created_at).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Webhook Dialog */}
      <Dialog open={whDialog} onOpenChange={setWhDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Webhook className="h-5 w-5 text-primary" />New Webhook</DialogTitle>
            <DialogDescription>Forward events to your SIEM, SOAR, or any REST endpoint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div><label className="mb-1.5 block text-sm font-medium">Name</label><Input value={whName} onChange={e => setWhName(e.target.value)} placeholder="e.g. Splunk Forwarder" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Endpoint URL</label><Input value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://your-siem.com/api/events" className="bg-secondary/30 font-mono text-sm" /></div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Authentication</label>
              <Select value={whAuth} onValueChange={setWhAuth}><SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="bearer">Bearer Token</SelectItem><SelectItem value="hmac">HMAC Signature</SelectItem><SelectItem value="basic">Basic Auth</SelectItem></SelectContent></Select>
              {whAuth !== 'none' && <Input type="password" value={whSecret} onChange={e => setWhSecret(e.target.value)} placeholder={whAuth === 'basic' ? 'user:password' : 'Secret / Token'} className="bg-secondary/30 font-mono text-sm mt-2" />}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Event Types</label>
              <div className="flex flex-wrap gap-1.5">{EVENT_TYPES.map(et => <Badge key={et} variant={whEvents.includes(et) ? 'default' : 'outline'} className="text-xs cursor-pointer capitalize" onClick={() => toggleEvent(whEvents, setWhEvents, et)}>{et.replace(/_/g, ' ')}</Badge>)}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave empty to receive all events.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook} disabled={!whName.trim() || !whUrl.trim() || saving} className="glow-cyan">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save & Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Syslog Dialog */}
      <Dialog open={slDialog} onOpenChange={setSlDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" />New Syslog Output</DialogTitle>
            <DialogDescription>Forward events in CEF or RFC 5424 to your SIEM.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Name</label><Input value={slName} onChange={e => setSlName(e.target.value)} placeholder="e.g. QRadar Syslog" className="bg-secondary/30" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1.5 block text-sm font-medium">Host</label><Input value={slHost} onChange={e => setSlHost(e.target.value)} placeholder="syslog.internal" className="bg-secondary/30 font-mono text-sm" /></div>
              <div><label className="mb-1.5 block text-sm font-medium">Port</label><Input value={slPort} onChange={e => setSlPort(e.target.value)} type="number" className="bg-secondary/30" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1.5 block text-sm font-medium">Protocol</label><Select value={slProto} onValueChange={setSlProto}><SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="udp">UDP</SelectItem><SelectItem value="tcp">TCP</SelectItem><SelectItem value="tls">TLS</SelectItem></SelectContent></Select></div>
              <div><label className="mb-1.5 block text-sm font-medium">Format</label><Select value={slFmt} onValueChange={setSlFmt}><SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cef">CEF</SelectItem><SelectItem value="rfc5424">RFC 5424</SelectItem></SelectContent></Select></div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Event Types</label>
              <div className="flex flex-wrap gap-1.5">{EVENT_TYPES.map(et => <Badge key={et} variant={slEvents.includes(et) ? 'default' : 'outline'} className="text-xs cursor-pointer capitalize" onClick={() => toggleEvent(slEvents, setSlEvents, et)}>{et.replace(/_/g, ' ')}</Badge>)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSyslog} disabled={!slName.trim() || !slHost.trim() || saving} className="glow-cyan">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save & Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
