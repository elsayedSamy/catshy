import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Bell, Code, Trash2, MessageSquare, Mail, Webhook, TestTube, Loader2, MoreVertical, Pencil, Power } from 'lucide-react';
import { toast } from 'sonner';
import type { AlertRule, Alert, SeverityLevel } from '@/types';

interface NotificationChannel {
  id: string;
  name: string;
  type: 'slack' | 'teams' | 'email' | 'webhook';
  enabled: boolean;
  config: Record<string, string>;
  lastTriggered?: string;
}

const CHANNEL_ICONS = { slack: MessageSquare, teams: MessageSquare, email: Mail, webhook: Webhook };
const CHANNEL_LABELS = { slack: 'Slack', teams: 'Microsoft Teams', email: 'Email', webhook: 'Webhook' };

export default function Alerts() {
  return (
    <FeatureGate feature="alerts_rules" moduleName="Alerts & Rules" description="Configure real-time alerting for critical events.">
      <AlertsContent />
    </FeatureGate>
  );
}

function AlertsContent() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts] = useState<Alert[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([
    { id: 'ch1', name: 'Security Team', type: 'teams', enabled: true, config: { webhook_url: 'https://outlook.office.com/webhook/...' }, lastTriggered: new Date(Date.now() - 3600000).toISOString() },
    { id: 'ch2', name: 'SOC Email', type: 'email', enabled: true, config: { recipients: 'soc@company.com' }, lastTriggered: new Date(Date.now() - 86400000).toISOString() },
    { id: 'ch3', name: 'Alert Channel', type: 'slack', enabled: false, config: { webhook_url: '' } },
  ]);

  // Rule dialog state
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleSeverity, setRuleSeverity] = useState<SeverityLevel>('high');
  const [ruleField, setRuleField] = useState('observable_value');
  const [ruleOperator, setRuleOperator] = useState('contains');
  const [ruleValue, setRuleValue] = useState('');

  // Channel dialog state (shared for create + edit)
  const [channelDialog, setChannelDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [chName, setChName] = useState('');
  const [chType, setChType] = useState<'slack' | 'teams' | 'email' | 'webhook'>('slack');
  const [chConfig, setChConfig] = useState('');

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);

  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // ── Channel CRUD ──

  const openCreateChannel = () => {
    setEditingChannel(null);
    setChName('');
    setChType('slack');
    setChConfig('');
    setChannelDialog(true);
  };

  const openEditChannel = (ch: NotificationChannel) => {
    setEditingChannel(ch);
    setChName(ch.name);
    setChType(ch.type);
    setChConfig(ch.type === 'email' ? (ch.config.recipients || '') : (ch.config.webhook_url || ''));
    setChannelDialog(true);
  };

  const handleSaveChannel = () => {
    if (!chName.trim()) return;
    const config = chType === 'email' ? { recipients: chConfig } : { webhook_url: chConfig };

    if (editingChannel) {
      setChannels(prev => prev.map(c =>
        c.id === editingChannel.id
          ? { ...c, name: chName, type: chType, config }
          : c
      ));
      toast.success('Channel updated');
    } else {
      const ch: NotificationChannel = {
        id: crypto.randomUUID(), name: chName, type: chType, enabled: true, config,
      };
      setChannels(prev => [...prev, ch]);
      toast.success('Channel added');
    }
    setChannelDialog(false);
    setEditingChannel(null);
  };

  const confirmDeleteChannel = (id: string) => {
    setDeletingChannelId(id);
    setDeleteDialog(true);
  };

  const handleDeleteChannel = () => {
    if (!deletingChannelId) return;
    setChannels(prev => prev.filter(c => c.id !== deletingChannelId));
    setDeleteDialog(false);
    setDeletingChannelId(null);
    toast.success('Channel deleted');
  };

  const handleToggleChannel = (id: string) => {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  };

  const handleTestChannel = async (id: string) => {
    setTestingChannel(id);
    await new Promise(r => setTimeout(r, 1500));
    setTestingChannel(null);
    const ch = channels.find(c => c.id === id);
    toast.success(`Test notification sent to ${ch?.name}`);
  };

  // ── Rule CRUD ──

  const handleCreateRule = () => {
    if (!ruleName.trim() || !ruleValue.trim()) return;
    const newRule: AlertRule = {
      id: crypto.randomUUID(), name: ruleName, description: ruleDesc,
      conditions: [{ field: ruleField, operator: ruleOperator as any, value: ruleValue }],
      severity: ruleSeverity, channels: ['webhook'], enabled: true,
      created_by: 'current_user', created_at: new Date().toISOString(), trigger_count: 0,
    };
    setRules(prev => [...prev, newRule]);
    setRuleDialog(false);
    setRuleName(''); setRuleDesc(''); setRuleValue('');
    toast.success('Detection rule created');
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Rule deleted');
  };

  const deletingChannel = channels.find(c => c.id === deletingChannelId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure real-time alerting for critical events</p>
        </div>
        <Button onClick={() => setRuleDialog(true)} className="glow-cyan"><Plus className="mr-2 h-4 w-4" />Create Rule</Button>
      </div>

      {/* Notification Channels */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">Notification Channels</h3>
          <Button variant="outline" size="sm" onClick={openCreateChannel}><Plus className="mr-1 h-3 w-3" />Add Channel</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map(ch => {
            const Icon = CHANNEL_ICONS[ch.type];
            return (
              <Card key={ch.id} className={`border-border bg-card ${ch.enabled ? 'border-l-2 border-l-success' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium text-sm truncate">{ch.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={ch.enabled} onCheckedChange={() => handleToggleChannel(ch.id)} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditChannel(ch)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTestChannel(ch.id)} disabled={testingChannel === ch.id}>
                            <TestTube className="mr-2 h-3.5 w-3.5" />Test
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleChannel(ch.id)}>
                            <Power className="mr-2 h-3.5 w-3.5" />{ch.enabled ? 'Disable' : 'Enable'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => confirmDeleteChannel(ch.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] capitalize">{CHANNEL_LABELS[ch.type]}</Badge>
                    {ch.lastTriggered && (
                      <span className="text-[10px] text-muted-foreground">Last: {new Date(ch.lastTriggered).toLocaleDateString()}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5 font-mono truncate">
                    {ch.type === 'email' ? ch.config.recipients : ch.config.webhook_url}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Rules & Alerts Tabs */}
      <Tabs defaultValue="rules">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="rules" className="text-xs">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">Alerts ({alerts.length})</TabsTrigger>
          <TabsTrigger value="dsl" className="text-xs"><Code className="mr-1 h-3 w-3" />Advanced DSL</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {rules.length === 0 ? (
            <EmptyState icon="alert" title="No Detection Rules" description="Create detection rules to receive alerts when matching threat intelligence is ingested." actionLabel="Create First Rule" onAction={() => setRuleDialog(true)} />
          ) : (
            <div className="space-y-2">{rules.map(rule => (
              <Card key={rule.id} className="border-border bg-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{rule.name}</span>
                      <SeverityBadge severity={rule.severity} />
                      <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">{rule.enabled ? 'Active' : 'Disabled'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                    <p className="text-xs text-muted-foreground font-mono">{rule.conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRule(rule.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <EmptyState icon="alert" title="No Alerts Triggered" description="Alerts appear here when ingested intelligence matches your detection rules." actionLabel="Create Rule" onAction={() => setRuleDialog(true)} />
        </TabsContent>

        <TabsContent value="dsl" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">Advanced Rule DSL</CardTitle></CardHeader>
            <CardContent>
              <Textarea placeholder={`# Example:\nrule "Critical CVE":\n  when: severity == "critical" AND observable_type == "cve"\n  then: alert(channel="webhook")`} className="min-h-[200px] font-mono text-sm bg-secondary/30" />
              <Button variant="outline" className="mt-3" size="sm">Validate & Save</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Create Detection Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Rule Name</label><Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Critical CVE Alert" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Description</label><Input value={ruleDesc} onChange={e => setRuleDesc(e.target.value)} placeholder="What this rule detects" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Severity</label>
              <Select value={ruleSeverity} onValueChange={v => setRuleSeverity(v as SeverityLevel)}><SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Condition</p>
              <div className="grid grid-cols-3 gap-2">
                <Select value={ruleField} onValueChange={setRuleField}><SelectTrigger className="bg-secondary/30 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="observable_value">Observable</SelectItem><SelectItem value="severity">Severity</SelectItem><SelectItem value="observable_type">Type</SelectItem><SelectItem value="source_name">Source</SelectItem><SelectItem value="title">Title</SelectItem></SelectContent></Select>
                <Select value={ruleOperator} onValueChange={setRuleOperator}><SelectTrigger className="bg-secondary/30 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="contains">Contains</SelectItem><SelectItem value="regex">Regex</SelectItem></SelectContent></Select>
                <Input value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="Value" className="bg-secondary/30 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRule} disabled={!ruleName.trim() || !ruleValue.trim()} className="glow-cyan">Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Channel Dialog */}
      <Dialog open={channelDialog} onOpenChange={(open) => { setChannelDialog(open); if (!open) setEditingChannel(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingChannel ? 'Edit Channel' : 'Add Notification Channel'}</DialogTitle>
            <DialogDescription>{editingChannel ? 'Update the channel configuration.' : 'Configure a new alerting destination.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Channel Name</label>
              <Input value={chName} onChange={e => setChName(e.target.value)} placeholder="e.g. SOC Alerts" className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Type</label>
              <Select value={chType} onValueChange={v => setChType(v as any)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{chType === 'email' ? 'Recipients' : 'Webhook URL'}</label>
              <Input value={chConfig} onChange={e => setChConfig(e.target.value)} placeholder={chType === 'email' ? 'soc@company.com' : 'https://hooks.slack.com/...'} className="bg-secondary/30 font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChannelDialog(false); setEditingChannel(null); }}>Cancel</Button>
            <Button onClick={handleSaveChannel} disabled={!chName.trim()} className="glow-cyan">
              {editingChannel ? 'Save Changes' : 'Add Channel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Channel Confirmation */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delete Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingChannel?.name}</strong>? This action cannot be undone. Any rules linked to this channel will stop sending notifications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteChannel}>Delete Channel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
