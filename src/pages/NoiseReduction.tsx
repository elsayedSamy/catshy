import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { useNoiseStats, useSuppressedItems, useRunNoiseReduction, useRestoreItem } from '@/hooks/useApi';
import { ShieldOff, Play, RotateCcw, Volume2, VolumeX, TrendingDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-muted text-muted-foreground',
};

export default function NoiseReduction() {
  const [threshold, setThreshold] = useState([70]);
  const { data: stats } = useNoiseStats();
  const { data: suppressed } = useSuppressedItems(100);
  const runNoise = useRunNoiseReduction();
  const restoreItem = useRestoreItem();

  const handleRun = () => {
    runNoise.mutate(threshold[0], {
      onSuccess: (data) => toast.success(`تم تحليل ${data.total} عنصر — تم كتم ${data.suppressed}`),
      onError: () => toast.error('فشل تشغيل محرك تقليل الضوضاء'),
    });
  };

  const handleRestore = (id: string) => {
    restoreItem.mutate(id, {
      onSuccess: () => toast.success('تم استعادة العنصر'),
    });
  };

  const mockStats = stats || { active_items: 342, suppressed_items: 89, noise_ratio: 20.6, top_noise_sources: [{ source: 'AlienVault OTX', count: 34 }, { source: 'Abuse.ch', count: 22 }, { source: 'PhishTank', count: 18 }] };
  const mockSuppressed = suppressed || [
    { id: '1', title: 'Suspicious IP scanning activity detected', severity: 'info', source_name: 'AlienVault OTX', observable_type: 'ip', observable_value: '192.168.1.1', noise_score: 85, top_signal: { benign_classification: 0.9, low_relevance: 0.8 }, fetched_at: new Date().toISOString() },
    { id: '2', title: 'Known CDN IP flagged by automated scan', severity: 'low', source_name: 'Abuse.ch', observable_type: 'ip', observable_value: '104.16.0.0', noise_score: 78, top_signal: { benign_classification: 1.0, duplicate_density: 0.5 }, fetched_at: new Date().toISOString() },
    { id: '3', title: 'Stale phishing domain report from 2024', severity: 'medium', source_name: 'PhishTank', observable_type: 'domain', observable_value: 'old-phish.example.com', noise_score: 72, top_signal: { staleness: 0.9, feedback_pattern: 0.6 }, fetched_at: new Date().toISOString() },
  ];

  const getTopSignal = (signals: Record<string, number>) => {
    const top = Object.entries(signals).sort(([, a], [, b]) => b - a)[0];
    if (!top) return null;
    const labels: Record<string, string> = {
      source_fp_rate: 'مصدر غير موثوق',
      staleness: 'بيانات قديمة',
      duplicate_density: 'تكرار كثير',
      benign_classification: 'IOC آمن',
      low_relevance: 'غير مرتبط بالأصول',
      feedback_pattern: 'نمط FP متكرر',
    };
    return labels[top[0]] || top[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <VolumeX className="h-6 w-6 text-primary" />
            Smart Noise Reduction
          </h1>
          <p className="text-muted-foreground mt-1">تقليل الضوضاء الذكي — فلترة التنبيهات غير المفيدة تلقائياً</p>
        </div>
        <Button onClick={handleRun} disabled={runNoise.isPending} className="gap-2">
          <Play className="h-4 w-4" />
          {runNoise.isPending ? 'جاري التحليل...' : 'تشغيل الفلترة'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تنبيهات نشطة</p>
                <p className="text-2xl font-bold text-foreground">{mockStats.active_items}</p>
              </div>
              <Volume2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تم كتمها</p>
                <p className="text-2xl font-bold text-orange-400">{mockStats.suppressed_items}</p>
              </div>
              <VolumeX className="h-8 w-8 text-orange-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">نسبة الضوضاء</p>
                <p className="text-2xl font-bold text-foreground">{mockStats.noise_ratio}%</p>
              </div>
              <TrendingDown className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">حد الكتم: {threshold[0]}%</p>
            <Slider value={threshold} onValueChange={setThreshold} min={30} max={95} step={5} className="mt-3" />
          </CardContent>
        </Card>
      </div>

      {/* Top Noise Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {mockStats.top_noise_sources.map((src, i) => (
          <Card key={i} className="border-border/50 bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-sm font-medium text-foreground">{src.source}</p>
                  <p className="text-xs text-muted-foreground">أكثر مصدر ضوضاء</p>
                </div>
              </div>
              <Badge variant="outline" className="text-orange-400 border-orange-500/30">{src.count} مكتوم</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suppressed Items Table */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <ShieldOff className="h-5 w-5" />
            العناصر المكتومة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-muted-foreground">العنوان</TableHead>
                <TableHead className="text-muted-foreground">الخطورة</TableHead>
                <TableHead className="text-muted-foreground">المصدر</TableHead>
                <TableHead className="text-muted-foreground">IOC</TableHead>
                <TableHead className="text-muted-foreground">درجة الضوضاء</TableHead>
                <TableHead className="text-muted-foreground">السبب</TableHead>
                <TableHead className="text-muted-foreground">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockSuppressed.map((item) => (
                <TableRow key={item.id} className="border-border/30 hover:bg-muted/30">
                  <TableCell className="text-foreground font-medium max-w-[250px] truncate">{item.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SEVERITY_COLORS[item.severity] || ''}>{item.severity}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.source_name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">{item.observable_value}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-400"
                          style={{ width: `${item.noise_score || 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{item.noise_score}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {getTopSignal(item.top_signal) || 'غير محدد'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => handleRestore(item.id)} className="gap-1 text-xs">
                      <RotateCcw className="h-3 w-3" />
                      استعادة
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {mockSuppressed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    لا توجد عناصر مكتومة حالياً
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
