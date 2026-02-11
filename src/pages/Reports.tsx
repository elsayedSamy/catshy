import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileText, Download, Plus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Report, ReportFormat } from '@/types';

export default function Reports() {
  return (
    <FeatureGate feature="cases_reports" moduleName="Reports" description="Generate Executive PDF, Technical PDF, HTML, CSV, and JSON reports with CATSHY branding, provenance, and scoring details.">
      <ReportsContent />
    </FeatureGate>
  );
}

function ReportsContent() {
  const [reports, setReports] = useState<Report[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<ReportFormat>('technical_pdf');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    toast.info('Generating report...');
    setTimeout(() => {
      const report: Report = {
        id: crypto.randomUUID(),
        title: title || `Threat Intelligence Report — ${new Date().toLocaleDateString()}`,
        format,
        generated_at: new Date().toISOString(),
        generated_by: 'Dev Admin',
        sections: [
          { heading: 'Executive Summary', content: 'Overview of threat landscape for the reporting period.', type: 'narrative' },
          { heading: 'Key Findings', content: 'Critical vulnerabilities and active threats identified.', type: 'evidence' },
          { heading: 'Affected Assets', content: 'Assets matched against ingested intelligence.', type: 'assets' },
          { heading: 'Risk Scoring', content: 'Confidence and risk scoring breakdown.', type: 'scoring' },
          { heading: 'Recommendations', content: 'Prioritized remediation steps.', type: 'recommendations' },
        ],
      };
      setReports(prev => [report, ...prev]);
      setGenerating(false);
      setDialogOpen(false);
      setTitle('');
      toast.success('Report generated successfully');
    }, 2000);
  };

  const handleDownload = (report: Report) => {
    // Simulate download
    const content = `CATSHY Report: ${report.title}\nFormat: ${report.format}\nGenerated: ${report.generated_at}\n\n${report.sections?.map(s => `## ${s.heading}\n${s.content}`).join('\n\n') || 'No content'}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `catshy-report-${report.id.slice(0, 8)}.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground mt-1">Generate and archive threat intelligence reports</p></div>
        <Button className="glow-cyan" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Generate Report</Button>
      </div>
      {reports.length === 0 ? (
        <EmptyState icon="file" title="No Reports Generated" description="Generate reports from cases or investigations. Reports include provenance, evidence excerpts, affected assets, and scoring explainability." actionLabel="Generate Report" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="space-y-2">{reports.map(r => (
          <Card key={r.id} className="border-border bg-card"><CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-primary" /><div><p className="font-medium text-sm">{r.title}</p><p className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString()}</p></div></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs uppercase">{r.format.replace('_', ' ')}</Badge><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(r)}><Download className="h-4 w-4" /></Button></div>
          </CardContent></Card>
        ))}</div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>Create a new threat intelligence report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">Report Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly Threat Summary" className="bg-secondary/30" />
            </div>
            <div><label className="mb-1.5 block text-sm font-medium">Format</label>
              <Select value={format} onValueChange={v => setFormat(v as ReportFormat)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive_pdf">Executive PDF</SelectItem>
                  <SelectItem value="technical_pdf">Technical PDF</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating} className="glow-cyan">
              {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}