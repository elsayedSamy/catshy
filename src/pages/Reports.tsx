import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Download, Plus, Loader2, Clock, CalendarIcon, BarChart3, Briefcase, AlertTriangle, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useReports, useGenerateReport } from '@/hooks/useApi';

import { api } from '@/lib/api';
import type { Report, ReportFormat } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const REPORT_TEMPLATES = [
  { id: 'daily_brief', label: 'Daily Brief', desc: 'Last 24 hours intelligence summary', icon: Clock, preset: 'today' },
  { id: 'weekly_summary', label: 'Weekly Summary', desc: 'Last 7 days threat overview', icon: BarChart3, preset: '7d' },
  { id: 'executive_overview', label: 'Executive Overview', desc: 'High-level 1-page summary for leadership', icon: Briefcase, preset: '7d' },
  { id: 'leak_breach', label: 'Leak/Breach Report', desc: 'Credential & data exposure analysis', icon: AlertTriangle, preset: '30d' },
  { id: 'vuln_digest', label: 'Vulnerability Digest', desc: 'CVEs and vulnerability assessment', icon: Bug, preset: '7d' },
];


export default function Reports() {
  
  const { data: apiReports = [], isLoading } = useReports();
  const generateReport = useGenerateReport();

  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('daily_brief');
  const [title, setTitle] = useState('');
  const [formatVal, setFormatVal] = useState<ReportFormat>('pdf');
  const [generating, setGenerating] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [useCustomRange, setUseCustomRange] = useState(false);

  const template = REPORT_TEMPLATES.find(t => t.id === selectedTemplate);
  const reports = apiReports;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      if (useCustomRange) {
        if (!customStart || !customEnd) { toast.error('Select both start and end dates'); setGenerating(false); return; }
        if (customEnd < customStart) { toast.error('End date must be after start'); setGenerating(false); return; }
      }

      await generateReport.mutateAsync({
        case_id: selectedTemplate,
        format: formatVal === 'pdf' ? 'technical_pdf' : formatVal,
      });
      toast.success(`Report generated (${formatVal.toUpperCase()})`);
      setDialogOpen(false);
      setTitle('');
      setUseCustomRange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleRedownload = async (r: Report) => {
    try {
      const res = await fetch(`${API_BASE}/reports/${r.id}/download`, { credentials: 'include' });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `catshy-${r.id.slice(0, 8)}.${r.format}`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded');
        return;
      }
      toast.error('Failed to download report');
    } catch {
      toast.error('Failed to download report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate and download threat intelligence reports in PDF, CSV, JSON, or HTML</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="glow-cyan"><Plus className="mr-2 h-4 w-4" />New Report</Button>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Report Templates</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {REPORT_TEMPLATES.map(t => {
            const Icon = t.icon;
            return (
              <Card key={t.id} className="border-border bg-card hover:border-primary/20 transition-all cursor-pointer" onClick={() => { setSelectedTemplate(t.id); setDialogOpen(true); }}>
                <CardContent className="p-4 text-center">
                  <Icon className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{t.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Reports</h3>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : reports.length === 0 ? (
          <EmptyState icon="file" title="No Reports Yet" description="Generate reports from templates or create custom reports with specific date ranges." actionLabel="Generate Report" onAction={() => setDialogOpen(true)} />
        ) : (
          <div className="space-y-2">{reports.map(r => (
            <Card key={r.id} className="border-border bg-card">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-sm text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString()} • by {r.generated_by}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Final</Badge>
                  <Badge variant="outline" className="text-xs uppercase">{r.format}</Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRedownload(r)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>Create a new threat intelligence report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>{REPORT_TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {template && <p className="text-xs text-muted-foreground mt-1">{template.desc}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title (optional)</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={template?.label} className="bg-secondary/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Format</label>
              <Select value={formatVal} onValueChange={v => setFormatVal(v as ReportFormat)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF (Print-to-PDF)</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={useCustomRange} onChange={() => setUseCustomRange(!useCustomRange)} className="rounded border-border" />
                Custom date range
              </label>
              {useCustomRange && (
                <div className="flex gap-2 mt-2">
                  <Popover><PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-xs', !customStart && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />{customStart ? format(customStart, 'MMM d') : 'Start'}
                    </Button>
                  </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customStart} onSelect={setCustomStart} disabled={d => d > new Date() || d < new Date(Date.now() - 86400000 * 30)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                  <Popover><PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-xs', !customEnd && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1 h-3 w-3" />{customEnd ? format(customEnd, 'MMM d') : 'End'}
                    </Button>
                  </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} disabled={d => d > new Date() || d < new Date(Date.now() - 86400000 * 30)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating} className="glow-cyan">
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : 'Generate & Download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
