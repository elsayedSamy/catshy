import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export interface IngestionRateData {
  timeline: { time: string; ingested: number; failed: number }[];
  total_ingested: number;
  total_failed: number;
  rate_per_hour: number;
}

export function IngestionRateWidget({
  data,
  isLoading,
}: {
  data?: IngestionRateData;
  isLoading: boolean;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />
          Ingestion Rate
        </CardTitle>
        {data && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground">
              <span className="text-foreground font-mono font-medium">{data.rate_per_hour}</span>/hr
            </span>
            <span className="text-muted-foreground">
              Total: <span className="text-foreground font-mono">{data.total_ingested}</span>
            </span>
            {data.total_failed > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {data.total_failed} failed
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading || !data ? (
          <Skeleton className="h-[160px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data.timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ingested-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="failed-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
              />
              <Area type="monotone" dataKey="ingested" stroke="hsl(var(--primary))" fill="url(#ingested-grad)" strokeWidth={2} />
              <Area type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" fill="url(#failed-grad)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
