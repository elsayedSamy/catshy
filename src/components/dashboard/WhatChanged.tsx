import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Flame, Target } from 'lucide-react';

export interface ChangesData {
  sourceSpikes: { name: string; count: number; delta: number }[];
  trendingKeywords: { keyword: string; count: number }[];
  mostTargetedAssets: { value: string; count: number }[];
}

export function WhatChanged({ data, isLoading }: { data?: ChangesData; isLoading: boolean }) {
  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />What Changed Since Yesterday
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !data || (data.sourceSpikes.length === 0 && data.trendingKeywords.length === 0 && data.mostTargetedAssets.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No significant changes detected.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Source spikes */}
            {data.sourceSpikes.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Flame className="h-3 w-3" />Source Spikes
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.sourceSpikes.slice(0, 5).map(s => (
                    <Badge key={s.name} variant="outline" className="text-[10px] border-orange-500/20 text-orange-400">
                      {s.name} +{s.delta}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {/* Trending keywords */}
            {data.trendingKeywords.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />Trending Keywords
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.trendingKeywords.slice(0, 8).map(k => (
                    <Badge key={k.keyword} variant="outline" className="text-[10px] border-primary/20 text-primary">
                      {k.keyword} ({k.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {/* Most targeted assets */}
            {data.mostTargetedAssets.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Target className="h-3 w-3" />Most Targeted Assets
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.mostTargetedAssets.slice(0, 5).map(a => (
                    <Badge key={a.value} variant="outline" className="text-[10px] border-destructive/20 text-destructive">
                      {a.value} ({a.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
