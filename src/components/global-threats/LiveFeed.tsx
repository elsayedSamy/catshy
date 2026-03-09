/**
 * LiveFeed — Premium floating live event feed with severity-colored borders,
 * relative timestamps, auto-highlight for new events, and smooth scroll.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS } from './types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Eye, EyeOff, Zap } from 'lucide-react';

function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function LiveFeed() {
  const { filteredEvents, setSelectedEvent, selectedEvent, setZoomToEvent } = useThreatContext();
  const [collapsed, setCollapsed] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevCountRef = useRef(0);

  const recentEvents = useMemo(() => filteredEvents.slice(0, 20), [filteredEvents]);

  // Track new events for highlight animation
  useEffect(() => {
    if (filteredEvents.length > prevCountRef.current) {
      const newOnes = filteredEvents.slice(0, filteredEvents.length - prevCountRef.current);
      const ids = new Set(newOnes.map(e => e.id));
      setNewIds(ids);
      const timer = setTimeout(() => setNewIds(new Set()), 2000);
      prevCountRef.current = filteredEvents.length;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = filteredEvents.length;
  }, [filteredEvents]);

  // Severity counts for header
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, other: 0 };
    recentEvents.forEach(e => {
      if (e.severity === 'critical') c.critical++;
      else if (e.severity === 'high') c.high++;
      else c.other++;
    });
    return c;
  }, [recentEvents]);

  if (recentEvents.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 w-[280px] z-10">
      <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full px-3 py-2 border-b border-border/30 flex items-center justify-between hover:bg-accent/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-[8px] font-mono uppercase tracking-[0.15em] text-primary font-bold">LIVE FEED</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {counts.critical > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold"
                style={{ backgroundColor: `${SEVERITY_COLORS.critical}20`, color: SEVERITY_COLORS.critical }}>
                {counts.critical}
              </span>
            )}
            {counts.high > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold"
                style={{ backgroundColor: `${SEVERITY_COLORS.high}20`, color: SEVERITY_COLORS.high }}>
                {counts.high}
              </span>
            )}
            {collapsed ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </button>

        {!collapsed && (
          <>
            {/* Auto-scroll toggle */}
            <div className="flex items-center justify-end px-2 py-1 border-b border-border/20">
              <button
                onClick={(e) => { e.stopPropagation(); setAutoScroll(!autoScroll); }}
                className="flex items-center gap-1 text-[7px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                {autoScroll ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                {autoScroll ? 'AUTO' : 'PAUSED'}
              </button>
            </div>

            <ScrollArea className="h-[320px]">
              <div ref={scrollRef} className="p-1.5 space-y-0.5">
                {recentEvents.map((ev) => {
                  const isNew = newIds.has(ev.id);
                  const isSelected = selectedEvent?.id === ev.id;
                  const sevColor = SEVERITY_COLORS[ev.severity];

                  return (
                    <button
                      key={ev.id}
                      className={`
                        w-full text-left px-2.5 py-2 rounded-lg transition-all duration-300 group relative
                        ${isSelected ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-accent/10'}
                        ${isNew ? 'animate-pulse' : ''}
                      `}
                      style={{
                        borderLeft: `2px solid ${sevColor}`,
                        boxShadow: isNew ? `inset 0 0 20px ${sevColor}10` : undefined,
                      }}
                      onClick={() => {
                        setSelectedEvent(ev);
                        setZoomToEvent(ev);
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: sevColor,
                            boxShadow: ev.severity === 'critical' ? `0 0 6px ${sevColor}` : undefined,
                          }}
                        />
                        <span className="text-[9px] font-mono font-semibold text-foreground truncate">
                          {CATEGORY_LABELS[ev.category]}
                        </span>
                        <span
                          className="text-[7px] font-mono px-1 py-0.5 rounded ml-auto shrink-0"
                          style={{ backgroundColor: `${sevColor}15`, color: sevColor }}
                        >
                          {ev.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pl-3">
                        <span className="text-[8px] font-mono text-muted-foreground/70 truncate">
                          {ev.source.city}, {ev.source.country} → {ev.target.city}
                        </span>
                        <span className="text-[7px] font-mono text-muted-foreground/50 shrink-0 ml-1">
                          {relativeTime(ev.timestamp)}
                        </span>
                      </div>
                      {ev.indicators.cve && (
                        <div className="mt-0.5 pl-3">
                          <span className="text-[7px] font-mono text-destructive/80">{ev.indicators.cve}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
