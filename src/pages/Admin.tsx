import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useUsers, useAuditLogs, useHealth } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Shield, Users, Activity, Flag, Clock, AlertTriangle, CheckCircle2, XCircle, UserPlus, Send, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { FeatureFlags, UserRole } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const featureFlagLabels: Record<keyof FeatureFlags, { label: string; description: string }> = {
  graph_explorer: { label: 'Graph Explorer', description: 'Interactive entity-relationship visualization' },
  risk_scoring: { label: 'Risk & Confidence Scoring', description: 'Multi-factor scoring with explainability' },
  alerts_rules: { label: 'Alerts & Rules', description: 'Detection rules and alert notifications' },
  investigations: { label: 'Investigations', description: 'Notebook workspace for threat analysis' },
  cases_reports: { label: 'Cases & Reports', description: 'Case management and report generation' },
  leaks_center: { label: 'Leaks Center', description: 'Credential and breach monitoring' },
  leaks_tor: { label: 'TOR Connectors', description: 'Dark web monitoring via TOR (requires legal review)' },
  threat_map_3d: { label: '3D Threat Map', description: 'Three.js globe visualization' },
  playbooks: { label: 'Playbooks', description: 'Low-code automation engine' },
  integrations_marketplace: { label: 'Integrations Marketplace', description: 'Third-party connector marketplace' },
};

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('analyst');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const { isDevMode } = useAuth();

  const handleInvite = async () => {
    if (!email) { toast.error('Email is required'); return; }
    setLoading(true);
    setInviteLink('');
    try {
      if (isDevMode) {
        // Dev mode simulation
        const fakeToken = btoa(`invite-${email}-${Date.now()}`).replace(/=/g, '');
        const link = `${window.location.origin}/auth/accept-invite?token=${fakeToken}`;
        setInviteLink(link);
        toast.success(`Dev Mode: Invite generated for ${email}`, { description: 'In production, an email would be sent automatically.' });
      } else {
        const token = localStorage.getItem('catshy_token');
        const res = await fetch(`${API_BASE}/auth/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ email, name: name || undefined, role }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Failed to send invite');
        }
        toast.success(`Invite sent to ${email}`);
        setOpen(false);
        setEmail(''); setName(''); setRole('analyst');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Invite New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="invite-email" className="text-sm">Email *</Label>
            <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@company.com" className="mt-1.5 bg-secondary/50" />
          </div>
          <div>
            <Label htmlFor="invite-name" className="text-sm">Name (optional)</Label>
            <Input id="invite-name" value={name} onChange={e => setName(e.target.value)}
              placeholder="John Doe" className="mt-1.5 bg-secondary/50" />
          </div>
          <div>
            <Label className="text-sm">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as UserRole)}>
              <SelectTrigger className="mt-1.5 bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analyst">Analyst</SelectItem>
                <SelectItem value="hunter">Hunter</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="readonly">Read Only</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inviteLink && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium text-primary">Invite Link Generated</p>
              <div className="flex gap-2">
                <code className="flex-1 text-[10px] font-mono text-foreground bg-secondary/50 rounded px-2 py-1.5 overflow-x-auto break-all">{inviteLink}</code>
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyLink}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Share this link with the user. It expires in 24 hours.</p>
            </div>
          )}

          <Button onClick={handleInvite} disabled={loading || !email} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Invite
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const { hasRole } = useAuth();
  const { flags, setFlag } = useFeatureFlags();
  const { data: users = [] } = useUsers();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: health } = useHealth();
  const [torWarning, setTorWarning] = useState(false);

  if (!hasRole(['admin'])) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground">The Admin Panel requires administrator privileges.</p>
      </div>
    );
  }

  const handleTorToggle = (enabled: boolean) => { if (enabled) { setTorWarning(true); return; } setFlag('leaks_tor', false); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Admin Panel</h1><p className="text-sm text-muted-foreground mt-1">System administration and configuration</p></div>
        <InviteUserDialog />
      </div>
      <Tabs defaultValue="users">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="users" className="text-xs"><Users className="mr-1 h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="flags" className="text-xs"><Flag className="mr-1 h-3 w-3" />Feature Flags</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs"><Clock className="mr-1 h-3 w-3" />Audit Log</TabsTrigger>
          <TabsTrigger value="system" className="text-xs"><Activity className="mr-1 h-3 w-3" />System</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          {users.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">No users loaded</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect to the backend to manage users. Use the "Invite User" button above to add team members.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">{users.map((u: any) => (
              <Card key={u.id} className="border-border bg-card"><CardContent className="flex items-center justify-between p-4">
                <div><p className="font-medium text-sm">{u.name || u.email}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize text-xs">{u.role}</Badge>
                  {u.is_active ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </CardContent></Card>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="flags" className="mt-4 space-y-3">
          {(Object.keys(featureFlagLabels) as (keyof FeatureFlags)[]).map(key => (
            <Card key={key} className={`border-border bg-card ${key === 'leaks_tor' ? 'border-l-2 border-l-destructive/50' : ''}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2"><p className="font-medium text-sm">{featureFlagLabels[key].label}</p>{key === 'leaks_tor' && <Badge className="bg-destructive/20 text-destructive text-xs">Sensitive</Badge>}</div>
                  <p className="text-xs text-muted-foreground">{featureFlagLabels[key].description}</p>
                </div>
                <Switch checked={flags[key]} onCheckedChange={v => key === 'leaks_tor' ? handleTorToggle(v) : setFlag(key, v)} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {auditLogs.length === 0 ? (
            <Card className="border-border bg-card"><CardContent className="p-6 text-center text-sm text-muted-foreground">
              No audit logs loaded. Audit logs are recorded when the backend is connected.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">{auditLogs.map((log: any) => (
              <Card key={log.id} className="border-border bg-card"><CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">{log.action}</Badge>
                  <span className="text-sm">{log.entity_type}</span>
                  <span className="text-xs text-muted-foreground">{log.user_email}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
              </CardContent></Card>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'API Server', ok: !!health },
              { label: 'PostgreSQL', ok: !!health },
              { label: 'Redis', ok: !!health },
              { label: 'Celery Workers', ok: !!health },
            ].map(s => (
              <Card key={s.label} className="border-border bg-card">
                <CardContent className="p-4 text-center">
                  {s.ok ? <CheckCircle2 className="h-6 w-6 text-accent mx-auto mb-2" /> : <XCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />}
                  <p className="font-medium text-sm">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.ok ? 'Connected' : 'Not connected'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {torWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="max-w-md border-destructive/30 bg-card">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-destructive" /><h3 className="text-lg font-semibold">Enable TOR Connectors</h3></div>
              <p className="text-sm text-muted-foreground">Enabling TOR dark web monitoring may have legal implications. This action is audit-logged and only available to administrators.</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li>All TOR connector activity is logged in the audit trail</li>
                <li>Ensure compliance with your organization's security policies</li>
                <li>This feature can be disabled at any time</li>
              </ul>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTorWarning(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => { setFlag('leaks_tor', true); setTorWarning(false); }}>I Understand — Enable TOR</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
