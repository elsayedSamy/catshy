/**
 * StatsHUD — Floating statistics overlay for the threat map.
 */
import { useMemo } from 'react';
import { useThreatContext } from './ThreatContext';
import { Activity, Shield, Crosshair, Zap } from 'lucide-react';

export function StatsHUD() {
  const { filteredEvents } = useThreatContext();

  const stats = useMemo(() => {
    const categories = new Set(filteredEvents.map(e => e.category));
    const countries = new Set(filteredEvents.map(e => e.source.country));
    const criticals = filteredEvents.filter(e => e.severity === 'critical').length;
    const avgConf = filteredEvents.length > 0
      ? Math.round(filteredEvents.reduce((s, e) => s + e.confidence, 0) / filteredEvents.length)
      : 0;
    return { categories: categories.size, countries: countries.size, criticals, avgConf };
  }, [filteredEvents]);

  const items = [
    { icon: Activity, label: 'CATEGORIES', value: stats.categories, color: 'text-primary' },
    { icon: Crosshair, label: 'SRC COUNTRIES', value: stats.countries, color: 'text-primary' },
    { icon: Shield, label: 'CRITICALS', value: stats.criticals, color: 'text-destructive' },
    { icon: Zap, label: 'AVG CONF', value: `${stats.avgConf}%`, color: 'text-primary' },
  ];

  return (
    <div className="absolute bottom-3 right-3 z-10 hidden lg:block">
      <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {items.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <item.icon className={`h-3 w-3 ${item.color}`} />
              <div>
                <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">{item.label}</div>
                <div className="text-[11px] font-mono font-bold text-foreground">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
