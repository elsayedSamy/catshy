import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crosshair } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface ThreatTypeItem {
  type: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  weightedScore: number;
}

const barColors: Record<string, string> = {
  critical: 'bg-destructive',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-primary',
};

export function TopThreats({ items = [], isLoading }: { items?: ThreatTypeItem[]; isLoading: boolean }) {
  const maxScore = Math.max(1, ...items.map(i => i.weightedScore));

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Crosshair className="h-4 w-4 text-primary" />Top Threat Types
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No threat data yet. Enable sources to start.</p>
        ) : (
          items.slice(0, 6).map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{item.type}</span>
                <span className="font-mono text-muted-foreground">{item.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${barColors[item.severity]} transition-all`}
                  style={{ width: `${(item.weightedScore / maxScore) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
