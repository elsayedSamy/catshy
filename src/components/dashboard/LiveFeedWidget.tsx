import { useState, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rss, ArrowRight, Filter, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import type { IntelItem, SeverityLevel } from '@/types';

const severityStyle: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-muted text-muted-foreground border-border',
};

export const LiveFeedWidget = forwardRef<HTMLDivElement, {
  items?: IntelItem[];
  isLoading: boolean;
  onRefresh?: () => void;
}>(function LiveFeedWidget({ items = [], isLoading, onRefresh }, ref) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<SeverityLevel | 'all'>('all');
  const filtered = filter === 'all' ? items : items.filter(i => i.severity === filter);

  return (
    <Card className="border-border bg-card h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Rss className="h-4 w-4 text-primary" />Live Threat Feed
        </CardTitle>
        <div className="flex items-center gap-1">
          {(['all', 'critical', 'high', 'medium'] as const).map(f => (
            <Button key={f} variant={filter === f ? 'secondary' : 'ghost'} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
          {onRefresh && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => navigate('/feed')}>
            Full feed <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex-1">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Rss className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">No intel items yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Enable sources to start collecting intelligence.</p>
            <Button variant="outline" size="sm" className="mt-3 text-xs h-7" onClick={() => navigate('/sources')}>
              Enable sources
            </Button>
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin">
            {filtered.slice(0, 20).map(item => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/10 px-3 py-2 transition-colors hover:bg-secondary/30 cursor-pointer" onClick={() => navigate('/feed')}>
                <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 mt-0.5 ${severityStyle[item.severity]}`}>
                  {item.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{item.source_name}</span>
                    {item.asset_match && <Badge variant="outline" className="text-[9px] px-1 py-0 border-accent/30 text-accent">ASSET MATCH</Badge>}
                    <code className="text-[10px] font-mono text-muted-foreground truncate">{item.observable_value}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
