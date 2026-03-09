/**
 * AnalyticsPanel — Premium collapsible bottom analytics with animated charts,
 * threat level gauge, anomaly detection baseline, and better styling.
 */
import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar,
} from 'recharts';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS, ThreatCategory, SeverityLevel } from './types';
import { ChevronDown, BarChart3, TrendingUp } from 'lucide-react';

const PIE_COLORS = ['#06b6d4', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#eab308', '#ec4899', '#6366f1', '#14b8a6'];

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 8%)',
  border: '1px solid hsl(220 15% 18%)',
  borderRadius: 8,
  fontSize: 10,
  color: '#e2e8f0',
  fontFamily: "'JetBrains Mono', monospace",
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

export function AnalyticsPanel() {
  const { filteredEvents, showAnalytics, setShowAnalytics } = useThreatContext();

  const topCountries = useMemo(() => {
    const c: Record<string, number> = {};
    filteredEvents.forEach(e => { c[e.target.country] = (c[e.target.country] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [filteredEvents]);

  const categoryDist = useMemo(() => {
    const c: Record<string, number> = {};
    filteredEvents.forEach(e => { c[e.category] = (c[e.category] || 0) + 1; });
    return Object.entries(c).map(([k, v]) => ({
      name: CATEGORY_LABELS[k as ThreatCategory] || k,
      value: v,
    })).sort((a, b) => b.value - a.value);
  }, [filteredEvents]);

  const severityDist = useMemo(() => {
    const c: Record<SeverityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredEvents.forEach(e => { c[e.severity]++; });
    return Object.entries(c).map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      fill: SEVERITY_COLORS[k as SeverityLevel],
    }));
  }, [filteredEvents]);

  const timeline = useMemo(() => {
    const buckets: Record<string, { count: number; critical: number }> = {};
    filteredEvents.forEach(e => {
      const d = new Date(e.timestamp);
      d.setSeconds(0, 0);
      d.setMinutes(Math.floor(d.getMinutes() / 5) * 5);
      const key = d.toISOString();
      if (!buckets[key]) buckets[key] = { count: 0, critical: 0 };
      buckets[key].count++;
      if (e.severity === 'critical') buckets[key].critical++;
    });
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).slice(-24)
      .map(([t, data]) => ({
        time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        count: data.count,
        critical: data.critical,
        baseline: Math.max(2, data.count * 0.6 + Math.random() * 3), // simulated baseline
      }));
  }, [filteredEvents]);

  const topSrcCountries = useMemo(() => {
    const c: Record<string, number> = {};
    filteredEvents.forEach(e => { c[e.source.country] = (c[e.source.country] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredEvents]);

  // Threat score for radial gauge
  const threatScore = useMemo(() => {
    const criticals = filteredEvents.filter(e => e.severity === 'critical').length;
    const highs = filteredEvents.filter(e => e.severity === 'high').length;
    return Math.min(100, Math.round((criticals * 10 + highs * 4) / Math.max(filteredEvents.length, 1) * 20));
  }, [filteredEvents]);

  if (!showAnalytics) {
    return (
      <button
        className="border-t border-border/30 bg-card/60 backdrop-blur-md h-7 flex items-center justify-center gap-1.5 text-[9px] font-mono text-muted-foreground hover:bg-accent/10 hover:text-foreground transition-colors"
        onClick={() => setShowAnalytics(true)}
      >
        <BarChart3 className="h-3 w-3" />
        <ChevronDown className="h-3 w-3 rotate-180" /> ANALYTICS DASHBOARD
      </button>
    );
  }

  return (
    <div className="border-t border-border/50 bg-card/85 backdrop-blur-xl shrink-0">
      <button
        className="w-full h-6 flex items-center justify-center gap-1.5 text-[9px] font-mono text-muted-foreground hover:bg-accent/10 transition-colors"
        onClick={() => setShowAnalytics(false)}
      >
        <ChevronDown className="h-3 w-3" /> COLLAPSE
      </button>

      <div className="grid grid-cols-6 gap-3 px-4 pb-3 h-[190px]">
        {/* Threat Score Gauge */}
        <div className="flex flex-col items-center justify-center min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">THREAT SCORE</p>
          <div className="relative w-[80px] h-[80px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="70%"
                outerRadius="100%"
                data={[{ value: threatScore, fill: threatScore >= 70 ? SEVERITY_COLORS.critical : threatScore >= 40 ? SEVERITY_COLORS.high : SEVERITY_COLORS.medium }]}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'hsl(220 15% 12%)' }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-mono font-bold text-foreground leading-none">{threatScore}</span>
              <span className="text-[7px] font-mono text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        {/* Top Targeted */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">TOP TARGETS</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCountries} layout="vertical" margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 8, fill: '#64748b', fontFamily: "'JetBrains Mono'" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {topCountries.map((_, i) => (
                  <Cell key={i} fill={`hsl(${190 - i * 8}, 80%, ${55 - i * 3}%)`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categories */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">ATTACK CATEGORIES</p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryDist}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={55}
                innerRadius={22}
                paddingAngle={2}
                strokeWidth={0}
              >
                {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">SEVERITY DIST</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={severityDist} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#64748b', fontFamily: "'JetBrains Mono'" }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {severityDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline with baseline */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" /> TIMELINE
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 7, fill: '#64748b', fontFamily: "'JetBrains Mono'" }} interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="baseline" stroke="#64748b" fill="none" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              <Area type="monotone" dataKey="count" stroke="#06b6d4" fill="url(#timelineGrad)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="critical" stroke={SEVERITY_COLORS.critical} fill="url(#critGrad)" strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Source Countries */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">TOP SOURCES</p>
          <div className="flex-1 flex flex-col justify-center gap-1.5">
            {topSrcCountries.map(([country, count], i) => {
              const maxCount = topSrcCountries[0]?.[1] || 1;
              const pct = (count as number / (maxCount as number)) * 100;
              const hue = 200 - i * 15;
              return (
                <div key={country} className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-muted-foreground w-[65px] truncate">{country}</span>
                  <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, hsl(${hue} 80% 50% / 0.7), hsl(${hue} 80% 50% / 0.2))`,
                        boxShadow: `0 0 6px hsl(${hue} 80% 50% / 0.3)`,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-mono font-bold text-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
