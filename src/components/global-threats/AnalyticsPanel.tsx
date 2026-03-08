/**
 * AnalyticsPanel — collapsible bottom panel with live analytics.
 */
import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS, ThreatCategory, SeverityLevel } from './types';
import { ChevronDown } from 'lucide-react';

const PIE_COLORS = ['#06b6d4', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#eab308', '#ec4899', '#6366f1', '#14b8a6'];

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 6%)',
  border: '1px solid hsl(220 15% 16%)',
  borderRadius: 6,
  fontSize: 10,
  color: '#e2e8f0',
  fontFamily: "'JetBrains Mono', monospace",
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
    }));
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
    const buckets: Record<string, number> = {};
    filteredEvents.forEach(e => {
      const d = new Date(e.timestamp);
      d.setSeconds(0, 0);
      d.setMinutes(Math.floor(d.getMinutes() / 5) * 5);
      buckets[d.toISOString()] = (buckets[d.toISOString()] || 0) + 1;
    });
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).slice(-24)
      .map(([t, count]) => ({
        time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        count,
      }));
  }, [filteredEvents]);

  // Top source countries
  const topSrcCountries = useMemo(() => {
    const c: Record<string, number> = {};
    filteredEvents.forEach(e => { c[e.source.country] = (c[e.source.country] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredEvents]);

  if (!showAnalytics) {
    return (
      <button
        className="border-t border-border/30 bg-card/50 h-6 flex items-center justify-center gap-1 text-[9px] font-mono text-muted-foreground hover:bg-accent/10 transition-colors"
        onClick={() => setShowAnalytics(true)}
      >
        <ChevronDown className="h-3 w-3 rotate-180" /> ANALYTICS
      </button>
    );
  }

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-md shrink-0">
      <button
        className="w-full h-5 flex items-center justify-center text-[9px] font-mono text-muted-foreground hover:bg-accent/10 transition-colors"
        onClick={() => setShowAnalytics(false)}
      >
        <ChevronDown className="h-3 w-3" /> COLLAPSE
      </button>
      <div className="grid grid-cols-5 gap-3 px-4 pb-3 h-[180px]">
        {/* Top Targeted */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">TOP TARGETS</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCountries} layout="vertical" margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 8, fill: '#64748b', fontFamily: "'JetBrains Mono'" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#06b6d4" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categories */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">ATTACK CATEGORIES</p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50} innerRadius={20} paddingAngle={2}>
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
            <BarChart data={severityDist} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b', fontFamily: "'JetBrains Mono'" }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {severityDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline */}
        <div className="flex flex-col min-w-0">
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground mb-1 font-mono">TIMELINE</p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 7, fill: '#64748b', fontFamily: "'JetBrains Mono'" }} interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={1.5} />
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
              return (
                <div key={country} className="flex items-center gap-2">
                  <span className="text-[8px] font-mono text-muted-foreground w-[70px] truncate">{country}</span>
                  <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, hsl(185 80% 50% / 0.6), hsl(185 80% 50% / 0.2))`,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-mono text-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
