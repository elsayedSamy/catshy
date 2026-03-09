import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Flame, Target } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ChangesData {
  sourceSpikes: { name: string; count: number; delta: number }[];
  trendingKeywords: { keyword: string; count: number }[];
  mostTargetedAssets: { value: string; count: number }[];
}

function ChangesSection({ icon: Icon, label, children, index }: { icon: React.ElementType; label: string; children: React.ReactNode; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
    >
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3 w-3" />{label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </motion.div>
  );
}

export function WhatChanged({ data, isLoading }: { data?: ChangesData; isLoading: boolean }) {
  return (
    <Card className="widget-card rounded-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />What Changed
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
        ) : !data || (data.sourceSpikes.length === 0 && data.trendingKeywords.length === 0 && data.mostTargetedAssets.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No significant changes detected.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.sourceSpikes.length > 0 && (
              <ChangesSection icon={Flame} label="Source Spikes" index={0}>
                {data.sourceSpikes.slice(0, 5).map(s => (
                  <Badge key={s.name} variant="outline" className="text-[10px] border-orange-500/20 text-orange-400 hover:bg-orange-500/10 transition-colors cursor-default">
                    {s.name} <span className="ml-1 font-mono">+{s.delta}</span>
                  </Badge>
                ))}
              </ChangesSection>
            )}
            {data.trendingKeywords.length > 0 && (
              <ChangesSection icon={TrendingUp} label="Trending Keywords" index={1}>
                {data.trendingKeywords.slice(0, 8).map(k => (
                  <Badge key={k.keyword} variant="outline" className="text-[10px] border-primary/20 text-primary hover:bg-primary/10 transition-colors cursor-default">
                    {k.keyword} <span className="ml-1 font-mono opacity-70">({k.count})</span>
                  </Badge>
                ))}
              </ChangesSection>
            )}
            {data.mostTargetedAssets.length > 0 && (
              <ChangesSection icon={Target} label="Most Targeted Assets" index={2}>
                {data.mostTargetedAssets.slice(0, 5).map(a => (
                  <Badge key={a.value} variant="outline" className="text-[10px] border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors cursor-default">
                    {a.value} <span className="ml-1 font-mono opacity-70">({a.count})</span>
                  </Badge>
                ))}
              </ChangesSection>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
