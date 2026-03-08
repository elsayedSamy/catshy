import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Activity, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SourceHealthItem {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'error' | 'disabled';
  last_fetch_at: string | null;
  last_success_at: string | null;
  next_fetch_at: string | null;
  consecutive_failures: number;
  backoff_seconds: number;
  last_error: string | null;
  last_fetched_count: number;
  last_new_count: number;
  last_dedup_count: number;
  total_items: number;
  ingested_in_range: number;
  failures_in_range: number;
  polling_interval_minutes: number;
}

const healthConfig: Record<string, { icon: React.ReactNode; color: string; badge: string }> = {
  healthy: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-accent" />,
    color: 'text-accent',
    badge: 'bg-accent/10 text-accent border-accent/20',
  },
  degraded: {
    icon: <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />,
    color: 'text-yellow-400',
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  error: {
    icon: <XCircle className="h-3.5 w-3.5 text-destructive" />,
    color: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  disabled: {
    icon: <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />,
    color: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function SourceHealthWidget({
  items = [],
  isLoading,
}: {
  items?: SourceHealthItem[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();
  const enabledSources = items.filter(s => s.enabled);
  const healthyCnt = enabledSources.filter(s => s.health === 'healthy').length;
  const errorCnt = enabledSources.filter(s => s.health === 'error').length;
  const degradedCnt = enabledSources.filter(s => s.health === 'degraded').length;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" />
          Source Health
          {enabledSources.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {healthyCnt}/{enabledSources.length} healthy
              {errorCnt > 0 && <span className="text-destructive ml-1">· {errorCnt} errors</span>}
              {degradedCnt > 0 && <span className="text-yellow-400 ml-1">· {degradedCnt} degraded</span>}
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => navigate('/sources')}>
          Manage <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : enabledSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Wifi className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No sources enabled.</p>
            <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => navigate('/sources')}>
              Enable sources
            </Button>
          </div>
        ) : (
          <TooltipProvider>
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[auto_1fr_80px_70px_70px_60px] gap-2 px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                <span className="w-4" />
                <span>Source</span>
                <span className="text-right">Last Fetch</span>
                <span className="text-right">Ingested</span>
                <span className="text-right">New</span>
                <span className="text-right">Fails</span>
              </div>

              {enabledSources.slice(0, 10).map(source => {
                const cfg = healthConfig[source.health] || healthConfig.disabled;
                return (
                  <Tooltip key={source.id}>
                    <TooltipTrigger asChild>
                      <div className="grid grid-cols-[auto_1fr_80px_70px_70px_60px] gap-2 items-center rounded-md px-2 py-1.5 hover:bg-secondary/20 transition-colors cursor-default">
                        {cfg.icon}
                        <span className="text-xs text-foreground truncate">{source.name}</span>
                        <span className="text-[10px] text-muted-foreground text-right font-mono">
                          {timeAgo(source.last_fetch_at)}
                        </span>
                        <span className="text-[10px] text-muted-foreground text-right font-mono">
                          {source.ingested_in_range}
                        </span>
                        <span className="text-[10px] text-accent text-right font-mono">
                          {source.last_new_count}
                        </span>
                        <span className={`text-[10px] text-right font-mono ${source.failures_in_range > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {source.failures_in_range}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      <div className="space-y-1">
                        <p className="font-medium">{source.name}</p>
                        <p>Health: <Badge variant="outline" className={`text-[9px] px-1 py-0 ${cfg.badge}`}>{source.health}</Badge></p>
                        {source.consecutive_failures > 0 && <p className="text-destructive">{source.consecutive_failures} consecutive failures</p>}
                        {source.last_error && <p className="text-destructive truncate">Error: {source.last_error}</p>}
                        {source.next_fetch_at && <p>Next fetch: {timeAgo(source.next_fetch_at)}</p>}
                        {source.backoff_seconds > 0 && <p>Backoff: {source.backoff_seconds}s</p>}
                        <p>Deduped: {source.last_dedup_count} | Total: {source.total_items}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
