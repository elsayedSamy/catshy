import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ListChecks, ArrowRight, Flag, XCircle, VolumeX, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { IntelItem, SeverityLevel } from '@/types';
import { useCreateCase } from '@/hooks/useApi';
import { toast } from '@/hooks/use-toast';

const sevStyle: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-muted text-muted-foreground border-border',
};

export function TriageQueue({ items = [], isLoading }: { items?: IntelItem[]; isLoading: boolean }) {
  const navigate = useNavigate();
  const createCase = useCreateCase();

  // Sort by asset relevance + risk score
  const sorted = [...items]
    .sort((a, b) => {
      if (a.asset_match !== b.asset_match) return a.asset_match ? -1 : 1;
      return (b.risk_score ?? 0) - (a.risk_score ?? 0);
    })
    .slice(0, 15);

  const handleCreateCase = async (item: IntelItem) => {
    try {
      await createCase.mutateAsync({
        title: `Triage: ${item.title}`,
        description: `Auto-created from triage queue. IOC: ${item.observable_value}`,
        priority: item.severity === 'critical' || item.severity === 'high' ? 'high' : 'medium',
      });
      toast({ title: 'Case created', description: `Case created for "${item.title}"` });
    } catch {
      toast({ title: 'Error', description: 'Failed to create case', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-primary" />Triage Queue
          {sorted.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 border-primary/30 text-primary ml-1">
              {sorted.length}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => navigate('/feed')}>
          Full feed <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-sm text-muted-foreground">No items to triage.</p>
            <p className="text-xs text-muted-foreground mt-1">Enable sources and add assets to populate the queue.</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[360px] overflow-y-auto scrollbar-thin">
            {sorted.map(item => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/10 px-2 py-1.5 transition-colors hover:bg-secondary/30 group">
                <Badge variant="outline" className={`text-[10px] px-1 shrink-0 ${sevStyle[item.severity]}`}>
                  {item.severity}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[10px] font-mono text-muted-foreground truncate">{item.observable_value}</code>
                    {item.asset_match && <Badge variant="outline" className="text-[9px] px-1 py-0 border-accent/30 text-accent">MATCH</Badge>}
                    <span className="text-[10px] text-muted-foreground">R:{item.risk_score ?? 0}</span>
                    <span className="text-[10px] text-muted-foreground">C:{Math.round((item.confidence_score ?? 0) * 100)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Create Case" onClick={() => handleCreateCase(item)}>
                    <Flag className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Enrich" onClick={() => navigate(`/search?q=${encodeURIComponent(item.observable_value)}`)}>
                    <Search className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
