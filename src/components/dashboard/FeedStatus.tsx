import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Radio, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface FeedStatusItem {
  id: string;
  name: string;
  health: 'healthy' | 'degraded' | 'error' | 'disabled';
  lastFetch?: string;
  itemsToday: number;
}

const healthIcon = {
  healthy: <CheckCircle2 className="h-3 w-3 text-accent" />,
  degraded: <AlertTriangle className="h-3 w-3 text-yellow-400" />,
  error: <XCircle className="h-3 w-3 text-destructive" />,
  disabled: <XCircle className="h-3 w-3 text-muted-foreground" />,
};

const healthBadge: Record<string, string> = {
  healthy: 'bg-accent/10 text-accent border-accent/20',
  degraded: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  error: 'bg-destructive/10 text-destructive border-destructive/20',
  disabled: 'bg-muted text-muted-foreground border-border',
};

export function FeedStatus({ items = [], isLoading }: { items?: FeedStatusItem[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const activeCount = items.filter(i => i.health === 'healthy').length;
  const errorCount = items.filter(i => i.health === 'error').length;

  return (
    <Card className="widget-card rounded-xl h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Radio className="h-4 w-4 text-primary" />Feed Status
          {items.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {activeCount}/{items.length} active
              {errorCount > 0 && <span className="text-destructive ml-1">({errorCount} errors)</span>}
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-primary" onClick={() => navigate('/sources')}>
          Manage <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-full rounded-md" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Radio className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No feeds configured.</p>
            <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => navigate('/sources')}>
              Enable sources
            </Button>
          </div>
        ) : (
          items.slice(0, 8).map((feed, i) => (
            <motion.div
              key={feed.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/20 transition-all duration-200 group"
            >
              {healthIcon[feed.health]}
              <span className="text-xs text-foreground truncate flex-1 group-hover:text-primary transition-colors">{feed.name}</span>
              <Badge variant="outline" className={`text-[9px] px-1 py-0 ${healthBadge[feed.health]}`}>
                {feed.health}
              </Badge>
              {feed.itemsToday > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{feed.itemsToday}</span>
              )}
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
