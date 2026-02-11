import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Workflow, Play, Clock } from 'lucide-react';
import { useState } from 'react';
import type { Playbook } from '@/types';

export default function Playbooks() {
  return (
    <FeatureGate feature="playbooks" moduleName="Playbooks" description="Low-code automation engine for threat intelligence workflows. Build, version, and run playbooks with audit trails.">
      <PlaybooksContent />
    </FeatureGate>
  );
}

function PlaybooksContent() {
  const [playbooks] = useState<Playbook[]>([]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Playbooks</h1><p className="text-sm text-muted-foreground mt-1">Automate threat intelligence workflows</p></div>
        <Button className="glow-cyan"><Plus className="mr-2 h-4 w-4" />Create Playbook</Button>
      </div>
      {playbooks.length === 0 ? (
        <EmptyState icon="file" title="No Playbooks Created" description="Build low-code automation playbooks: Enrich → Create Case → Export IOCs → Notify. All runs are versioned and audited." actionLabel="Create Playbook" onAction={() => {}} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{playbooks.map(p => (
          <Card key={p.id} className="border-border bg-card hover:border-primary/20 transition-colors">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-primary" /><h3 className="font-medium text-sm">{p.name}</h3></div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
              <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs">v{p.version}</Badge><span className="text-xs text-muted-foreground">{p.run_count} runs</span></div>
              <Button variant="outline" size="sm" className="w-full mt-2"><Play className="mr-2 h-3 w-3" />Run</Button>
            </CardContent>
          </Card>
        ))}</div>
      )}
    </div>
  );
}
