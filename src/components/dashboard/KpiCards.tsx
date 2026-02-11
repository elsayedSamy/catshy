import { motion } from 'framer-motion';
import { AlertTriangle, Crosshair, Shield, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
    <span className={`flex items-center gap-0.5 text-xs ${up ? 'text-destructive' : 'text-accent'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}{value}%
    </span>
  );
}

const kpiConfig = [
  { key: 'criticalAlerts' as const, label: 'Critical Alerts (24h)', icon: AlertTriangle, color: 'destructive', deltaKey: 'criticalAlertsDelta' as const },
  { key: 'newIocs' as const, label: 'New High-Conf IOCs (24h)', icon: Crosshair, color: 'warning', deltaKey: 'newIocsDelta' as const },
  { key: 'assetsAffected' as const, label: 'Assets Affected', icon: Shield, color: 'primary', deltaKey: null },
  { key: 'activeCampaigns' as const, label: 'Active Campaigns', icon: Zap, color: 'accent', deltaKey: null },
];

export function KpiCards({ data, isLoading }: { data?: KpiData; isLoading: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiConfig.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <motion.div key={kpi.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.35 }}>
            <Card className="relative overflow-hidden border-border bg-card p-4 transition-all hover:border-primary/30">
              <div className={`absolute -right-3 -top-3 h-16 w-16 rounded-full bg-${kpi.color}/5`} />
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground font-mono">
                        {data ? data[kpi.key] : 0}
                      </span>
                      {kpi.deltaKey && data && <DeltaBadge value={data[kpi.deltaKey]} />}
                      {kpi.key === 'assetsAffected' && data?.topAssetGroup && (
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">{data.topAssetGroup}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-${kpi.color}/20 bg-${kpi.color}/10`}>
                  <Icon className={`h-4 w-4 text-${kpi.color}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
