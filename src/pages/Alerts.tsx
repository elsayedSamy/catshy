import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { SeverityBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Bell, Code, Pencil, Trash2 } from 'lucide-react';
import type { AlertRule, Alert, SeverityLevel, RuleCondition } from '@/types';

export default function Alerts() {
  return (
    <FeatureGate feature="alerts_rules" moduleName="Alerts & Rules" description="Create detection rules and receive alerts when matching threat intelligence is ingested.">
      <AlertsContent />
    </FeatureGate>
  );
}

function AlertsContent() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleSeverity, setRuleSeverity] = useState<SeverityLevel>('high');
  const [ruleField, setRuleField] = useState('observable_value');
  const [ruleOperator, setRuleOperator] = useState('contains');
  const [ruleValue, setRuleValue] = useState('');

  const handleCreateRule = () => {
    const newRule: AlertRule = {
      id: crypto.randomUUID(),
      name: ruleName,
      description: ruleDesc,
      conditions: [{ field: ruleField, operator: ruleOperator as any, value: ruleValue }],
      severity: ruleSeverity,
      channels: ['webhook'],
      enabled: true,
      created_by: 'current_user',
      created_at: new Date().toISOString(),
      trigger_count: 0,
    };
    setRules(prev => [...prev, newRule]);
    setDialogOpen(false);
    setRuleName(''); setRuleDesc(''); setRuleValue('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts & Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">{rules.length} rules configured, {alerts.length} active alerts</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="glow-cyan">
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      <Tabs defaultValue="rules">
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="rules" className="text-xs">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">Alerts ({alerts.length})</TabsTrigger>
          <TabsTrigger value="dsl" className="text-xs"><Code className="mr-1 h-3 w-3" />Advanced DSL</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {rules.length === 0 ? (
            <EmptyState
              icon="alert"
              title="No Detection Rules"
              description="Create detection rules to receive alerts when matching threat intelligence is ingested from your enabled sources."
              actionLabel="Create First Rule"
              onAction={() => setDialogOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <Card key={rule.id} className="border-border bg-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{rule.name}</span>
                        <SeverityBadge severity={rule.severity} />
                        <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {rule.conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <EmptyState
            icon="alert"
            title="No Alerts Triggered"
            description="Alerts appear here when ingested intelligence matches your detection rules. Create rules first."
            actionLabel="Create Rule"
            onAction={() => setDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="dsl" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Advanced Rule DSL</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={`# Example rule in DSL format:\nrule "Critical CVE for my assets":\n  when:\n    severity == "critical"\n    AND observable_type == "cve"\n    AND asset_match == true\n  then:\n    alert(severity="critical", channel="webhook")`}
                className="min-h-[200px] font-mono text-sm bg-secondary/30"
              />
              <Button variant="outline" className="mt-3" size="sm">Validate & Save</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create Detection Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Rule Name</label>
              <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Critical CVE Alert" className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Input value={ruleDesc} onChange={e => setRuleDesc(e.target.value)} placeholder="What this rule detects" className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Severity</label>
              <Select value={ruleSeverity} onValueChange={v => setRuleSeverity(v as SeverityLevel)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Condition</p>
              <div className="grid grid-cols-3 gap-2">
                <Select value={ruleField} onValueChange={setRuleField}>
                  <SelectTrigger className="bg-secondary/30 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="observable_value">Observable Value</SelectItem>
                    <SelectItem value="severity">Severity</SelectItem>
                    <SelectItem value="observable_type">Type</SelectItem>
                    <SelectItem value="source_name">Source</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={ruleOperator} onValueChange={setRuleOperator}>
                  <SelectTrigger className="bg-secondary/30 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                    <SelectItem value="gt">Greater Than</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="Value" className="bg-secondary/30 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRule} disabled={!ruleName.trim() || !ruleValue.trim()} className="glow-cyan">Create Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
