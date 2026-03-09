import { ThreatProvider, useThreatContext } from '@/components/global-threats/ThreatContext';
import { ControlBar } from '@/components/global-threats/ControlBar';
import { GlobeView } from '@/components/global-threats/GlobeView';
import { WorldMap2D } from '@/components/global-threats/WorldMap2D';
import { ThreatDetailPanel } from '@/components/global-threats/ThreatDetailPanel';
import { AnalyticsPanel } from '@/components/global-threats/AnalyticsPanel';
import { LiveFeed } from '@/components/global-threats/LiveFeed';

function PageContent() {
  const { selectedEvent, viewMode } = useThreatContext();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 overflow-hidden bg-background">
      <ControlBar />
      <div className="flex flex-1 min-h-0 relative">
        <div className="flex-1 min-w-0 relative">
          {viewMode === '3d' ? <GlobeView /> : <WorldMap2D />}
          <LiveFeed />
        </div>
        {selectedEvent && <ThreatDetailPanel />}
      </div>
      <AnalyticsPanel />
    </div>
  );
}

export default function GlobalThreats() {
  return (
    <ThreatProvider>
      <PageContent />
    </ThreatProvider>
  );
}
