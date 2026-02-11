import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Workflow, Play, ArrowUp, ArrowDown, Trash2, Search, Briefcase, Download, Bell, Globe, GitBranch, Layers } from 'lucide-react';
import { toast } from 'sonner';
import type { Playbook, PlaybookStep, PlaybookStepType } from '@/types';

const stepTypes: { type: PlaybookStepType; label: string; icon: React.ElementType }[] = [
  { type: 'enrich', label: 'Enrich IOC', icon: Search },
  { type: 'create_case', label: 'Create Case', icon: Briefcase },
  { type: 'export_iocs', label: 'Export IOCs', icon: Download },
  { type: 'notify', label: 'Send Notification', icon: Bell },
  { type: 'webhook', label: 'Call Webhook', icon: Globe },
  { type: 'condition', label: 'Condition', icon: GitBranch },
  { type: 'transform', label: 'Transform Data', icon: Layers },
];

export default function Playbooks() {
  return (
    <FeatureGate feature="playbooks" moduleName="Playbooks" description="Low-code automation engine for threat intelligence workflows. Build, version, and run playbooks with audit trails.">
      <PlaybooksContent />
    </FeatureGate>
  );
}

function PlaybooksContent() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  const [editing, setEditing] = useState<Playbook | null>(null);

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
    if (editing) {
      setPlaybooks(prev => prev.map(p => p.id === editing.id ? { ...p, name, description, steps, version: p.version + 1 } : p));
      toast.success('Playbook updated');
    } else {
      setPlaybooks(prev => [...prev, {
        id: crypto.randomUUID(), name, description, steps, version: 1, enabled: true,
        created_by: 'current_user', created_at: new Date().toISOString(), run_count: 0,
      }]);
      toast.success('Playbook created');
    }
    setDialogOpen(false);
    setName(''); setDescription(''); setSteps([]); setEditing(null);
  };

  const openEdit = (p: Playbook) => {
    setEditing(p); setName(p.name); setDescription(p.description); setSteps([...p.steps]); setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Playbooks</h1><p className="text-sm text-muted-foreground mt-1">Automate threat intelligence workflows</p></div>
        <Button onClick={() => { setEditing(null); setName(''); setDescription(''); setSteps([]); setDialogOpen(true); }} className="glow-cyan"><Plus className="mr-2 h-4 w-4" />Create Playbook</Button>
      </div>

      {playbooks.length === 0 ? (
        <EmptyState icon="file" title="No Playbooks Created" description="Build low-code automation playbooks: Enrich → Create Case → Export IOCs → Notify. All runs are versioned and audited." actionLabel="Create Playbook" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{playbooks.map(p => (
          <Card key={p.id} className="border-border bg-card hover:border-primary/20 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /><h3 className="font-medium text-sm">{p.name}</h3></div>
              <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                <Badge variant="secondary" className="text-xs">{p.steps.length} steps</Badge>
                <span className="text-xs text-muted-foreground">{p.run_count} runs</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>Edit</Button>
                <Button size="sm" className="flex-1" onClick={() => {
                  setPlaybooks(prev => prev.map(pb => pb.id === p.id ? { ...pb, run_count: pb.run_count + 1, last_run_at: new Date().toISOString() } : pb));
                  toast.success(`Playbook "${p.name}" executed — ${p.steps.length} steps completed`);
                }}><Play className="mr-1 h-3 w-3" />Run</Button>
              </div>
            </CardContent>
          </Card>
        ))}</div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit Playbook' : 'Create Playbook'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div><label className="mb-1.5 block text-sm font-medium">Name</label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Playbook name" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this playbook do?" className="bg-secondary/30" rows={2} /></div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Steps</label>
              {steps.length === 0 && <p className="text-xs text-muted-foreground mb-2">No steps added yet. Click a step type below to add.</p>}
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
