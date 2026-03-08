import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileSearch, Pin, Clock, ArrowLeft, Loader2, Briefcase, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useInvestigations, useCreateInvestigation, useUpdateInvestigation, useCases, useCreateCase } from '@/hooks/useApi';
import { SeverityBadge } from '@/components/StatusBadge';
import type { Investigation, Case, CaseStatus, CasePriority } from '@/types';

export default function Investigations() {
  return (
    <FeatureGate feature="investigations" moduleName="Investigations & Cases" description="Manage threat investigations and incident cases in one place.">
      <InvestigationsContent />
    </FeatureGate>
  );
}

function InvestigationsContent() {
  const [activeTab, setActiveTab] = useState('investigations');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investigations & Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">Track threats from investigation through resolution</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="investigations" className="gap-1.5"><FileSearch className="h-3.5 w-3.5" />Investigations</TabsTrigger>
          <TabsTrigger value="cases" className="gap-1.5"><Briefcase className="h-3.5 w-3.5" />Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="investigations">
          <InvestigationsTab />
        </TabsContent>
        <TabsContent value="cases">
          <CasesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Investigations Tab ── */
function InvestigationsTab() {
  const { data: investigations = [], isLoading } = useInvestigations();
  const createMutation = useCreateInvestigation();
  const updateMutation = useUpdateInvestigation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Investigation | null>(null);
  const [notebookContent, setNotebookContent] = useState('');

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate(
      { title, description },
      {
        onSuccess: () => { setDialogOpen(false); setTitle(''); setDescription(''); toast.success('Investigation created'); },
        onError: (e: any) => toast.error(e.message || 'Failed to create investigation'),
      },
    );
  };

  const saveNotebook = () => {
    if (!selected) return;
    updateMutation.mutate(
      { id: selected.id, notebook_content: notebookContent },
      {
        onSuccess: () => toast.success('Notes saved'),
        onError: (e: any) => toast.error(e.message || 'Failed to save notes'),
      },
    );
  };

  if (selected) {
    return (
      <div className="space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
            <h2 className="text-xl font-bold text-foreground">{selected.title}</h2>
            <Badge variant="outline">{selected.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={saveNotebook} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Save Notes
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <Card className="border-border bg-card"><CardContent className="p-4">
              <Textarea value={notebookContent} onChange={e => setNotebookContent(e.target.value)}
                placeholder={"# Investigation Notes\n\nWrite your analysis here using Markdown...\n\n## Findings\n\n## Evidence\n\n## Timeline"}
                className="min-h-[500px] font-mono text-sm bg-secondary/20 border-0 resize-none" />
            </CardContent></Card>
          </div>
          <div className="space-y-4">
            <Card className="border-border bg-card"><CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2"><Pin className="h-4 w-4 text-primary" />Pinned Evidence</h3>
              <p className="text-xs text-muted-foreground">No evidence pinned yet.</p>
            </CardContent></Card>
            <Card className="border-border bg-card"><CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Timeline</h3>
              <p className="text-xs text-muted-foreground">Timeline will appear as you add evidence and notes.</p>
            </CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="glow-cyan" size="sm"><Plus className="mr-2 h-4 w-4" />New Investigation</Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : investigations.length === 0 ? (
        <EmptyState icon="search" title="No Investigations" description="Start an investigation to document your analysis with a notebook workspace and pinned evidence." actionLabel="Start Investigation" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{investigations.map(inv => (
          <Card key={inv.id} className="border-border bg-card hover:border-primary/20 transition-colors cursor-pointer" onClick={() => { setSelected(inv); setNotebookContent(inv.notebook_content); }}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary" /><h3 className="font-medium text-sm">{inv.title}</h3></div>
              <p className="text-xs text-muted-foreground line-clamp-2">{inv.description || 'No description'}</p>
              <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs capitalize">{inv.status}</Badge><span className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
        ))}</div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>New Investigation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Title</label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Investigation title" className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" className="bg-secondary/30" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim() || createMutation.isPending} className="glow-cyan">
              {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Cases Tab ── */
function CasesTab() {
  const { data: cases = [], isLoading } = useCases();
  const createCase = useCreateCase();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<CasePriority>('medium');

  const handleCreate = () => {
    if (!title.trim()) return;
    createCase.mutate(
      { title, description, priority },
      {
        onSuccess: () => { setDialogOpen(false); setTitle(''); setDescription(''); toast.success('Case created'); },
        onError: (e: any) => toast.error(e.message || 'Failed to create case'),
      },
    );
  };

  const statusIcon = (s: CaseStatus) => s === 'closed' ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Clock className="h-4 w-4 text-primary" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="glow-cyan" size="sm"><Plus className="mr-2 h-4 w-4" />New Case</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : cases.length === 0 ? (
        <EmptyState icon="file" title="No Cases" description="Cases track incidents from discovery through resolution." actionLabel="Create Case" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="space-y-2">{cases.map(c => (
          <Card key={c.id} className="border-border bg-card hover:border-primary/20 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {statusIcon(c.status)}
                <div><p className="font-medium text-sm">{c.title}</p><p className="text-xs text-muted-foreground">{c.description}</p></div>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={c.priority} />
                <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}</div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>New Case</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Title</label><Input value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Description</label><Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-secondary/30" /></div>
            <div><label className="mb-1.5 block text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={v => setPriority(v as CasePriority)}><SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim() || createCase.isPending} className="glow-cyan">
              {createCase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
