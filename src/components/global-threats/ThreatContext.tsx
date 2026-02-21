/**
 * ThreatContext — global state for the Global Threat Monitoring page.
 *
 * Manages:
 *  • Event buffer (capped at MAX_EVENTS for memory)
 *  • Simulated WebSocket stream with batch + throttle
 *  • Filter state and derived filtered events
 *  • View mode (3D/2D), live/pause, time range
 */
import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ThreatEvent, ThreatFilters, DEFAULT_FILTERS, ViewMode, TimeRange } from './types';
import { generateThreatEvent, generateInitialEvents } from './mockData';
import { toast } from 'sonner';

interface ThreatContextValue {
  events: ThreatEvent[];
  filteredEvents: ThreatEvent[];
  selectedEvent: ThreatEvent | null;
  setSelectedEvent: (e: ThreatEvent | null) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  isLive: boolean;
  setIsLive: (v: boolean) => void;
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  filters: ThreatFilters;
  setFilters: (f: ThreatFilters) => void;
  updateFilter: <K extends keyof ThreatFilters>(key: K, value: ThreatFilters[K]) => void;
  totalCount: number;
  criticalCount: number;
  showAnalytics: boolean;
  setShowAnalytics: (v: boolean) => void;
}

const ThreatContext = createContext<ThreatContextValue | null>(null);

export function useThreatContext() {
  const ctx = useContext(ThreatContext);
  if (!ctx) throw new Error('useThreatContext must be used within ThreatProvider');
  return ctx;
}

const MAX_EVENTS = 2000;
const STREAM_INTERVAL_MS = 1800;
const FLUSH_INTERVAL_MS = 1000;

export function ThreatProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<ThreatEvent[]>(() => generateInitialEvents(120));
  const [selectedEvent, setSelectedEvent] = useState<ThreatEvent | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [isLive, setIsLive] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [filters, setFilters] = useState<ThreatFilters>(DEFAULT_FILTERS);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const batchRef = useRef<ThreatEvent[]>([]);

  const updateFilter = useCallback(<K extends keyof ThreatFilters>(key: K, value: ThreatFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  /* ── Simulated WebSocket stream ── */
  useEffect(() => {
    if (!isLive) return;

    const streamInterval = setInterval(() => {
      const burst = Math.random() > 0.85 ? 3 : 1;
      for (let i = 0; i < burst; i++) {
        const event = generateThreatEvent();
        batchRef.current.push(event);

        if (event.severity === 'critical') {
          toast.error(
            `🚨 Critical: ${event.category} from ${event.source.city}`,
            {
              description: `${event.source.ip} → ${event.target.ip}`,
              duration: 5000,
            },
          );
        }
      }
    }, STREAM_INTERVAL_MS);

    const flushInterval = setInterval(() => {
      if (batchRef.current.length === 0) return;
      const batch = batchRef.current.splice(0);
      setEvents(prev => [...batch, ...prev].slice(0, MAX_EVENTS));
    }, FLUSH_INTERVAL_MS);

    return () => {
      clearInterval(streamInterval);
      clearInterval(flushInterval);
    };
  }, [isLive]);

  /* ── Derived: filtered events ── */
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const timeMs: Record<TimeRange, number> = {
      '5m': 5 * 60_000,
      '1h': 3_600_000,
      '24h': 86_400_000,
      '7d': 604_800_000,
      custom: Infinity,
    };
    const cutoff = now - timeMs[timeRange];

    return events.filter(e => {
      const ts = new Date(e.timestamp).getTime();
      if (ts < cutoff) return false;
      if (filters.severity.length > 0 && !filters.severity.includes(e.severity)) return false;
      if (e.confidence < filters.confidenceMin) return false;
      if (filters.category.length > 0 && !filters.category.includes(e.category)) return false;
      if (filters.sourceType.length > 0 && !filters.sourceType.includes(e.source_type)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = [
          e.source.ip, e.target.ip, e.source.country, e.target.country,
          e.source.city, e.target.city, e.source.asn, e.target.asn,
          e.indicators.domain, e.indicators.cve, e.indicators.hash,
          e.campaign_id, ...e.tags,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, filters, timeRange]);

  const criticalCount = useMemo(
    () => filteredEvents.filter(e => e.severity === 'critical').length,
    [filteredEvents],
  );

  const value: ThreatContextValue = {
    events,
    filteredEvents,
    selectedEvent,
    setSelectedEvent,
    viewMode,
    setViewMode,
    isLive,
    setIsLive,
    timeRange,
    setTimeRange,
    filters,
    setFilters,
    updateFilter,
    totalCount: filteredEvents.length,
    criticalCount,
    showAnalytics,
    setShowAnalytics,
  };

  return <ThreatContext.Provider value={value}>{children}</ThreatContext.Provider>;
}
