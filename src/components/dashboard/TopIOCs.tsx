import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Crosshair } from 'lucide-react';

export interface IOCItem {
  value: string;
  type: string;
  hitCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const typeColors: Record<string, string> = {
  ip: 'border-destructive/30 text-destructive',
  domain: 'border-orange-500/30 text-orange-400',
  hash: 'border-yellow-500/30 text-yellow-400',
  url: 'border-primary/30 text-primary',
  cve: 'border-accent/30 text-accent',
};

export const TopIOCs = forwardRef<HTMLDivElement, { items?: IOCItem[]; isLoading: boolean }>(function TopIOCs({ items = [], isLoading }, ref) {
  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Crosshair className="h-4 w-4 text-destructive" />Top 10 IOCs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No IOC data yet. Enable sources to start.</p>
        ) : (
          items.slice(0, 10).map((ioc, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/10 px-2.5 py-1.5">
              <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">{i + 1}</span>
              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${typeColors[ioc.type] || 'border-border text-muted-foreground'}`}>
                {ioc.type.toUpperCase()}
              </Badge>
              <code className="text-xs font-mono text-foreground truncate flex-1">{ioc.value}</code>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{ioc.hitCount} hits</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
});
