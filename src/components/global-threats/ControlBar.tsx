/**
 * ControlBar — Cyber war-room command bar with live event ticker.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Search, BarChart3, AlertTriangle,
  Activity, WifiOff, Radio, Shield, Crosshair, Layers,
  Globe, Map, RotateCcw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useThreatContext } from './ThreatContext';
import {
  CATEGORY_LABELS, SOURCE_LABELS, SEVERITY_COLORS, DEFAULT_FILTERS,
  ThreatCategory, SourceType, SeverityLevel, TimeRange,
} from './types';

const SEV_OPTS: { value: SeverityLevel; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: SEVERITY_COLORS.critical },
  { value: 'high', label: 'High', color: SEVERITY_COLORS.high },
  { value: 'medium', label: 'Medium', color: SEVERITY_COLORS.medium },
  { value: 'low', label: 'Low', color: SEVERITY_COLORS.low },
];

const TIME_OPTS: { value: TimeRange; label: string }[] = [
  { value: '5m', label: '5M LIVE' },
  { value: '1h', label: '1H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
];

export function ControlBar() {
  const {
    filters, updateFilter,
    isLive, setIsLive,
    timeRange, setTimeRange,
    totalCount, criticalCount,
    showAnalytics, setShowAnalytics,
    filteredEvents,
    viewMode, setViewMode,
  } = useThreatContext();

  const [tickerText, setTickerText] = useState('');
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filteredEvents.length === 0) return;
    const latest = filteredEvents.slice(0, 5);
    const text = latest.map(e =>
      `▸ ${e.severity.toUpperCase()} ${e.category.replace(/_/g, ' ')} from ${e.source.city}, ${e.source.country} → ${e.target.city} (${e.source.ip})`
    ).join('     ');
    setTickerText(text);
  }, [filteredEvents]);

  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col border-b border-border bg-card/80 backdrop-blur-md z-20">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary font-semibold leading-none">
              THREAT OPS
            </span>
            <span className="text-[8px] font-mono text-muted-foreground leading-none mt-0.5">
              GLOBAL MONITORING
            </span>
          </div>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <div className="relative min-w-[160px] max-w-[240px] flex-shrink-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="IP, CVE, Hash…"
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            className="pl-7 h-7 text-[11px] bg-background/60 border-border/50 font-mono"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 font-mono">
              <Crosshair className="h-3 w-3" />
              SEV
              {filters.severity.length > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] flex items-center justify-center">
                  {filters.severity.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-2" align="start">
            {SEV_OPTS.map(s => (
              <label key={s.value} className="flex items-center gap-2 py-1 px-1 rounded text-xs cursor-pointer hover:bg-accent/10">
                <Checkbox
                  checked={filters.severity.includes(s.value)}
                  onCheckedChange={chk =>
                    updateFilter('severity', chk ? [...filters.severity, s.value] : filters.severity.filter(v => v !== s.value))
                  }
                />
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 font-mono">
              <Layers className="h-3 w-3" />
              CAT
              {filters.category.length > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] flex items-center justify-center">
                  {filters.category.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start">
            {(Object.entries(CATEGORY_LABELS) as [ThreatCategory, string][]).map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 py-1 px-1 rounded text-xs cursor-pointer hover:bg-accent/10">
                <Checkbox
                  checked={filters.category.includes(k)}
                  onCheckedChange={chk =>
                    updateFilter('category', chk ? [...filters.category, k] : filters.category.filter(v => v !== k))
                  }
                />
                {lbl}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 font-mono">
              SRC
              {filters.sourceType.length > 0 && (
                <span className="ml-0.5 w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] flex items-center justify-center">
                  {filters.sourceType.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            {(Object.entries(SOURCE_LABELS) as [SourceType, string][]).map(([k, lbl]) => (
              <label key={k} className="flex items-center gap-2 py-1 px-1 rounded text-xs cursor-pointer hover:bg-accent/10">
                <Checkbox
                  checked={filters.sourceType.includes(k)}
                  onCheckedChange={chk =>
                    updateFilter('sourceType', chk ? [...filters.sourceType, k] : filters.sourceType.filter(v => v !== k))
                  }
                />
                {lbl}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 font-mono">
              CONF≥{filters.confidenceMin}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <p className="text-xs text-muted-foreground mb-2">Min confidence: {filters.confidenceMin}%</p>
            <Slider
              value={[filters.confidenceMin]}
              onValueChange={([v]) => updateFilter('confidenceMin', v)}
              max={100}
              step={5}
            />
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-3 mr-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border/40">
            <Activity className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-mono text-muted-foreground">EVENTS</span>
            <span className="text-[11px] font-mono font-bold text-foreground">{totalCount.toLocaleString()}</span>
          </div>

          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/30 animate-pulse">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span className="text-[10px] font-mono text-destructive font-bold">{criticalCount} CRIT</span>
            </div>
          )}
        </div>

        <div className="flex items-center rounded-md border border-border/50 overflow-hidden">
          {TIME_OPTS.map(t => (
            <button
              key={t.value}
              className={`h-7 px-2.5 text-[10px] font-mono transition-colors ${
                timeRange === t.value
                  ? 'bg-primary/20 text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent/10'
              }`}
              onClick={() => setTimeRange(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`h-7 text-[10px] gap-1 px-2 font-mono ${
            isLive ? 'text-emerald-400' : 'text-muted-foreground'
          }`}
          onClick={() => setIsLive(!isLive)}
        >
          {isLive ? (
            <>
              <Radio className="h-3 w-3 animate-pulse" />
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              LIVE
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              PAUSED
            </>
          )}
        </Button>

        <div className="flex items-center rounded-md border border-border/50 overflow-hidden mr-1">
          <button
            className={`h-7 px-2 text-[10px] font-mono transition-colors flex items-center gap-1 ${
              viewMode === '3d' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-accent/10'
            }`}
            onClick={() => setViewMode('3d')}
          >
            <Globe className="h-3 w-3" />
            3D
          </button>
          <button
            className={`h-7 px-2 text-[10px] font-mono transition-colors flex items-center gap-1 ${
              viewMode === '2d' ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-accent/10'
            }`}
            onClick={() => setViewMode('2d')}
          >
            <Map className="h-3 w-3" />
            2D
          </button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${showAnalytics ? 'text-primary' : 'text-muted-foreground'}`}
          onClick={() => setShowAnalytics(!showAnalytics)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </Button>

        <div className="hidden xl:flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <span className="text-[8px]">UTC</span>
        </div>
      </div>

      {isLive && tickerText && (
        <div className="h-5 border-t border-border/30 bg-background/40 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-card to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-card to-transparent z-10" />
          <div
            ref={tickerRef}
            className="flex items-center h-full whitespace-nowrap text-[9px] font-mono text-muted-foreground/70"
            style={{ animation: 'marquee 30s linear infinite' }}
          >
            {tickerText}
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
