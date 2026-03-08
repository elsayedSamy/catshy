import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Shield, TrendingUp, TrendingDown, AlertTriangle, Target, Activity,
  FileText, Download, BarChart3, Layers, Radar, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

const RISK_COLORS: Record<string, string> = {
  critical: 'text-destructive',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-primary',
};

const PIE_COLORS = ['hsl(0, 72%, 63%)', 'hsl(30, 90%, 55%)', 'hsl(45, 90%, 55%)', 'hsl(200, 80%, 55%)', 'hsl(210, 15%, 55%)'];

export default function ExecutiveDashboard() {
  const [period, setPeriod] = useState('7d');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['executive-summary', period],
    queryFn: () => api.get<any>(`/dashboard/executive/summary?range=${period}`),
    retry: 1,
  });

  const { data: topRisks } = useQuery({
    queryKey: ['executive-top-risks', period],
    queryFn: () => api.get<any[]>(`/dashboard/executive/top-risks?range=${period}&limit=5`),
    retry: 1,
  });

  const { data: sourcePerf } = useQuery({
    queryKey: ['executive-sources', period],
    queryFn: () => api.get<any[]>(`/dashboard/executive/source-performance?range=${period}`),
    retry: 1,
  });

  const generateReport = useMutation({
    mutationFn: (type: string) => api.post<any>(`/dashboard/reports/generate?report_type=${type}&format=json`),
    onSuccess: () => toast.success('تم إنشاء التقرير بنجاح'),
    onError: () => toast.error('فشل إنشاء التقرير'),
  });

  const s = summary || {
    risk_level: 'medium', risk_score: 42, total_threats: 0, threats_delta_pct: 0,
    critical_count: 0, high_count: 0, asset_matches: 0, active_sources: 0,
    mitre_mapped: 0, severity_distribution: {}, ioc_type_breakdown: [], daily_trend: [],
  };

  const sevData = Object.entries(s.severity_distribution || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Executive Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">ملخص تنفيذي للمخاطر والتهديدات</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px] h-8 text-xs bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 ساعة</SelectItem>
              <SelectItem value="7d">7 أيام</SelectItem>
              <SelectItem value="30d">30 يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="gap-1 text-xs"
            onClick={() => generateReport.mutate(period === '24h' ? 'daily' : period === '7d' ? 'weekly' : 'executive')}>
            <FileText className="h-3 w-3" />
            تقرير
          </Button>
        </div>
      </div>

      {/* Risk Score Hero */}
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col items-center">
              <div className="relative">
                <svg viewBox="0 0 120 120" className="w-32 h-32">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle cx="60" cy="60" r="52" fill="none"
                    stroke={s.risk_score >= 75 ? 'hsl(0,72%,63%)' : s.risk_score >= 50 ? 'hsl(30,90%,55%)' : s.risk_score >= 25 ? 'hsl(45,90%,55%)' : 'hsl(142,70%,45%)'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${s.risk_score * 3.27} 327`}
                    transform="rotate(-90 60 60)" />
                  <text x="60" y="55" textAnchor="middle" fill="hsl(var(--foreground))" className="text-3xl font-bold" fontSize="28">{s.risk_score}</text>
                  <text x="60" y="75" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">Risk Score</text>
                </svg>
              </div>
              <Badge variant="outline" className={`mt-2 capitalize ${RISK_COLORS[s.risk_level] || ''}`}>{s.risk_level}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 md:col-span-2">
              {[
                { label: 'إجمالي التهديدات', value: s.total_threats, delta: s.threats_delta_pct, icon: Activity },
                { label: 'حرجة', value: s.critical_count, icon: AlertTriangle, color: 'text-destructive' },
                { label: 'عالية', value: s.high_count, icon: Shield, color: 'text-orange-400' },
                { label: 'أصول مستهدفة', value: s.asset_matches, icon: Target, color: 'text-yellow-400' },
              ].map((kpi) => (
                <div key={kpi.label} className="flex items-center gap-3 rounded-lg bg-secondary/20 p-3 border border-border/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50 border border-border">
                    <kpi.icon className={`h-5 w-5 ${kpi.color || 'text-primary'}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground font-mono">{isLoading ? '—' : kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  </div>
                  {kpi.delta !== undefined && (
                    <div className={`ml-auto flex items-center gap-0.5 text-xs ${kpi.delta >= 0 ? 'text-destructive' : 'text-green-400'}`}>
                      {kpi.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(kpi.delta)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart */}
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> اتجاه التهديدات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.daily_trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={s.daily_trend}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#trendGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">لا توجد بيانات</div>
            )}
          </CardContent>
        </Card>

        {/* Severity Pie */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> توزيع الخطورة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sevData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sevData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {sevData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">لا توجد بيانات</div>
            )}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {sevData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground capitalize">{d.name}: {d.value as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Risks */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> أعلى المخاطر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(topRisks || []).slice(0, 5).map((item: any, i: number) => (
              <div key={item.id || i} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/10 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10 text-destructive font-bold text-sm font-mono">
                  {item.risk_score}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5">{item.severity}</Badge>
                    <span className="text-[10px] text-muted-foreground">{item.source_name}</span>
                    {item.asset_match && <Badge variant="outline" className="text-[9px] px-1 border-accent/30 text-accent">ASSET</Badge>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
            {(!topRisks || topRisks.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد تهديدات في هذه الفترة</p>
            )}
          </CardContent>
        </Card>

        {/* Source Performance */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" /> أداء المصادر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(sourcePerf || []).slice(0, 5).map((src: any, i: number) => (
              <div key={src.id || i} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/10 p-3">
                <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  src.health === 'healthy' ? 'bg-green-400' : src.health === 'degraded' ? 'bg-yellow-400' : src.health === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{src.name}</p>
                  <p className="text-[10px] text-muted-foreground">{src.items_collected} items · {src.match_rate}% match rate</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-bold text-foreground">{src.asset_matches}</p>
                  <p className="text-[9px] text-muted-foreground">matches</p>
                </div>
              </div>
            ))}
            {(!sourcePerf || sourcePerf.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد مصادر نشطة</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Reports */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> تقارير سريعة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: 'daily', label: 'تقرير يومي', desc: 'ملخص آخر 24 ساعة', icon: '📋' },
              { type: 'weekly', label: 'تقرير أسبوعي', desc: 'ملخص آخر 7 أيام', icon: '📊' },
              { type: 'executive', label: 'تقرير تنفيذي', desc: 'نظرة شاملة 30 يوم', icon: '📈' },
            ].map(r => (
              <button key={r.type} onClick={() => generateReport.mutate(r.type)}
                disabled={generateReport.isPending}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/10 p-4 hover:bg-secondary/30 transition-colors text-left">
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground ml-auto" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
