import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, ArrowRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export interface HotlistItem {
  assetValue: string;
  assetType: string;
  threatCount: number;
  topSeverity: 'critical' | 'high' | 'medium' | 'low';
  relevanceScore: number;
}

const severityColors: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
};

export function AssetHotlist({ items = [], isLoading }: { items?: HotlistItem[]; isLoading: boolean }) {
  const navigate = useNavigate();

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />My Assets Hotlist</span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => navigate('/assets')}>
            View all <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No asset threats detected yet.</p>
            <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => navigate('/assets')}>
              Add assets to monitor
            </Button>
          </div>
        ) : (
          items.slice(0, 6).map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2 transition-colors hover:bg-secondary/40">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className={`text-[10px] px-1.5 ${severityColors[item.topSeverity]}`}>
                  {item.topSeverity}
                </Badge>
                <code className="text-xs font-mono text-foreground truncate">{item.assetValue}</code>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{item.threatCount} threats</span>
                <span className="text-[10px] font-mono text-primary">{item.relevanceScore}%</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
