import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Bell, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface RecentAlert {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  triggered_at: string;
  status: 'new' | 'acknowledged' | 'resolved';
}

const sevStyle: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
};

const statusStyle: Record<string, string> = {
  new: 'bg-destructive/10 text-destructive',
  acknowledged: 'bg-yellow-500/10 text-yellow-400',
  resolved: 'bg-accent/10 text-accent',
};

export function RecentAlerts({ items = [], isLoading }: { items?: RecentAlert[]; isLoading: boolean }) {
  const navigate = useNavigate();

  return (
    <Card className="widget-card rounded-xl h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bell className="h-4 w-4 text-destructive" />Recent Alerts
          {items.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 border-destructive/30 text-destructive ml-1">
              {items.length}
            </Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-primary" onClick={() => navigate('/alerts')}>
          View all <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No alerts triggered yet.</p>
          </div>
        ) : (
          items.slice(0, 5).map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/10 px-2.5 py-1.5 hover:bg-secondary/25 transition-all duration-200 cursor-pointer group"
              onClick={() => navigate('/alerts')}
            >
              <Badge variant="outline" className={`text-[10px] px-1 shrink-0 ${sevStyle[alert.severity]}`}>
                {alert.severity}
              </Badge>
              <span className="text-xs text-foreground truncate flex-1 group-hover:text-primary transition-colors">{alert.title}</span>
              <Badge className={`text-[9px] px-1 py-0 ${statusStyle[alert.status]}`}>{alert.status}</Badge>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
