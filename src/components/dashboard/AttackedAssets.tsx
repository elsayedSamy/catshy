import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target } from 'lucide-react';

export interface AttackedAssetItem {
  asset: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

const sevColors: Record<string, string> = {
  critical: 'hsl(0, 72%, 51%)',
  high: 'hsl(25, 95%, 53%)',
  medium: 'hsl(45, 93%, 47%)',
  low: 'hsl(185, 80%, 50%)',
};

export function AttackedAssets({ items = [], isLoading }: { items?: AttackedAssetItem[]; isLoading: boolean }) {
  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-destructive" />Top Attacked Assets
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No attacked assets detected yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={items.slice(0, 8)} layout="vertical" margin={{ left: 60, right: 10 }}>
              <XAxis type="number" tick={{ fill: 'hsl(215, 15%, 55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="asset" tick={{ fill: 'hsl(210, 20%, 92%)', fontSize: 10 }} tickLine={false} axisLine={false} width={55} />
              <Tooltip contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {items.slice(0, 8).map((entry, i) => (
                  <Cell key={i} fill={sevColors[entry.severity] || 'hsl(185, 80%, 50%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
