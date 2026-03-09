/**
 * StatsHUD — Premium floating statistics overlay with animated counters,
 * mini sparklines, and threat level indicator.
 */
import { useMemo, useEffect, useRef, useState } from 'react';
import { useThreatContext } from './ThreatContext';
import { Activity, Shield, Crosshair, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SEVERITY_COLORS } from './types';

function useAnimatedNumber(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const ref = useRef({ start: target, end: target, startTime: 0 });

  useEffect(() => {
    ref.current.start = value;
    ref.current.end = target;
    ref.current.startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - ref.current.startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(ref.current.start + (ref.current.end - ref.current.start) * eased);
      setValue(current);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

function MiniSparkline({ data, color, height = 20 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 48;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg width={w} height={height} className="opacity-60">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThreatLevelGauge({ level }: { level: number }) {
  const label = level >= 80 ? 'CRITICAL' : level >= 60 ? 'HIGH' : level >= 40 ? 'ELEVATED' : level >= 20 ? 'GUARDED' : 'LOW';
  const color = level >= 80 ? SEVERITY_COLORS.critical : level >= 60 ? SEVERITY_COLORS.high : level >= 40 ? SEVERITY_COLORS.medium : SEVERITY_COLORS.low;

  return (
    <div className="flex flex-col items-center gap-1 pt-1.5 border-t border-border/30 mt-1">
      <div className="text-[7px] font-mono text-muted-foreground uppercase tracking-widest">THREAT LEVEL</div>
      <div className="w-full h-1.5 bg-background/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${level}%`,
            background: `linear-gradient(90deg, ${color}40, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
      <span className="text-[8px] font-mono font-bold" style={{ color }}>{label}</span>
    </div>
  );
}

export function StatsHUD() {
  const { filteredEvents } = useThreatContext();

  const stats = useMemo(() => {
    const categories = new Set(filteredEvents.map(e => e.category));
    const countries = new Set(filteredEvents.map(e => e.source.country));
    const criticals = filteredEvents.filter(e => e.severity === 'critical').length;
    const highs = filteredEvents.filter(e => e.severity === 'high').length;
    const avgConf = filteredEvents.length > 0
      ? Math.round(filteredEvents.reduce((s, e) => s + e.confidence, 0) / filteredEvents.length)
      : 0;

    // Threat level: weighted severity score
    const threatLevel = filteredEvents.length > 0
      ? Math.min(100, Math.round(
          (criticals * 10 + highs * 4 + (filteredEvents.length - criticals - highs) * 1) /
          Math.max(filteredEvents.length, 1) * 15
        ))
      : 0;

    return { categories: categories.size, countries: countries.size, criticals, highs, avgConf, threatLevel };
  }, [filteredEvents]);

  // Build sparkline data from recent events (events per 10-second bucket)
  const sparkData = useMemo(() => {
    const buckets: number[] = new Array(12).fill(0);
    const now = Date.now();
    filteredEvents.forEach(e => {
      const age = now - new Date(e.timestamp).getTime();
      const bucket = Math.floor(age / 10000);
      if (bucket >= 0 && bucket < 12) buckets[11 - bucket]++;
    });
    return buckets;
  }, [filteredEvents]);

  const critSparkData = useMemo(() => {
    const buckets: number[] = new Array(12).fill(0);
    const now = Date.now();
    filteredEvents.filter(e => e.severity === 'critical').forEach(e => {
      const age = now - new Date(e.timestamp).getTime();
      const bucket = Math.floor(age / 10000);
      if (bucket >= 0 && bucket < 12) buckets[11 - bucket]++;
    });
    return buckets;
  }, [filteredEvents]);

  const animCategories = useAnimatedNumber(stats.categories);
  const animCountries = useAnimatedNumber(stats.countries);
  const animCriticals = useAnimatedNumber(stats.criticals);
  const animConf = useAnimatedNumber(stats.avgConf);

  // Trend indicator
  const trend = useMemo(() => {
    const half = Math.floor(sparkData.length / 2);
    const first = sparkData.slice(0, half).reduce((a, b) => a + b, 0);
    const second = sparkData.slice(half).reduce((a, b) => a + b, 0);
    if (second > first * 1.2) return 'up';
    if (second < first * 0.8) return 'down';
    return 'stable';
  }, [sparkData]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-destructive' : trend === 'down' ? 'text-emerald-400' : 'text-muted-foreground';

  const items = [
    { icon: Activity, label: 'CATEGORIES', value: animCategories, color: 'text-primary', spark: null, numColor: '' },
    { icon: Crosshair, label: 'SRC COUNTRIES', value: animCountries, color: 'text-primary', spark: null, numColor: '' },
    { icon: Shield, label: 'CRITICALS', value: animCriticals, color: 'text-destructive', spark: critSparkData, numColor: stats.criticals > 0 ? 'text-destructive' : '' },
    { icon: Zap, label: 'AVG CONF', value: `${animConf}%`, color: 'text-primary', spark: null, numColor: '' },
  ];

  return (
    <div className="absolute bottom-3 right-3 z-10 hidden lg:block">
      <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl px-3.5 py-2.5 shadow-2xl min-w-[200px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[7px] font-mono uppercase tracking-[0.2em] text-muted-foreground">LIVE STATS</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendIcon className={`h-2.5 w-2.5 ${trendColor}`} />
            <MiniSparkline data={sparkData} color="hsl(var(--primary))" height={14} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-2">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <item.icon className={`h-3 w-3 ${item.color} shrink-0`} />
              <div className="min-w-0">
                <div className="text-[7px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[12px] font-mono font-bold ${item.numColor || 'text-foreground'} leading-none`}>
                    {item.value}
                  </span>
                  {item.spark && <MiniSparkline data={item.spark} color={SEVERITY_COLORS.critical} height={12} />}
                </div>
              </div>
            </div>
          ))}
        </div>

        <ThreatLevelGauge level={stats.threatLevel} />
      </div>
    </div>
  );
}
