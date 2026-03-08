import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Key, Shield, Moon, Sun, Settings2, Bell, Clock, Zap, Loader2, Save, Volume2, VolumeX, Smartphone, Monitor, RefreshCw, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import AIConfigPanel from '@/components/ai/AIConfigPanel';
import { isSoundEnabled, setSoundEnabled, useSoundAlert } from '@/hooks/useSoundAlert';

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

export default function Settings() {
  const { user, canAccess } = useAuth();
  const isAdmin = canAccess(['system_owner', 'team_admin']);
  const { isDark, toggleTheme } = useTheme();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Workspace settings
  const [wsSettings, setWsSettings] = useState<WsSettings>(DEFAULT_SETTINGS);
  const [wsLoading, setWsLoading] = useState(true);
  const [wsSaving, setWsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await api.get<WsSettings>('/settings/workspace');
        setWsSettings(data);
      } catch {
        // Dev mode or no backend — use defaults
      } finally {
        setWsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // toggleTheme is from useTheme hook — no local state needed

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
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setWsSaving(false);
    }
  };

  const updateSetting = <K extends keyof WsSettings>(key: K, value: WsSettings[K]) => {
    setWsSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground mt-1">Account and workspace settings</p></div>

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
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Switch between dark and light mode</p>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {isDark ? <Sun className="mr-2 h-3.5 w-3.5" /> : <Moon className="mr-2 h-3.5 w-3.5" />}
              {isDark ? 'Light' : 'Dark'} Mode
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sound Alerts</p>
              <p className="text-xs text-muted-foreground">Play sound on critical threat events</p>
            </div>
            <div className="flex items-center gap-2">
              {isSoundEnabled() ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <Switch
                checked={isSoundEnabled()}
                onCheckedChange={(v) => { setSoundEnabled(v); if (v) { const { playCritical } = useSoundAlert(); playCritical(); } }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-border bg-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* 2FA Setup */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Not Configured</Badge>
              <Button variant="outline" size="sm" onClick={() => toast.info('2FA setup requires backend configuration')}>
                <Smartphone className="mr-1.5 h-3.5 w-3.5" />Setup 2FA
              </Button>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium">Active Sessions</p>
                <p className="text-xs text-muted-foreground">Manage your logged-in devices</p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => toast.info('Session revocation requires backend')}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" />Revoke All
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-medium text-foreground">Current Session</p>
                    <p className="text-[10px] text-muted-foreground">{navigator.userAgent.split('(')[0].trim()} • {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px]">Active</Badge>
              </div>
            </div>
          </div>

          {/* Onboarding Reset */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Reset Onboarding Tour</p>
                <p className="text-xs text-muted-foreground">Show the welcome tour again on next visit</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem('catshy_onboarding_done'); toast.success('Tour will show on next page load'); }}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Reset Tour
              </Button>
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
              {/* Data Retention */}
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-primary" />Data Retention</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Retention Period</p>
                      <p className="text-xs text-muted-foreground">Intel items older than this are auto-deleted</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} max={365} value={wsSettings.retention_days}
                        onChange={e => updateSetting('retention_days', parseInt(e.target.value) || 30)}
                        className="w-20 bg-secondary/30 text-center" />
                      <span className="text-sm text-muted-foreground">days</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Default Polling Interval</p>
                      <p className="text-xs text-muted-foreground">How often sources are polled for new data</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={1} max={1440} value={wsSettings.default_polling_interval_minutes}
                        onChange={e => updateSetting('default_polling_interval_minutes', parseInt(e.target.value) || 5)}
                        className="w-20 bg-secondary/30 text-center" />
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Risk Scoring */}
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />Risk Scoring Weights</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  {[
                    { key: 'risk_weight_severity' as const, label: 'Severity' },
                    { key: 'risk_weight_asset_relevance' as const, label: 'Asset Relevance' },
                    { key: 'risk_weight_confidence' as const, label: 'Confidence' },
                    { key: 'risk_weight_recency' as const, label: 'Recency' },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{label}</span>
                        <span className="text-sm font-mono text-muted-foreground">{(wsSettings[key] * 100).toFixed(0)}%</span>
                      </div>
                      <Slider value={[wsSettings[key] * 100]} min={0} max={100} step={5}
                        onValueChange={([v]) => updateSetting(key, v / 100)} />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Total: {((wsSettings.risk_weight_severity + wsSettings.risk_weight_asset_relevance + wsSettings.risk_weight_confidence + wsSettings.risk_weight_recency) * 100).toFixed(0)}%
                    {Math.abs(wsSettings.risk_weight_severity + wsSettings.risk_weight_asset_relevance + wsSettings.risk_weight_confidence + wsSettings.risk_weight_recency - 1) > 0.01 && (
                      <span className="text-warning ml-2">(should equal 100%)</span>
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary" />Notification Preferences</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: 'notify_on_critical' as const, label: 'Critical severity alerts', badge: 'Critical' },
                    { key: 'notify_on_high' as const, label: 'High severity alerts', badge: 'High' },
                    { key: 'notify_on_medium' as const, label: 'Medium severity alerts', badge: 'Medium' },
                    { key: 'notify_on_low' as const, label: 'Low severity alerts', badge: 'Low' },
                    { key: 'notify_on_asset_match' as const, label: 'Asset match notifications' },
                  ].map(({ key, label, badge }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{label}</span>
                        {badge && <Badge variant="outline" className="text-[10px]">{badge}</Badge>}
                      </div>
                      <Switch checked={wsSettings[key]} onCheckedChange={v => updateSetting(key, v)} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Enrichment & Timezone */}
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" />Enrichment & General</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto-Enrich</p>
                      <p className="text-xs text-muted-foreground">Automatically enrich ingested IOCs</p>
                    </div>
                    <Switch checked={wsSettings.auto_enrich} onCheckedChange={v => updateSetting('auto_enrich', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Timezone</p>
                    <Select value={wsSettings.timezone} onValueChange={v => updateSetting('timezone', v)}>
                      <SelectTrigger className="w-48 bg-secondary/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[
                          'UTC',
                          'Africa/Cairo',
                          'Africa/Johannesburg',
                          'Africa/Lagos',
                          'Africa/Nairobi',
                          'Africa/Casablanca',
                          'America/New_York',
                          'America/Chicago',
                          'America/Denver',
                          'America/Los_Angeles',
                          'America/Toronto',
                          'America/Sao_Paulo',
                          'America/Mexico_City',
                          'America/Argentina/Buenos_Aires',
                          'America/Bogota',
                          'Asia/Dubai',
                          'Asia/Riyadh',
                          'Asia/Qatar',
                          'Asia/Kuwait',
                          'Asia/Bahrain',
                          'Asia/Muscat',
                          'Asia/Baghdad',
                          'Asia/Amman',
                          'Asia/Beirut',
                          'Asia/Jerusalem',
                          'Asia/Kolkata',
                          'Asia/Karachi',
                          'Asia/Dhaka',
                          'Asia/Bangkok',
                          'Asia/Singapore',
                          'Asia/Hong_Kong',
                          'Asia/Shanghai',
                          'Asia/Tokyo',
                          'Asia/Seoul',
                          'Asia/Jakarta',
                          'Asia/Kuala_Lumpur',
                          'Australia/Sydney',
                          'Australia/Melbourne',
                          'Australia/Perth',
                          'Europe/London',
                          'Europe/Berlin',
                          'Europe/Paris',
                          'Europe/Madrid',
                          'Europe/Rome',
                          'Europe/Amsterdam',
                          'Europe/Brussels',
                          'Europe/Zurich',
                          'Europe/Vienna',
                          'Europe/Warsaw',
                          'Europe/Moscow',
                          'Europe/Istanbul',
                          'Europe/Athens',
                          'Pacific/Auckland',
                          'Pacific/Honolulu',
                        ].map(tz => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex justify-end">
                <Button onClick={handleSaveWorkspaceSettings} disabled={wsSaving} className="glow-cyan">
                  {wsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Workspace Settings
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
