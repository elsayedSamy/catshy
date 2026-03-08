import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Briefcase, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { SeverityBadge } from '@/components/StatusBadge';
import { useCases, useCreateCase } from '@/hooks/useApi';
import { toast } from 'sonner';
import type { Case, CaseStatus, CasePriority } from '@/types';

export default function Cases() {
  return (
    <FeatureGate feature="cases_reports" moduleName="Cases" description="Case management for tracking incidents with tasks, assignees, SLA tracking, and evidence.">
      <CasesContent />
    </FeatureGate>
  );
}

function CasesContent() {
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
        onSuccess: () => {
          setDialogOpen(false);
          setTitle('');
          setDescription('');
          toast.success('Case created');
        },
        onError: (e: any) => toast.error(e.message || 'Failed to create case'),
      },
    );
  };

  const statusIcon = (s: CaseStatus) => s === 'closed' ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-warning" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Cases</h1><p className="text-sm text-muted-foreground mt-1">{cases.length} cases</p></div>
        <Button onClick={() => setDialogOpen(true)} className="glow-cyan"><Plus className="mr-2 h-4 w-4" />New Case</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : cases.length === 0 ? (
        <EmptyState icon="file" title="No Cases Created" description="Cases track incidents from discovery through resolution. Create a case from an investigation or start one directly." actionLabel="Create Case" onAction={() => setDialogOpen(true)} />
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
