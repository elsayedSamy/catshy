/**
 * AnalyticsPanel — collapsible bottom panel with live analytics.
 *
 * Widgets: Top Targeted Countries, Attack Categories, Severity Distribution, Event Timeline.
 * All respect active filters and time range.
 */
import { useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS, ThreatCategory, SeverityLevel } from './types';

const PIE_COLORS = ['#06b6d4', '#f97316', '#8b5cf6', '#10b981', '#ef4444', '#eab308', '#ec4899', '#6366f1', '#14b8a6'];

const tooltipStyle = {
  backgroundColor: 'hsl(222 47% 8%)',
  border: '1px solid hsl(222 20% 18%)',
  borderRadius: 6,
  fontSize: 11,
  color: '#e2e8f0',
};

export function AnalyticsPanel() {
  const { filteredEvents, showAnalytics } = useThreatContext();

  const topCountries = useMemo(() => {
    const c: Record<string, number> = {};
    filteredEvents.forEach(e => { c[e.target.country] = (c[e.target.country] || 0) + 1; });
    return Object.entries(c)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
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
    return Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-24)
      .map(([t, count]) => ({
        time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        count,
      }));
  }, [filteredEvents]);

  if (!showAnalytics) return null;

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="grid grid-cols-4 gap-4 p-4 h-[200px]">
        {/* Top Countries */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Top Targeted Countries</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topCountries} layout="vertical" margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#06b6d4" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Categories */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Attack Categories</p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={22} paddingAngle={2}>
                {categoryDist.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Severity Distribution</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={severityDist} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {severityDist.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline */}
        <div className="flex flex-col min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Event Timeline</p>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
              <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#94a3b8' }} interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.12} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
