import { useState, useMemo } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Workflow, Play, ArrowUp, ArrowDown, Trash2, Search, Briefcase, Download, Bell, Globe, GitBranch, Layers,
  Zap, Clock, Shield, AlertTriangle, FileText, Copy, Eye, HistoryIcon, ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { usePlaybooks, useCreatePlaybook, useUpdatePlaybook, useDeletePlaybook, useRunPlaybook } from '@/hooks/useApi';
import type { Playbook, PlaybookStep, PlaybookStepType } from '@/types';

type TriggerType = 'high_conf_ioc' | 'asset_match' | 'leak_detected' | 'critical_cve' | 'scheduled' | 'manual';

interface PlaybookTrigger {
  type: TriggerType;
  filters: {
    severityThreshold?: string;
    confidenceThreshold?: number;
    orgOnly?: boolean;
    iocTypes?: string[];
  };
}

interface ExtendedPlaybook extends Playbook {
  trigger?: PlaybookTrigger;
  status: 'draft' | 'active' | 'disabled';
}

const TRIGGER_TYPES: { type: TriggerType; label: string; desc: string }[] = [
  { type: 'high_conf_ioc', label: 'New High-Conf IOC', desc: 'Fires when a high-confidence IOC is ingested' },
  { type: 'asset_match', label: 'Asset Match', desc: 'Fires when intel matches a monitored asset' },
  { type: 'leak_detected', label: 'Leak Detected', desc: 'Fires when new credential/breach leak found' },
  { type: 'critical_cve', label: 'Critical CVE/KEV', desc: 'Fires on critical CVE or KEV addition' },
  { type: 'scheduled', label: 'Scheduled', desc: 'Runs on a time-based schedule' },
  { type: 'manual', label: 'Manual', desc: 'Triggered manually by an analyst' },
];

const stepTypes: { type: PlaybookStepType; label: string; icon: React.ElementType }[] = [
  { type: 'enrich', label: 'Enrich IOC', icon: Search },
  { type: 'create_case', label: 'Create Case', icon: Briefcase },
  { type: 'export_iocs', label: 'Export IOCs', icon: Download },
  { type: 'notify', label: 'Send Notification', icon: Bell },
  { type: 'webhook', label: 'Call Webhook', icon: Globe },
  { type: 'condition', label: 'Condition', icon: GitBranch },
  { type: 'transform', label: 'Transform Data', icon: Layers },
];

const DEFAULT_TEMPLATES: ExtendedPlaybook[] = [
  {
    id: 'tpl-1', name: 'High-Conf IOC → Enrich → Case → Notify', description: 'Automatically enrich high-confidence IOCs, create a case, notify the SOC, and add to daily report draft.',
    trigger: { type: 'high_conf_ioc', filters: { confidenceThreshold: 85, orgOnly: false } },
    steps: [
      { id: 's1', type: 'enrich', name: 'Enrich IOC via VirusTotal', config: {} },
      { id: 's2', type: 'create_case', name: 'Create Case', config: {} },
      { id: 's3', type: 'notify', name: 'Notify SOC Channel', config: {} },
      { id: 's4', type: 'transform', name: 'Add to Daily Report Draft', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-2', name: 'Org Asset Match → Investigate → Alert', description: 'When a threat matches an org asset: open investigation, create case, alert SOC, export IOCs.',
    trigger: { type: 'asset_match', filters: { orgOnly: true, severityThreshold: 'high' } },
    steps: [
      { id: 's1', type: 'create_case', name: 'Create Investigation + Case', config: {} },
      { id: 's2', type: 'notify', name: 'SOC Alert', config: {} },
      { id: 's3', type: 'export_iocs', name: 'Export matched IOCs', config: {} },
      { id: 's4', type: 'webhook', name: 'Forward to SIEM', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-3', name: 'Leak Found → Mask → Escalate → Report', description: 'On leak detection: mask evidence, escalate to admin, create case, add to breach report.',
    trigger: { type: 'leak_detected', filters: {} },
    steps: [
      { id: 's1', type: 'transform', name: 'Mask Credential Evidence', config: {} },
      { id: 's2', type: 'notify', name: 'Escalate to Admin', config: {} },
      { id: 's3', type: 'create_case', name: 'Create Breach Case', config: {} },
      { id: 's4', type: 'transform', name: 'Add to Leak/Breach Report', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-4', name: 'Critical CVE/KEV → Patch Advisory → Notify', description: 'On critical CVE or KEV: generate patch advisory, notify vulnerability management, add to digest.',
    trigger: { type: 'critical_cve', filters: { severityThreshold: 'critical' } },
    steps: [
      { id: 's1', type: 'enrich', name: 'Lookup CVE Details', config: {} },
      { id: 's2', type: 'transform', name: 'Generate Patch Advisory', config: {} },
      { id: 's3', type: 'notify', name: 'Notify Vuln Mgmt Team', config: {} },
      { id: 's4', type: 'transform', name: 'Add to Vulnerability Digest', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-5', name: 'Daily Digest Auto-Report (08:00)', description: 'Scheduled daily at 08:00 UTC: generate daily brief, notify team, archive.',
    trigger: { type: 'scheduled', filters: {} },
    steps: [
      { id: 's1', type: 'transform', name: 'Generate Daily Brief', config: { schedule: '0 8 * * *' } },
      { id: 's2', type: 'notify', name: 'Send to Distribution List', config: {} },
      { id: 's3', type: 'export_iocs', name: 'Archive Report', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-6', name: 'Weekly Executive Overview', description: 'Scheduled weekly: generate executive overview, notify leadership, export appendix.',
    trigger: { type: 'scheduled', filters: {} },
    steps: [
      { id: 's1', type: 'transform', name: 'Generate Executive Overview', config: { schedule: '0 9 * * 1' } },
      { id: 's2', type: 'notify', name: 'Notify Leadership', config: {} },
      { id: 's3', type: 'export_iocs', name: 'Export IOC Appendix', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-7', name: 'Campaign/Actor Mention → Tag → Graph → Investigate', description: 'On actor/campaign mention: tag items, build graph relationships, open investigation, notify.',
    trigger: { type: 'high_conf_ioc', filters: { iocTypes: ['actor', 'malware'] } },
    steps: [
      { id: 's1', type: 'transform', name: 'Tag with Actor/Campaign', config: {} },
      { id: 's2', type: 'enrich', name: 'Build Graph Relationships', config: {} },
      { id: 's3', type: 'create_case', name: 'Open Investigation', config: {} },
      { id: 's4', type: 'notify', name: 'Notify Threat Hunters', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
  {
    id: 'tpl-8', name: 'False-Positive Guard (Auto-Triage)', description: 'Auto-triage low-trust, low-confidence alerts to reduce noise.',
    trigger: { type: 'high_conf_ioc', filters: { confidenceThreshold: 30 } },
    steps: [
      { id: 's1', type: 'condition', name: 'Check confidence < 40 AND severity == low', config: {} },
      { id: 's2', type: 'transform', name: 'Mark as False Positive', config: {} },
      { id: 's3', type: 'notify', name: 'Log to Audit', config: {} },
    ],
    version: 1, enabled: false, created_by: 'system', created_at: new Date().toISOString(), run_count: 0, status: 'draft',
  },
];

export default function Playbooks() {
  return (
    <FeatureGate feature="playbooks" moduleName="Playbooks" description="Low-code automation engine for threat intelligence workflows.">
      <PlaybooksContent />
    </FeatureGate>
  );
}

function PlaybooksContent() {
  const { data: apiPlaybooks = [], isLoading } = usePlaybooks();
  const createPlaybook = useCreatePlaybook();
  const updatePlaybook = useUpdatePlaybook();
  const deletePlaybookMut = useDeletePlaybook();
  const runPlaybook = useRunPlaybook();

  // Merge API data with templates for dev/fallback
  const playbooks: ExtendedPlaybook[] = useMemo(() => {
    if (apiPlaybooks.length > 0) {
      return apiPlaybooks.map(p => ({ ...p, status: p.enabled ? 'active' as const : 'draft' as const }));
    }
    return DEFAULT_TEMPLATES;
  }, [apiPlaybooks]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  const [editing, setEditing] = useState<ExtendedPlaybook | null>(null);
  const [triggerType, setTriggerType] = useState<TriggerType>('manual');
  const [triggerConfidence, setTriggerConfidence] = useState(80);
  const [triggerOrgOnly, setTriggerOrgOnly] = useState(false);
  const [triggerSeverity, setTriggerSeverity] = useState('high');
  const [activeTab, setActiveTab] = useState('all');

  const addStep = (type: PlaybookStepType) => {
    setSteps(prev => [...prev, {
      id: crypto.randomUUID(), type, name: stepTypes.find(s => s.type === type)?.label || type, config: {},
    }]);
  };

  const removeStep = (id: string) => setSteps(prev => prev.filter(s => s.id !== id));

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    const trigger: PlaybookTrigger = {
      type: triggerType,
      filters: {
        confidenceThreshold: triggerConfidence,
        orgOnly: triggerOrgOnly,
        severityThreshold: triggerSeverity,
      },
    };
    if (editing) {
      updatePlaybook.mutate(
        { id: editing.id, name, description, steps, trigger },
        {
          onSuccess: () => { setDialogOpen(false); resetForm(); toast.success('Playbook updated'); },
          onError: (e: any) => toast.error(e.message || 'Failed to update'),
        },
      );
    } else {
      createPlaybook.mutate(
        { name, description, steps, trigger },
        {
          onSuccess: () => { setDialogOpen(false); resetForm(); toast.success('Playbook created'); },
          onError: (e: any) => toast.error(e.message || 'Failed to create'),
        },
      );
    }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setSteps([]); setEditing(null);
    setTriggerType('manual'); setTriggerConfidence(80); setTriggerOrgOnly(false); setTriggerSeverity('high');
  };

  const openEdit = (p: ExtendedPlaybook) => {
    setEditing(p); setName(p.name); setDescription(p.description); setSteps([...p.steps]);
    if (p.trigger) {
      setTriggerType(p.trigger.type);
      setTriggerConfidence(p.trigger.filters.confidenceThreshold ?? 80);
      setTriggerOrgOnly(p.trigger.filters.orgOnly ?? false);
      setTriggerSeverity(p.trigger.filters.severityThreshold ?? 'high');
    }
    setDialogOpen(true);
  };

  const toggleEnabled = (id: string) => {
    const pb = playbooks.find(p => p.id === id);
    if (pb) {
      updatePlaybook.mutate(
        { id, enabled: !pb.enabled },
        { onSuccess: () => toast.success(`${pb.name} ${pb.enabled ? 'disabled' : 'enabled'}`) },
      );
    }
  };

  const duplicatePlaybook = (p: ExtendedPlaybook) => {
    createPlaybook.mutate(
      { name: `${p.name} (Copy)`, description: p.description, steps: p.steps, trigger: p.trigger },
      { onSuccess: () => toast.success('Playbook duplicated') },
    );
  };

  const filteredPlaybooks = activeTab === 'all' ? playbooks
    : activeTab === 'active' ? playbooks.filter(p => p.status === 'active')
    : activeTab === 'draft' ? playbooks.filter(p => p.status === 'draft')
    : playbooks.filter(p => p.status === 'disabled');

  const triggerLabel = (t?: PlaybookTrigger) => {
    if (!t) return 'Manual';
    return TRIGGER_TYPES.find(tt => tt.type === t.type)?.label || t.type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Playbooks</h1><p className="text-sm text-muted-foreground mt-1">Automate threat intelligence workflows • {playbooks.length} playbooks</p></div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="glow-cyan"><Plus className="mr-2 h-4 w-4" />Create Playbook</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50 border border-border">
          <TabsTrigger value="all" className="text-xs">All ({playbooks.length})</TabsTrigger>
          <TabsTrigger value="active" className="text-xs">Active ({playbooks.filter(p => p.status === 'active').length})</TabsTrigger>
          <TabsTrigger value="draft" className="text-xs">Draft ({playbooks.filter(p => p.status === 'draft').length})</TabsTrigger>
          <TabsTrigger value="disabled" className="text-xs">Disabled ({playbooks.filter(p => p.status === 'disabled').length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredPlaybooks.length === 0 ? (
        <EmptyState icon="file" title="No Playbooks" description="Create or enable playbook templates to automate workflows." actionLabel="Create Playbook" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredPlaybooks.map(p => (
          <Card key={p.id} className={`border-border bg-card hover:border-primary/20 transition-colors ${p.status === 'active' ? 'border-l-2 border-l-success' : ''}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Workflow className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="font-medium text-sm truncate">{p.name}</h3>
                </div>
                <Switch checked={p.enabled} onCheckedChange={() => toggleEnabled(p.id)} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              {/* Trigger summary */}
              <div className="rounded-md bg-secondary/20 px-2 py-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Trigger</p>
                <p className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3 text-primary" />{triggerLabel(p.trigger)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={p.status === 'active' ? 'default' : p.status === 'draft' ? 'secondary' : 'outline'} className="text-[10px] capitalize">{p.status}</Badge>
                <Badge variant="outline" className="text-[10px]">v{p.version}</Badge>
                <Badge variant="secondary" className="text-[10px]">{p.steps.length} steps</Badge>
                {p.run_count > 0 && <span className="text-[10px] text-muted-foreground">{p.run_count} runs</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => openEdit(p)}>Edit</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicatePlaybook(p)}><Copy className="h-3 w-3" /></Button>
                <Button size="sm" className="flex-1 text-xs h-7" onClick={() => {
                  setPlaybooks(prev => prev.map(pb => pb.id === p.id ? { ...pb, run_count: pb.run_count + 1, last_run_at: new Date().toISOString() } : pb));
                  toast.success(`Playbook "${p.name}" executed — ${p.steps.length} steps completed`);
                }}><Play className="mr-1 h-3 w-3" />Run</Button>
              </div>
            </CardContent>
          </Card>
        ))}</div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Playbook' : 'Create Playbook'}</DialogTitle>
            <DialogDescription>Define trigger conditions and automation steps.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div><label className="mb-1.5 block text-sm font-medium">Name</label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Playbook name" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this playbook do?" className="bg-secondary/30" rows={2} /></div>

            {/* Trigger Section */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1"><Zap className="h-3 w-3" />Trigger (Required)</p>
              <Select value={triggerType} onValueChange={v => setTriggerType(v as TriggerType)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map(t => <SelectItem key={t.type} value={t.type}>{t.label} — {t.desc}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Severity</label>
                  <Select value={triggerSeverity} onValueChange={setTriggerSeverity}>
                    <SelectTrigger className="bg-secondary/30 text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Confidence</label>
                  <Input type="number" value={triggerConfidence} onChange={e => setTriggerConfidence(Number(e.target.value))} min={0} max={100} className="bg-secondary/30 text-xs h-8" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={triggerOrgOnly} onChange={() => setTriggerOrgOnly(!triggerOrgOnly)} className="rounded border-border" />
                Org-relevant only
              </label>
              <div className="rounded-md bg-secondary/30 p-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Will run when:</span> {triggerLabel({ type: triggerType, filters: {} })} with severity ≥ {triggerSeverity}, confidence ≥ {triggerConfidence}%{triggerOrgOnly ? ', org-only' : ''}
              </div>
            </div>

            {/* Steps */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Steps</label>
              {steps.length === 0 && <p className="text-xs text-muted-foreground mb-2">No steps added yet.</p>}
              <div className="space-y-2 mb-3">
                {steps.map((step, i) => {
                  const StepIcon = stepTypes.find(s => s.type === step.type)?.icon || Workflow;
                  return (
                    <div key={step.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-3">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                      <StepIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1">{step.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(step.id, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveStep(step.id, 1)} disabled={i === steps.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeStep(step.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {stepTypes.map(st => (
                  <Button key={st.type} variant="outline" size="sm" className="text-xs" onClick={() => addStep(st.type)}>
                    <st.icon className="mr-1 h-3 w-3" />{st.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || steps.length === 0} className="glow-cyan">{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
