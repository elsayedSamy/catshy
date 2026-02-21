import { ThreatProvider, useThreatContext } from '@/components/global-threats/ThreatContext';
import { ControlBar } from '@/components/global-threats/ControlBar';
import { GlobeView } from '@/components/global-threats/GlobeView';
import { FlatMapView } from '@/components/global-threats/FlatMapView';
import { ThreatDetailPanel } from '@/components/global-threats/ThreatDetailPanel';
import { AnalyticsPanel } from '@/components/global-threats/AnalyticsPanel';

function PageContent() {
  const { viewMode, selectedEvent } = useThreatContext();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 overflow-hidden">
      <ControlBar />
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          {viewMode === '3d' ? <GlobeView /> : <FlatMapView />}
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
