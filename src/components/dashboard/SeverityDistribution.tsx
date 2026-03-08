import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ShieldAlert } from 'lucide-react';

export interface SeverityDistData {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

const COLORS: Record<string, string> = {
  Critical: 'hsl(0, 72%, 51%)',
  High: 'hsl(25, 95%, 53%)',
  Medium: 'hsl(45, 93%, 47%)',
  Low: 'hsl(185, 80%, 50%)',
  Info: 'hsl(215, 15%, 55%)',
};

export function SeverityDistribution({ data, isLoading }: { data?: SeverityDistData; isLoading: boolean }) {
  const chartData = data
    ? [
        { name: 'Critical', value: data.critical },
        { name: 'High', value: data.high },
        { name: 'Medium', value: data.medium },
        { name: 'Low', value: data.low },
        { name: 'Info', value: data.info },
      ].filter(d => d.value > 0)
    : [];

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShieldAlert className="h-4 w-4 text-primary" />Severity Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">No severity data yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" strokeWidth={0}>
                {chartData.map(entry => (
                  <Cell key={entry.name} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'hsl(220, 18%, 10%)', border: '1px solid hsl(220, 15%, 16%)', borderRadius: '8px', fontSize: '12px', color: 'hsl(210, 20%, 92%)' }}
                formatter={(value: number, name: string) => [`${value} (${Math.round((value / total) * 100)}%)`, name]}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
