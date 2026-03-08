import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, Bug, Crosshair, Shield } from 'lucide-react';

export interface PulseData {
  newIntel: number;
  criticalCves: number;
  leakItems: number;
  phishingSpikes: number;
  malwareSpikes: number;
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" />Threat Pulse
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {metrics.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="flex flex-col items-center rounded-lg border border-border bg-secondary/20 p-2 text-center">
                  <Icon className={`h-4 w-4 ${m.color} mb-1`} />
                  <span className="text-lg font-mono font-bold text-foreground">{m.value}</span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
