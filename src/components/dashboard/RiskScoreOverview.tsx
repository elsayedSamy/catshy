import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Gauge } from 'lucide-react';

export interface RiskOverviewData {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  factors: { label: string; score: number }[];
}

function riskColor(score: number): string {
  if (score >= 80) return 'text-destructive';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-accent';
}

function riskLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  if (score >= 20) return 'Low';
  return 'Minimal';
}

export function RiskScoreOverview({ data, isLoading }: { data?: RiskOverviewData; isLoading: boolean }) {
  const score = data?.overallScore ?? 0;
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="h-4 w-4 text-primary" />Risk Score
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(220, 15%, 16%)" strokeWidth="6" />
                <circle cx="50" cy="50" r="45" fill="none" stroke={score >= 80 ? 'hsl(0, 72%, 51%)' : score >= 60 ? 'hsl(25, 95%, 53%)' : score >= 40 ? 'hsl(45, 93%, 47%)' : 'hsl(160, 70%, 40%)'} strokeWidth="6" strokeDasharray={`${progress} ${circumference}`} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold font-mono ${riskColor(score)}`}>{score}</span>
                <span className="text-[10px] text-muted-foreground">{riskLabel(score)}</span>
              </div>
            </div>
            {data?.factors && data.factors.length > 0 && (
              <div className="w-full mt-3 space-y-1">
                {data.factors.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className={`font-mono ${riskColor(f.score)}`}>{f.score}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
