import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, ZoomIn, ZoomOut, Move, Filter } from 'lucide-react';
import { useState } from 'react';

export default function Graph() {
  return (
    <FeatureGate feature="graph_explorer" moduleName="Graph Explorer" description="Interactive entity-relationship graph for exploring STIX-like threat intelligence entities and their connections.">
      <GraphContent />
    </FeatureGate>
  );
}

function GraphContent() {
  const [entities] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Graph Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1">Visualize relationships between threat intelligence entities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" />Filter</Button>
        </div>
      </div>

      {entities.length === 0 ? (
        <EmptyState
          icon="search"
          title="No Entities Yet"
          description="Entities are created automatically when intelligence is ingested and normalized. Enable sources and fetch data to populate the graph."
          actionLabel="View Sources"
          onAction={() => window.location.href = '/sources'}
        />
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="relative h-[600px] w-full rounded-lg bg-secondary/20">
              {/* Graph canvas would render here with force-directed layout */}
              <div className="absolute bottom-4 right-4 flex gap-1">
                <Button variant="secondary" size="icon" className="h-8 w-8"><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="secondary" size="icon" className="h-8 w-8"><ZoomOut className="h-4 w-4" /></Button>
                <Button variant="secondary" size="icon" className="h-8 w-8"><Move className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
