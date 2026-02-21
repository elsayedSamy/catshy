import {
  Search, Play, Pause, Globe, Map, BarChart3, AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useThreatContext } from './ThreatContext';
import {
  CATEGORY_LABELS, SOURCE_LABELS,
  ThreatCategory, SourceType, SeverityLevel, TimeRange,
} from './types';

const SEV_OPTS: { value: SeverityLevel; label: string; cls: string }[] = [
  { value: 'critical', label: 'Critical', cls: 'bg-red-500' },
  { value: 'high', label: 'High', cls: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', cls: 'bg-yellow-500' },
  { value: 'low', label: 'Low', cls: 'bg-cyan-500' },
];

const TIME_OPTS: { value: TimeRange; label: string }[] = [
  { value: '5m', label: 'Live · 5 min' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
];

export function ControlBar() {
  const {
    filters, updateFilter,
    viewMode, setViewMode,
    isLive, setIsLive,
    timeRange, setTimeRange,
    totalCount, criticalCount,
    showAnalytics, setShowAnalytics,
  } = useThreatContext();

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 backdrop-blur-sm flex-wrap z-10">
      {/* Search */}
      <div className="relative min-w-[180px] max-w-[280px] flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="IP, Domain, CVE, Hash…"
          value={filters.search}
          onChange={e => updateFilter('search', e.target.value)}
          className="pl-8 h-8 text-xs bg-background/50"
        />
      </div>

      {/* Severity multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            Severity
            {filters.severity.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.severity.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="start">
          {SEV_OPTS.map(s => (
            <label key={s.value} className="flex items-center gap-2 py-1 px-1 rounded text-xs cursor-pointer hover:bg-accent">
              <Checkbox
                checked={filters.severity.includes(s.value)}
                onCheckedChange={chk =>
                  updateFilter(
                    'severity',
                    chk
                      ? [...filters.severity, s.value]
                      : filters.severity.filter(v => v !== s.value),
                  )
                }
              />
              <span className={`w-2 h-2 rounded-full ${s.cls}`} />
              {s.label}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Confidence slider */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            Confidence ≥{filters.confidenceMin}
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

      {/* Category */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            Category
            {filters.category.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.category.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          {(Object.entries(CATEGORY_LABELS) as [ThreatCategory, string][]).map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 py-1 px-1 rounded text-xs cursor-pointer hover:bg-accent">
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

      {/* Source Type */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
            Source
            {filters.sourceType.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {filters.sourceType.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {(Object.entries(SOURCE_LABELS) as [SourceType, string][]).map(([k, lbl]) => (
            <label key={k} className="flex items-center gap-2 py-1 px-1 rounded text-xs cursor-pointer hover:bg-accent">
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

      <div className="flex-1" />

      {/* Live stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground select-none">
        <span>{totalCount.toLocaleString()} events</span>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 animate-pulse">
            {criticalCount} Critical
          </Badge>
        )}
      </div>

      {/* Time Range */}
      <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIME_OPTS.map(t => (
            <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Live / Pause */}
      <Button
        variant={isLive ? 'default' : 'outline'}
        size="sm"
        className="h-8 text-xs gap-1"
        onClick={() => setIsLive(!isLive)}
      >
        {isLive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        {isLive ? 'Live' : 'Paused'}
      </Button>

      {/* 3D / 2D toggle */}
      <div className="flex items-center border border-border rounded-md overflow-hidden">
        <Button
          variant={viewMode === '3d' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 text-xs rounded-none px-2.5"
          onClick={() => setViewMode('3d')}
        >
          <Globe className="h-3 w-3 mr-1" /> 3D
        </Button>
        <Button
          variant={viewMode === '2d' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 text-xs rounded-none px-2.5"
          onClick={() => setViewMode('2d')}
        >
          <Map className="h-3 w-3 mr-1" /> 2D
        </Button>
      </div>

      {/* Analytics toggle */}
      <Button
        variant={showAnalytics ? 'default' : 'outline'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => setShowAnalytics(!showAnalytics)}
      >
        <BarChart3 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
