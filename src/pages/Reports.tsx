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
import { FileText, Download, Plus, Loader2, Clock, CalendarIcon, Shield, BarChart3, Briefcase, AlertTriangle, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Report, ReportFormat } from '@/types';

const REPORT_TEMPLATES = [
  { id: 'daily_brief', label: 'Daily Brief', desc: 'Last 24 hours intelligence summary', icon: Clock, preset: 'today' },
  { id: 'weekly_summary', label: 'Weekly Summary', desc: 'Last 7 days threat overview', icon: BarChart3, preset: '7d' },
  { id: 'executive_overview', label: 'Executive Overview', desc: 'High-level 1-page summary for leadership', icon: Briefcase, preset: '7d' },
  { id: 'leak_breach', label: 'Leak/Breach Report', desc: 'Credential & data exposure analysis', icon: AlertTriangle, preset: '30d' },
  { id: 'vuln_digest', label: 'Vulnerability Digest', desc: 'CVEs and vulnerability assessment', icon: Bug, preset: '7d' },
];

function generateCSV(report: Report): string {
  const lines = ['Section,Type,Content'];
  report.sections?.forEach(s => {
    lines.push(`"${s.heading}","${s.type}","${s.content.replace(/"/g, '""')}"`);
  });
  return lines.join('\n');
}

function generateJSON(report: Report): string {
  return JSON.stringify({
    title: report.title,
    generated_at: report.generated_at,
    generated_by: report.generated_by,
    format: report.format,
    sections: report.sections,
  }, null, 2);
}

function generateHTML(report: Report): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${report.title}</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a2e;background:#f4f4f8}
  h1{color:#0d1b2a;border-bottom:3px solid #00b4d8;padding-bottom:8px}
  h2{color:#1b263b;margin-top:24px}
  .meta{color:#666;font-size:13px;margin-bottom:24px}
  .section{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:16px 20px;margin-bottom:16px}
  .badge{display:inline-block;background:#00b4d8;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-right:6px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px}
  th{background:#f0f0f5}
  footer{margin-top:32px;text-align:center;font-size:11px;color:#999}
</style></head><body>
<h1>🐱 CATSHY — ${report.title}</h1>
<div class="meta">Generated: ${new Date(report.generated_at).toLocaleString()} • By: ${report.generated_by} • Format: ${report.format.toUpperCase()}</div>
${report.sections?.map(s => `<div class="section"><h2>${s.heading}</h2><span class="badge">${s.type}</span><p>${s.content}</p></div>`).join('\n') || ''}
<footer>CATSHY Threat Intelligence Platform • Confidential</footer>
</body></html>`;
}

function generatePDFHTML(report: Report): string {
  // Generate a print-optimized HTML that opens in a new tab for PDF printing
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${report.title}</title>
<style>
  @media print{@page{margin:1.5cm;size:A4}body{font-size:11pt}}
  body{font-family:'Segoe UI',system-ui,sans-serif;max-width:700px;margin:30px auto;padding:0 20px;color:#1a1a2e}
  h1{font-size:22pt;color:#0d1b2a;border-bottom:3px solid #00b4d8;padding-bottom:6px}
  h2{font-size:14pt;color:#1b263b;margin-top:20px;border-left:4px solid #00b4d8;padding-left:10px}
  .meta{color:#666;font-size:10pt;margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:8px}
  .section{margin-bottom:14px;page-break-inside:avoid}
  .badge{display:inline-block;background:#00b4d8;color:#fff;padding:1px 6px;border-radius:3px;font-size:9pt;margin-right:4px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:10pt}
  th{background:#f5f5fa;font-weight:600}
  footer{margin-top:30px;text-align:center;font-size:9pt;color:#999;border-top:1px solid #eee;padding-top:8px}
  .watermark{position:fixed;bottom:10px;right:10px;font-size:8pt;color:#ccc}
</style></head><body>
<h1>🐱 CATSHY Intelligence Report</h1>
<div class="meta">
  <strong>${report.title}</strong><br>
  Generated: ${new Date(report.generated_at).toLocaleString()}<br>
  Analyst: ${report.generated_by}<br>
  Classification: TLP:AMBER
</div>
${report.sections?.map(s => `<div class="section"><h2>${s.heading}</h2><span class="badge">${s.type}</span><p>${s.content}</p></div>`).join('\n') || ''}
<footer>CATSHY Threat Intelligence Platform — Confidential — ${new Date().getFullYear()}</footer>
<div class="watermark">CATSHY TIP v1.0</div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('daily_brief');
  const [title, setTitle] = useState('');
  const [formatVal, setFormatVal] = useState<ReportFormat>('pdf');
  const [generating, setGenerating] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [useCustomRange, setUseCustomRange] = useState(false);

  const template = REPORT_TEMPLATES.find(t => t.id === selectedTemplate);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const preset = useCustomRange ? 'custom' : (template?.preset || 'today');
      if (useCustomRange) {
        if (!customStart || !customEnd) { toast.error('Select both start and end dates'); setGenerating(false); return; }
        if (customEnd < customStart) { toast.error('End date must be after start'); setGenerating(false); return; }
      }

      const reportTitle = title || `${template?.label || 'Report'} — ${format(new Date(), 'MMM d, yyyy')}`;
      const report: Report = {
        id: crypto.randomUUID(),
        title: reportTitle,
        format: formatVal,
        generated_at: new Date().toISOString(),
        generated_by: 'Current User',
        sections: [
          { heading: 'Executive Summary', content: `Intelligence report covering period: ${preset}. This report summarizes threat landscape observations, key indicators of compromise, and recommended actions.`, type: 'narrative' },
          { heading: 'Threat Landscape', content: 'Analysis of current threat actors, campaigns, and TTPs observed during the reporting period. Key trends include increased phishing activity and ransomware campaigns targeting critical infrastructure.', type: 'narrative' },
          { heading: 'Key Indicators', content: 'Top IOCs identified: Malicious IPs, suspicious domains, and file hashes associated with active campaigns. See detailed IOC table in appendix.', type: 'evidence' },
          { heading: 'Risk Assessment', content: 'Overall risk level: MODERATE. Asset exposure has increased by 12% compared to the previous period. 3 critical vulnerabilities require immediate patching.', type: 'narrative' },
          { heading: 'Recommendations', content: '1. Update firewall rules with latest IOC blocklist\n2. Patch CVE-2024-XXXX on exposed systems\n3. Review access logs for anomalous activity\n4. Conduct phishing awareness training', type: 'recommendations' },
        ],
      };

      const slug = `catshy-${selectedTemplate}-${report.id.slice(0, 8)}`;

      switch (formatVal) {
        case 'csv':
          downloadBlob(generateCSV(report), `${slug}.csv`, 'text/csv');
          break;
        case 'json':
          downloadBlob(generateJSON(report), `${slug}.json`, 'application/json');
          break;
        case 'html':
          downloadBlob(generateHTML(report), `${slug}.html`, 'text/html');
          break;
        case 'pdf': {
          const pdfHTML = generatePDFHTML(report);
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(pdfHTML);
            win.document.close();
          } else {
            downloadBlob(generateHTML(report), `${slug}.html`, 'text/html');
            toast.info('Pop-up blocked — downloaded as HTML instead. Use browser Print → Save as PDF.');
          }
          break;
        }
      }

      setReports(prev => [report, ...prev]);
      setDialogOpen(false);
      setTitle('');
      setUseCustomRange(false);
      toast.success(`Report generated (${formatVal.toUpperCase()})`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleRedownload = (r: Report) => {
    const slug = `catshy-${r.id.slice(0, 8)}`;
    switch (r.format) {
      case 'csv': downloadBlob(generateCSV(r), `${slug}.csv`, 'text/csv'); break;
      case 'json': downloadBlob(generateJSON(r), `${slug}.json`, 'application/json'); break;
      case 'html': downloadBlob(generateHTML(r), `${slug}.html`, 'text/html'); break;
      case 'pdf': {
        const win = window.open('', '_blank');
        if (win) { win.document.write(generatePDFHTML(r)); win.document.close(); }
        else downloadBlob(generateHTML(r), `${slug}.html`, 'text/html');
        break;
      }
    }
    toast.success('Report downloaded');
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
        {reports.length === 0 ? (
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
