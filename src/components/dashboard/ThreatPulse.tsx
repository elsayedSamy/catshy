import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, Bug, Crosshair, Shield } from 'lucide-react';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

export interface PulseData {
  newIntel: number;
  criticalCves: number;
  leakItems: number;
  phishingSpikes: number;
  malwareSpikes: number;
}

function PulseMetric({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  const animated = useAnimatedCounter(value);
  return (
    <div className="group flex flex-col items-center rounded-xl border border-border bg-secondary/20 p-3 text-center card-hover cursor-default">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50 mb-1.5 group-hover:scale-110 transition-transform`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <span className="text-xl font-mono font-bold text-foreground tabular-nums">{animated}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  );
}

export function ThreatPulse({ data, isLoading }: { data?: PulseData; isLoading: boolean }) {
  const metrics = [
    { label: 'New Intel', value: data?.newIntel ?? 0, icon: Crosshair, color: 'text-primary' },
    { label: 'Critical CVEs', value: data?.criticalCves ?? 0, icon: Bug, color: 'text-destructive' },
    { label: 'Leak Items', value: data?.leakItems ?? 0, icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'Phishing', value: data?.phishingSpikes ?? 0, icon: Shield, color: 'text-yellow-400' },
    { label: 'Malware', value: data?.malwareSpikes ?? 0, icon: Activity, color: 'text-accent' },
  ];

  return (
    <Card className="border-border bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <div className="relative">
            <Activity className="h-4 w-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent pulse-dot" />
          </div>
          Threat Pulse
          <span className="text-[10px] text-muted-foreground/50 font-normal ml-1">LIVE</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {metrics.map(m => (
              <PulseMetric key={m.label} {...m} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
