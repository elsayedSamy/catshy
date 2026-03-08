import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface TimelinePoint {
  time: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function ThreatTimeline({ data, isLoading }: { data?: TimelinePoint[]; isLoading: boolean }) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-primary" />Threat Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No timeline data yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 16%)" />
              <XAxis dataKey="time" tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              <Line type="monotone" dataKey="critical" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="high" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="medium" stroke="hsl(45, 93%, 47%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="low" stroke="hsl(185, 80%, 50%)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
