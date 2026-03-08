import { motion } from 'framer-motion';
import { AlertTriangle, Crosshair, Shield, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

export interface KpiData {
  criticalAlerts: number;
  criticalAlertsDelta: number;
  newIocs: number;
  newIocsDelta: number;
  assetsAffected: number;
  topAssetGroup: string;
  activeCampaigns: number;
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
  const up = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-destructive' : 'text-accent'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}%
    </span>
  );
}

function AnimatedValue({ value }: { value: number }) {
  const animated = useAnimatedCounter(value);
  return <>{animated}</>;
}

const kpiConfig = [
  { key: 'criticalAlerts' as const, label: 'Critical Alerts', timed: true, icon: AlertTriangle, gradient: 'from-destructive/10 to-destructive/5', iconBg: 'bg-destructive/10 border-destructive/20', iconColor: 'text-destructive', deltaKey: 'criticalAlertsDelta' as const },
  { key: 'newIocs' as const, label: 'New High-Conf IOCs', timed: true, icon: Crosshair, gradient: 'from-orange-500/10 to-orange-500/5', iconBg: 'bg-orange-500/10 border-orange-500/20', iconColor: 'text-orange-400', deltaKey: 'newIocsDelta' as const },
  { key: 'assetsAffected' as const, label: 'Assets Affected', timed: false, icon: Shield, gradient: 'from-primary/10 to-primary/5', iconBg: 'bg-primary/10 border-primary/20', iconColor: 'text-primary', deltaKey: null },
  { key: 'activeCampaigns' as const, label: 'Active Campaigns', timed: false, icon: Zap, gradient: 'from-accent/10 to-accent/5', iconBg: 'bg-accent/10 border-accent/20', iconColor: 'text-accent', deltaKey: null },
];

export function KpiCards({ data, isLoading }: { data?: KpiData; isLoading: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiConfig.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
          >
            <div className="glass-card relative overflow-hidden rounded-xl p-4">
              {/* Background gradient accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} pointer-events-none`} />
              <div className="relative flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{kpi.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground font-mono tabular-nums">
                        <AnimatedValue value={data ? data[kpi.key] : 0} />
                      </span>
                      {kpi.deltaKey && data && <DeltaBadge value={data[kpi.deltaKey]} />}
                      {kpi.key === 'assetsAffected' && data?.topAssetGroup && (
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{data.topAssetGroup}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${kpi.iconBg}`}>
                  <Icon className={`h-4.5 w-4.5 ${kpi.iconColor}`} />
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
