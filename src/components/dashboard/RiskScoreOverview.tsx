import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Gauge } from 'lucide-react';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import { motion } from 'framer-motion';

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

function riskStroke(score: number): string {
  if (score >= 80) return 'hsl(0, 72%, 51%)';
  if (score >= 60) return 'hsl(25, 95%, 53%)';
  if (score >= 40) return 'hsl(45, 93%, 47%)';
  return 'hsl(160, 70%, 40%)';
}

function riskGlow(score: number): string {
  if (score >= 80) return 'drop-shadow(0 0 8px hsl(0 72% 51% / 0.5))';
  if (score >= 60) return 'drop-shadow(0 0 8px hsl(25 95% 53% / 0.5))';
  if (score >= 40) return 'drop-shadow(0 0 8px hsl(45 93% 47% / 0.4))';
  return 'drop-shadow(0 0 8px hsl(160 70% 40% / 0.4))';
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
  const animatedScore = useAnimatedCounter(score);
  const circumference = 2 * Math.PI * 45;
  const progress = (animatedScore / 100) * circumference;

  return (
    <Card className="widget-card rounded-xl h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="h-4 w-4 text-primary" />Risk Score
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-[160px] w-full rounded-xl" />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" style={{ filter: riskGlow(score) }}>
                <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(220, 15%, 14%)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke={riskStroke(score)}
                  strokeWidth="6"
                  strokeDasharray={`${progress} ${circumference}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold font-mono tabular-nums ${riskColor(score)}`}>{animatedScore}</span>
                <span className="text-[10px] text-muted-foreground">{riskLabel(score)}</span>
              </div>
            </div>
            {data?.factors && data.factors.length > 0 && (
              <div className="w-full mt-3 space-y-1.5">
                {data.factors.slice(0, 4).map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted-foreground">{f.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${f.score}%` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                          style={{ background: riskStroke(f.score) }}
                        />
                      </div>
                      <span className={`font-mono tabular-nums ${riskColor(f.score)}`}>{f.score}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
