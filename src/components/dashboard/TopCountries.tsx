import { forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface CountryRank {
  code: string;
  name: string;
  score: number;
  eventCount: number;
}

export const TopCountries = forwardRef<HTMLDivElement, { items?: CountryRank[]; isLoading: boolean }>(function TopCountries({ items = [], isLoading }, ref) {
  const maxScore = Math.max(1, ...items.map(i => i.score));

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" />Top Countries / ASNs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No geo data yet.</p>
        ) : (
          items.slice(0, 8).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-4 text-right">{i + 1}</span>
              <span className="text-xs text-foreground w-20 truncate">{item.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${(item.score / maxScore) * 100}%` }} />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{item.eventCount}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
});
