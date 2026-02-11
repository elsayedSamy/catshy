import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Report } from '@/types';

export default function Reports() {
  return (
    <FeatureGate feature="cases_reports" moduleName="Reports" description="Generate Executive PDF, Technical PDF, HTML, CSV, and JSON reports with CATSHY branding, provenance, and scoring details.">
      <ReportsContent />
    </FeatureGate>
  );
}

function ReportsContent() {
  const [reports] = useState<Report[]>([]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Reports</h1><p className="text-sm text-muted-foreground mt-1">Generate and archive threat intelligence reports</p></div>
        <Button className="glow-cyan"><Plus className="mr-2 h-4 w-4" />Generate Report</Button>
      </div>
      {reports.length === 0 ? (
        <EmptyState icon="file" title="No Reports Generated" description="Generate reports from cases or investigations. Reports include provenance, evidence excerpts, affected assets, and scoring explainability." actionLabel="Create a Case First" onAction={() => window.location.href = '/cases'} />
      ) : (
        <div className="space-y-2">{reports.map(r => (
          <Card key={r.id} className="border-border bg-card"><CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-primary" /><div><p className="font-medium text-sm">{r.title}</p><p className="text-xs text-muted-foreground">{new Date(r.generated_at).toLocaleString()}</p></div></div>
            <div className="flex items-center gap-2"><Badge variant="outline" className="text-xs uppercase">{r.format.replace('_', ' ')}</Badge><Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button></div>
          </CardContent></Card>
        ))}</div>
      )}
    </div>
  );
}
