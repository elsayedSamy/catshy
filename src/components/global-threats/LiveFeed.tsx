/**
 * LiveFeed — Floating live event feed overlay for the threat map.
 * Shows the latest events in a compact scrolling list.
 */
import { useMemo } from 'react';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS } from './types';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LiveFeed() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();
  
  const recentEvents = useMemo(() => filteredEvents.slice(0, 15), [filteredEvents]);
  
  if (recentEvents.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 w-[260px] z-10">
      <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 border-b border-border/30 flex items-center justify-between">
          <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-primary">LIVE FEED</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
        <ScrollArea className="h-[280px]">
          <div className="p-1">
            {recentEvents.map((ev, i) => (
              <button
                key={ev.id}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-accent/10 transition-colors group"
                onClick={() => setSelectedEvent(ev)}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: SEVERITY_COLORS[ev.severity],
                      boxShadow: ev.severity === 'critical' ? `0 0 4px ${SEVERITY_COLORS.critical}` : undefined,
                    }}
                  />
                  <span className="text-[9px] font-mono text-foreground truncate">
                    {CATEGORY_LABELS[ev.category]}
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground ml-auto shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-[8px] font-mono text-muted-foreground/70 mt-0.5 truncate pl-3">
                  {ev.source.city} → {ev.target.city}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
