import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileSearch, Pin, Clock, Pencil } from 'lucide-react';
import type { Investigation } from '@/types';

export default function Investigations() {
  return (
    <FeatureGate feature="investigations" moduleName="Investigations" description="IDE-like notebook workspace for threat investigations with saved queries and pinned evidence.">
      <InvestigationsContent />
    </FeatureGate>
  );
}

function InvestigationsContent() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null);
  const [notebookContent, setNotebookContent] = useState('');

  const handleCreate = () => {
    const inv: Investigation = {
      id: crypto.randomUUID(),
      title,
      description,
      notebook_content: '',
      pinned_evidence: [],
      linked_entities: [],
      linked_intel: [],
      created_by: 'current_user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
    };
    setInvestigations(prev => [...prev, inv]);
    setSelectedInvestigation(inv);
    setDialogOpen(false);
    setTitle(''); setDescription('');
  };

  if (selectedInvestigation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedInvestigation(null)}>← Back</Button>
            <h1 className="text-xl font-bold text-foreground">{selectedInvestigation.title}</h1>
            <Badge variant="outline">{selectedInvestigation.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Pin className="mr-2 h-4 w-4" />Pin Evidence</Button>
            <Button size="sm" className="glow-cyan">Create Case</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Notebook */}
          <div className="lg:col-span-3">
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <Textarea
                  value={notebookContent}
                  onChange={e => setNotebookContent(e.target.value)}
                  placeholder="# Investigation Notes&#10;&#10;Write your analysis here using Markdown...&#10;&#10;## Findings&#10;&#10;## Evidence&#10;&#10;## Timeline"
                  className="min-h-[500px] font-mono text-sm bg-secondary/20 border-0 resize-none"
                />
              </CardContent>
            </Card>
          </div>
          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2"><Pin className="h-4 w-4 text-primary" />Pinned Evidence</h3>
                <p className="text-xs text-muted-foreground">No evidence pinned yet. Select items from Feed or Search to pin here.</p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Timeline</h3>
                <p className="text-xs text-muted-foreground">Investigation timeline will appear as you add evidence and notes.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investigations</h1>
          <p className="text-sm text-muted-foreground mt-1">{investigations.length} investigations</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="glow-cyan">
          <Plus className="mr-2 h-4 w-4" />New Investigation
        </Button>
      </div>

      {investigations.length === 0 ? (
        <EmptyState
          icon="search"
          title="No Investigations Started"
          description="Start an investigation to document your analysis with a notebook workspace, pinned evidence, and linked entities."
          actionLabel="Start Investigation"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {investigations.map(inv => (
            <Card key={inv.id} className="border-border bg-card hover:border-primary/20 transition-colors cursor-pointer" onClick={() => { setSelectedInvestigation(inv); setNotebookContent(inv.notebook_content); }}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">{inv.title}</h3>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{inv.description || 'No description'}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{inv.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>New Investigation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Investigation title" className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of what you're investigating" className="bg-secondary/30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!title.trim()} className="glow-cyan">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
