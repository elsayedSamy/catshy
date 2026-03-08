import { useState, useMemo } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Shield, Users, Activity, Flag, Clock, AlertTriangle, CheckCircle2, XCircle,
  UserPlus, Send, Loader2, Copy, Search, Download, Eye, LogOut, RefreshCw,
  Monitor, Ban, Key, FileText, ChevronLeft, ChevronRight, Info, Database
} from 'lucide-react';
import { toast } from 'sonner';
import type { FeatureFlags, UserRole, AuditEntry } from '@/types';

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
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const { isDevMode } = useAuth();

  const handleInvite = async () => {
    if (!email) { toast.error('Email is required'); return; }
    setLoading(true);
    setInviteLink('');
    try {
      if (isDevMode) {
        const fakeToken = btoa(`invite-${email}-${Date.now()}`).replace(/=/g, '');
        const link = `${window.location.origin}/auth/accept-invite?token=${fakeToken}`;
        setInviteLink(link);
        toast.success(`Dev Mode: Invite generated for ${email}`, { description: 'In production, an email would be sent automatically.' });
      } else {
        const res = await fetch(`${API_BASE}/auth/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, name: name || undefined, role }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || 'Failed to send invite');
        }
        toast.success(`Invite sent to ${email}`);
        setOpen(false);
        setEmail(''); setName(''); setRole('user');
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
        <Button size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Invite User</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle className="text-foreground">Invite New User</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="invite-email" className="text-sm">Email *</Label>
            <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" className="mt-1.5 bg-secondary/50" />
          </div>
          <div>
            <Label htmlFor="invite-name" className="text-sm">Name (optional)</Label>
            <Input id="invite-name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="mt-1.5 bg-secondary/50" />
          </div>
          <div>
            <Label className="text-sm">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as UserRole)}>
              <SelectTrigger className="mt-1.5 bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
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
                <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyLink}><Copy className="h-3 w-3" /></Button>
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

// ── Severity badge for audit events ──
function AuditSeverityBadge({ action }: { action: string }) {
  if (action.includes('FAILED') || action.includes('REVOKED')) return <Badge className="bg-destructive/20 text-destructive text-[10px]">High</Badge>;
  if (action.includes('ROLE_CHANGED') || action.includes('FLAG') || action.includes('API_KEY')) return <Badge className="bg-warning/20 text-warning text-[10px]">Medium</Badge>;
  return <Badge className="bg-accent/20 text-accent text-[10px]">Info</Badge>;
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: 'Login Success',
    AUTH_LOGIN_FAILED: 'Login Failed',
    USER_ROLE_CHANGED: 'Role Changed',
    INTEGRATION_API_KEY_UPDATED: 'API Key Updated',
    FEATURE_FLAG_TOGGLED: 'Flag Toggled',
    PLAYBOOK_RUN: 'Playbook Run',
    EXPORT_ACTION: 'Export',
    SESSION_REVOKED: 'Session Revoked',
  };
  return map[action] || action;
}

// ── Audit Log Tab ──
function AuditLogTab({ logs }: { logs: AuditEntry[] }) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('7d');
  const [page, setPage] = useState(1);
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);
  const perPage = 10;

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = dateFilter === '24h' ? now - 86400000 : dateFilter === '7d' ? now - 7 * 86400000 : now - 30 * 86400000;
    return logs.filter(l => {
      if (new Date(l.timestamp).getTime() < cutoff) return false;
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return l.user_email.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.ip_address.includes(q) || l.entity_id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [logs, search, actionFilter, dateFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const failedLogins24h = logs.filter(l => l.action === 'AUTH_LOGIN_FAILED' && Date.now() - new Date(l.timestamp).getTime() < 86400000).length;
  const topOffendingIP = (() => {
    const ips: Record<string, number> = {};
    logs.filter(l => l.action === 'AUTH_LOGIN_FAILED').forEach(l => { ips[l.ip_address] = (ips[l.ip_address] || 0) + 1; });
    const sorted = Object.entries(ips).sort((a, b) => b[1] - a[1]);
    return sorted[0];
  })();

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = 'Timestamp,Action,User,IP,Outcome,Resource\n';
      const rows = filtered.map(l => `${l.timestamp},${l.action},${l.user_email},${l.ip_address},${(l.details as any)?.outcome || ''},${l.entity_type}:${l.entity_id}`).join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Audit log exported as ${format.toUpperCase()}`);
  };

  const actions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="space-y-4">
      {/* Attack Signals */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border bg-card"><CardContent className="p-3 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${failedLogins24h > 5 ? 'bg-destructive/20' : 'bg-muted/30'}`}>
            <Ban className={`h-5 w-5 ${failedLogins24h > 5 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </div>
          <div><p className="text-lg font-bold">{failedLogins24h}</p><p className="text-[10px] text-muted-foreground">Failed Logins (24h)</p></div>
        </CardContent></Card>
        <Card className="border-border bg-card"><CardContent className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-warning" /></div>
          <div>
            <p className="text-lg font-bold font-mono">{topOffendingIP ? topOffendingIP[0].slice(-12) : '—'}</p>
            <p className="text-[10px] text-muted-foreground">Top Offending IP ({topOffendingIP ? topOffendingIP[1] : 0} failures)</p>
          </div>
        </CardContent></Card>
        <Card className="border-border bg-card"><CardContent className="p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center"><Activity className="h-5 w-5 text-primary" /></div>
          <div><p className="text-lg font-bold">{filtered.length}</p><p className="text-[10px] text-muted-foreground">Events in Period</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search user, IP, action, resource..." className="pl-9 h-8 text-xs bg-secondary/30" />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-8 text-xs bg-secondary/30"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a} className="text-xs">{actionLabel(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={v => { setDateFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px] h-8 text-xs bg-secondary/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('csv')}><Download className="h-3 w-3 mr-1" />CSV</Button>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleExport('json')}><Download className="h-3 w-3 mr-1" />JSON</Button>
      </div>

      {/* Table */}
      <Card className="border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs w-[140px]">Timestamp</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Severity</TableHead>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">IP</TableHead>
              <TableHead className="text-xs">Outcome</TableHead>
              <TableHead className="text-xs w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No audit events match your filters.</TableCell></TableRow>
            ) : paginated.map(log => (
              <TableRow key={log.id} className="border-border hover:bg-secondary/20 cursor-pointer" onClick={() => setDetailEntry(log)}>
                <TableCell className="text-xs font-mono text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{actionLabel(log.action)}</Badge></TableCell>
                <TableCell><AuditSeverityBadge action={log.action} /></TableCell>
                <TableCell className="text-xs">{log.user_email || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{log.ip_address}</TableCell>
                <TableCell className="text-xs">
                  {(log.details as any)?.outcome === 'success'
                    ? <span className="text-accent flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Success</span>
                    : <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />Failed</span>}
                </TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="h-3 w-3" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} events total • Page {page}/{pages}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!detailEntry} onOpenChange={() => setDetailEntry(null)}>
        <SheetContent className="bg-card border-border w-[400px]">
          <SheetHeader><SheetTitle className="text-foreground">Audit Event Details</SheetTitle></SheetHeader>
          {detailEntry && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                {([
                  ['Event ID', detailEntry.id],
                  ['Timestamp', new Date(detailEntry.timestamp).toLocaleString() + ' (UTC)'],
                  ['Action', actionLabel(detailEntry.action)],
                  ['Actor', detailEntry.user_email || '—'],
                  ['Actor ID', detailEntry.user_id || '—'],
                  ['Source IP', detailEntry.ip_address],
                  ['User Agent', (detailEntry.details as any)?.user_agent || '—'],
                  ['Resource Type', detailEntry.entity_type],
                  ['Resource ID', detailEntry.entity_id || '—'],
                  ['Outcome', (detailEntry.details as any)?.outcome || '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono text-foreground text-right max-w-[200px] truncate">{v}</span>
                  </div>
                ))}
              </div>
              {(detailEntry.details as any)?.failure_reason && (
                <Card className="border-destructive/20 bg-destructive/5"><CardContent className="p-3">
                  <p className="text-xs text-destructive font-medium">Failure Reason</p>
                  <p className="text-xs text-muted-foreground mt-1">{(detailEntry.details as any).failure_reason}</p>
                </CardContent></Card>
              )}
              <Card className="border-border bg-secondary/20"><CardContent className="p-3">
                <p className="text-xs text-muted-foreground font-medium mb-2">Raw Details</p>
                <pre className="text-[10px] font-mono text-foreground overflow-auto max-h-[200px]">{JSON.stringify(detailEntry.details, null, 2)}</pre>
              </CardContent></Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Sessions Tab ──
function SessionsTab() {
  const [sessions, setSessions] = useState<{ id: string; user_email: string; user_name: string; role: string; login_at: string; last_activity: string; ip: string; ua: string; current: boolean }[]>([]);

  const revokeSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    toast.success('Session revoked');
  };

  const revokeAllForUser = (email: string) => {
    setSessions(prev => prev.filter(s => s.user_email !== email || s.current));
    toast.success(`All sessions for ${email} revoked`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sessions.length} active sessions</p>
      </div>
      <Card className="border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Login Time</TableHead>
              <TableHead className="text-xs">Last Activity</TableHead>
              <TableHead className="text-xs">IP</TableHead>
              <TableHead className="text-xs">Device</TableHead>
              <TableHead className="text-xs w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map(s => (
              <TableRow key={s.id} className="border-border">
                <TableCell className="text-xs">
                  <div className="flex items-center gap-2">
                    <span>{s.user_name}</span>
                    {s.current && <Badge className="bg-primary/20 text-primary text-[10px]">Current</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{s.user_email}</p>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] capitalize">{s.role}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(s.login_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(s.last_activity).toLocaleString()}</TableCell>
                <TableCell className="text-xs font-mono">{s.ip}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.ua}</TableCell>
                <TableCell>
                  {!s.current && (
                    <div className="flex gap-1">
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => revokeSession(s.id)}><LogOut className="h-3.5 w-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Revoke session</TooltipContent></Tooltip>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── Users Tab (Enhanced) ──
function UsersTab() {
  const { data: apiUsers = [] } = useUsers();
  const users = apiUsers.length > 0 ? apiUsers : DEMO_USERS_LIST;
  const [userDetail, setUserDetail] = useState<typeof DEMO_USERS_LIST[0] | null>(null);

  return (
    <div className="space-y-4">
      <Card className="border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">MFA</TableHead>
              <TableHead className="text-xs">Last Login</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u: any) => (
              <TableRow key={u.id} className="border-border hover:bg-secondary/20 cursor-pointer" onClick={() => setUserDetail(u)}>
                <TableCell className="text-xs">
                  <p className="font-medium">{u.name || u.email}</p>
                  <p className="text-[10px] text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] capitalize">{u.role}</Badge></TableCell>
                <TableCell>
                  {u.is_active
                    ? <span className="text-accent flex items-center gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />Active</span>
                    : <span className="text-muted-foreground flex items-center gap-1 text-xs"><XCircle className="h-3 w-3" />Disabled</span>}
                </TableCell>
                <TableCell>
                  {u.mfa ? <Badge className="bg-accent/20 text-accent text-[10px]">Enabled</Badge> : <Badge variant="outline" className="text-[10px]">Off</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toast.info('Force password reset sent'); }}><Key className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Force Password Reset</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setUserDetail(u); }}><Eye className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>View Details</TooltipContent></Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* User Detail Sheet */}
      <Sheet open={!!userDetail} onOpenChange={() => setUserDetail(null)}>
        <SheetContent className="bg-card border-border w-[400px]">
          <SheetHeader><SheetTitle className="text-foreground">User Profile</SheetTitle></SheetHeader>
          {userDetail && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                  {(userDetail.name || userDetail.email)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{userDetail.name}</p>
                  <p className="text-xs text-muted-foreground">{userDetail.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                {([
                  ['Role', userDetail.role],
                  ['Status', userDetail.is_active ? 'Active' : 'Disabled'],
                  ['MFA', userDetail.mfa ? 'Enabled' : 'Disabled'],
                  ['Last Login', userDetail.last_login ? new Date(userDetail.last_login).toLocaleString() : 'Never'],
                  ['Created', new Date(userDetail.created_at).toLocaleString()],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground capitalize">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => toast.info('Password reset sent')}>
                  <Key className="h-3 w-3 mr-1" />Force Reset
                </Button>
                <Button variant={userDetail.is_active ? 'destructive' : 'default'} size="sm" className="text-xs flex-1" onClick={() => toast.info(`User ${userDetail.is_active ? 'disabled' : 'enabled'}`)}>
                  {userDetail.is_active ? <><Ban className="h-3 w-3 mr-1" />Disable</> : <><CheckCircle2 className="h-3 w-3 mr-1" />Enable</>}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Admin() {
  const { hasRole } = useAuth();
  const { flags, setFlag } = useFeatureFlags();
  const { data: auditLogs = [] } = useAuditLogs();
  const { data: health } = useHealth();
  const [torWarning, setTorWarning] = useState(false);

  const allLogs = auditLogs.length > 0 ? auditLogs : DEMO_AUDIT;

  if (!hasRole(['system_owner', 'team_admin'])) {
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
        <div><h1 className="text-2xl font-bold">Admin Panel</h1><p className="text-sm text-muted-foreground mt-1">System administration, security monitoring, and configuration</p></div>
        <InviteUserDialog />
      </div>
      <Tabs defaultValue="users">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="users" className="text-xs"><Users className="mr-1 h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs"><Monitor className="mr-1 h-3 w-3" />Sessions</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs"><FileText className="mr-1 h-3 w-3" />Audit Log</TabsTrigger>
          <TabsTrigger value="flags" className="text-xs"><Flag className="mr-1 h-3 w-3" />Feature Flags</TabsTrigger>
          <TabsTrigger value="system" className="text-xs"><Activity className="mr-1 h-3 w-3" />System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <SessionsTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditLogTab logs={allLogs} />
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

        <TabsContent value="system" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'API Server', icon: Activity, ok: !!health },
              { label: 'PostgreSQL', icon: Database, ok: !!health },
              { label: 'Redis', icon: RefreshCw, ok: !!health },
              { label: 'Celery Workers', icon: Monitor, ok: !!health },
              { label: 'Scheduler', icon: Clock, ok: !!health },
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
          {!health && (
            <Card className="border-warning/20 bg-warning/5"><CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">Backend Not Connected</p>
                <p className="text-xs text-muted-foreground">Actions that require backend (save, test, fetch) are disabled. Connect the backend to enable full functionality.</p>
              </div>
            </CardContent></Card>
          )}
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
