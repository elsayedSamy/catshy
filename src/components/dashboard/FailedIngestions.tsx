import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, RotateCcw, Ban } from 'lucide-react';

export interface FailedIngestionItem {
  id: string;
  source_id: string;
  source_name: string;
  fetched_at: string | null;
  error_type: string;
  error_message: string;
  retry_count: number;
  max_retries: number;
  status: 'failed' | 'retrying' | 'resolved' | 'abandoned';
  created_at: string | null;
}

const statusConfig: Record<string, { icon: React.ReactNode; badge: string }> = {
  failed: {
    icon: <XCircle className="h-3.5 w-3.5 text-destructive" />,
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  retrying: {
    icon: <RefreshCw className="h-3.5 w-3.5 text-yellow-400 animate-spin" />,
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
  resolved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-accent" />,
    badge: 'bg-accent/10 text-accent border-accent/20',
  },
  abandoned: {
    icon: <Ban className="h-3.5 w-3.5 text-muted-foreground" />,
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function FailedIngestions({
  items = [],
  isLoading,
  onRetry,
  onResolve,
}: {
  items?: FailedIngestionItem[];
  isLoading: boolean;
  onRetry?: (id: string) => void;
  onResolve?: (id: string) => void;
}) {
  const failedCount = items.filter(i => i.status === 'failed').length;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Ingestion Failures
          {failedCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">
              {failedCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-accent/20 mb-2" />
            <p className="text-xs text-muted-foreground">No ingestion failures. All sources healthy.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {items.map(item => {
              const cfg = statusConfig[item.status] || statusConfig.failed;
              return (
                <div key={item.id} className="flex items-start gap-2 rounded-md border border-border bg-secondary/10 p-2">
                  <div className="mt-0.5">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{item.source_name}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${cfg.badge}`}>
                        {item.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{timeAgo(item.created_at)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {item.error_type}: {item.error_message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Retries: {item.retry_count}/{item.max_retries}
                      </span>
                      {item.status === 'failed' && (
                        <div className="flex gap-1 ml-auto">
                          {onRetry && item.retry_count < item.max_retries && (
                            <Button variant="outline" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => onRetry(item.id)}>
                              <RotateCcw className="h-2.5 w-2.5 mr-0.5" />Retry
                            </Button>
                          )}
                          {onResolve && (
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => onResolve(item.id)}>
                              Resolve
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
