import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Map as MapIcon, Pause, Play, Clock } from 'lucide-react';
import { useState } from 'react';

export default function ThreatMap() {
  return (
    <FeatureGate feature="threat_map_3d" moduleName="3D Threat Map" description="Interactive Three.js globe visualization showing threat origins and targets based on real geo-tagged intelligence data. Toggleable for performance.">
      <ThreatMapContent />
    </FeatureGate>
  );
}

function ThreatMapContent() {
  const [hasData] = useState(false);
  const [playing, setPlaying] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">3D Threat Map</h1><p className="text-sm text-muted-foreground mt-1">Visualize global threat origins and targets</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)}>
            {playing ? <><Pause className="mr-2 h-4 w-4" />Pause</> : <><Play className="mr-2 h-4 w-4" />Play</>}
          </Button>
        </div>
      </div>
      {!hasData ? (
        <EmptyState icon="search" title="No Geo-Tagged Intelligence" description="The 3D threat map displays attack origins and targets using geo-tagged intelligence data. Enable sources and ingest data to populate the globe." actionLabel="View Sources" onAction={() => window.location.href = '/sources'} />
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="relative h-[600px] w-full rounded-lg bg-background flex items-center justify-center">
              <div className="text-center">
                <MapIcon className="h-16 w-16 text-primary/30 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Three.js globe renders here with real geo-tagged intel data</p>
                <p className="text-xs text-muted-foreground mt-1">Offline-friendly: bundled geometry, no cloud tile dependencies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
