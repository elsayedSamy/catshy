import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Rss, ExternalLink, Building2, RefreshCw, FileDown, CalendarIcon, Clock } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useThreatFeed } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { IntelItem, SeverityLevel, ObservableType } from '@/types';

const severityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

const typeOptions = [
  { value: 'ip', label: 'IP' },
  { value: 'domain', label: 'Domain' },
  { value: 'url', label: 'URL' },
  { value: 'hash_sha256', label: 'Hash' },
  { value: 'cve', label: 'CVE' },
  { value: 'email', label: 'Email' },
];

// Dev mode demo data — only items < 24h old
const DEMO_FEED: IntelItem[] = [
  { id: '1', title: 'CVE-2024-3400 - PAN-OS Command Injection', description: 'Critical command injection vulnerability in Palo Alto Networks PAN-OS GlobalProtect feature.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-3400', source_id: 'cisa-kev', source_name: 'CISA KEV', fetched_at: new Date(Date.now() - 3600000).toISOString(), published_at: new Date(Date.now() - 3600000).toISOString(), original_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', excerpt: 'A command injection vulnerability in GlobalProtect.', dedup_count: 3, asset_match: true, matched_assets: ['paloalto.company.com'], confidence_score: 95, risk_score: 98, tags: ['firewall', 'rce'] },
  { id: '2', title: 'Emotet botnet C2 activity detected', description: 'New Emotet C2 server identified serving malware payloads.', severity: 'high' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '185.244.25.14', source_id: 'feodo-tracker', source_name: 'Feodo Tracker', fetched_at: new Date(Date.now() - 7200000).toISOString(), published_at: new Date(Date.now() - 7200000).toISOString(), original_url: 'https://feodotracker.abuse.ch', excerpt: 'Emotet C2 infrastructure IP.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 88, risk_score: 75, tags: ['botnet'] },
  { id: '3', title: 'Phishing campaign targeting finance sector', description: 'New phishing kit mimicking major banking portals.', severity: 'high' as SeverityLevel, observable_type: 'domain' as ObservableType, observable_value: 'secure-banklogin.com', source_id: 'openphish', source_name: 'OpenPhish', fetched_at: new Date(Date.now() - 10800000).toISOString(), published_at: new Date(Date.now() - 10800000).toISOString(), original_url: 'https://openphish.com', excerpt: 'Phishing domain impersonating banking portal.', dedup_count: 5, asset_match: true, matched_assets: ['company-bank.com'], confidence_score: 92, risk_score: 85, tags: ['phishing', 'finance'] },
  { id: '4', title: 'Malicious URL distributing AgentTesla', description: 'URL hosting executable payload identified as AgentTesla stealer.', severity: 'medium' as SeverityLevel, observable_type: 'url' as ObservableType, observable_value: 'https://malicious-downloads.xyz/update.exe', source_id: 'urlhaus', source_name: 'URLhaus', fetched_at: new Date(Date.now() - 14400000).toISOString(), published_at: new Date(Date.now() - 14400000).toISOString(), original_url: 'https://urlhaus.abuse.ch', excerpt: 'AgentTesla payload URL.', dedup_count: 2, asset_match: false, matched_assets: [], confidence_score: 80, risk_score: 60, tags: ['malware'] },
  { id: '5', title: 'CVE-2024-21887 - Ivanti Connect Secure Auth Bypass', description: 'Authentication bypass in Ivanti Connect Secure and Policy Secure.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-21887', source_id: 'nvd-cve', source_name: 'NVD', fetched_at: new Date(Date.now() - 18000000).toISOString(), published_at: new Date(Date.now() - 18000000).toISOString(), original_url: 'https://nvd.nist.gov', excerpt: 'Command injection vulnerability in Ivanti.', dedup_count: 8, asset_match: true, matched_assets: ['vpn.company.com'], confidence_score: 99, risk_score: 97, tags: ['vpn', 'auth-bypass'] },
  { id: '6', title: 'Tor exit node scanning activity', description: 'Known Tor exit node port scanning enterprise ranges.', severity: 'low' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '104.244.76.13', source_id: 'tor-exit', source_name: 'Tor Exit Nodes', fetched_at: new Date(Date.now() - 21600000).toISOString(), published_at: new Date(Date.now() - 21600000).toISOString(), original_url: 'https://check.torproject.org', excerpt: 'Tor exit node scan activity.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 60, risk_score: 30, tags: ['tor', 'scanning'] },
];

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function Feed() {
  const navigate = useNavigate();
  const { isDevMode } = useAuth();
  const [companyFirst, setCompanyFirst] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Report generation state
  const [reportPreset, setReportPreset] = useState<string>('today');
  const [reportFormat, setReportFormat] = useState<string>('csv');
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>();
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>();
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useThreatFeed();

  const items = isDevMode ? DEMO_FEED : (data?.items ?? []);

  const handleRefresh = useCallback(() => {
    if (isDevMode) {
      setRefreshing(true);
      toast.info('Refreshing intel feed...');
      setTimeout(() => {
        setRefreshing(false);
        toast.success(`Feed refreshed — ${items.length} items`);
      }, 1200);
    } else {
      refetch();
    }
  }, [isDevMode, items.length, refetch]);

  const handleGenerateReport = useCallback(async () => {
    setGenerating(true);
    try {
      if (isDevMode) {
        // Dev mode: generate CSV locally
        const headers = ['Title', 'Severity', 'Type', 'Observable', 'Source', 'Published', 'URL', 'Asset Match', 'Risk Score'];
        const csvRows = [headers.join(',')];
        items.forEach(i => {
          csvRows.push([
            `"${i.title}"`, i.severity, i.observable_type, `"${i.observable_value}"`,
            i.source_name, i.published_at, i.original_url, i.asset_match ? 'Yes' : 'No',
            i.risk_score.toString(),
          ].join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `catshy-report-${reportPreset || 'custom'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded');
      } else {
        // Real backend: call report endpoint
        const body: Record<string, unknown> = {
          scope: 'feed',
          preset: reportPreset === 'custom' ? undefined : reportPreset,
          format: reportFormat,
        };
        if (reportPreset === 'custom' && reportStartDate && reportEndDate) {
          body.start = reportStartDate.toISOString();
          body.end = reportEndDate.toISOString();
          body.preset = undefined;
        }
        const res = await fetch(`${API_BASE}/threats/reports/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Report generation failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = reportFormat === 'html' ? 'html' : reportFormat === 'json' ? 'json' : 'csv';
        a.download = `catshy-report.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [isDevMode, items, reportPreset, reportFormat, reportStartDate, reportEndDate]);

  const displayItems = companyFirst
    ? [...items].sort((a, b) => (b.asset_match ? 1 : 0) - (a.asset_match ? 1 : 0))
    : items;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intel Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <Clock className="inline h-3 w-3 mr-1" />
            Fresh items from the last 24 hours · {items.length} items
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/history')}
          >
            <Clock className="mr-2 h-4 w-4" /> View History
          </Button>
          <Button
            variant={companyFirst ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompanyFirst(!companyFirst)}
          >
            <Building2 className="mr-2 h-4 w-4" /> Company First
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Report Generation Panel */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileDown className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">Generate Report</h3>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Time Window</label>
              <Select value={reportPreset} onValueChange={setReportPreset}>
                <SelectTrigger className="w-[160px] h-9 text-xs bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today (24h)</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportPreset === 'custom' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Start</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-left text-xs', !reportStartDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {reportStartDate ? format(reportStartDate, 'MMM d, yyyy') : 'Start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reportStartDate}
                        onSelect={setReportStartDate}
                        disabled={d => d > new Date() || d < new Date(Date.now() - 86400000 * 30)}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">End</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-left text-xs', !reportEndDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {reportEndDate ? format(reportEndDate, 'MMM d, yyyy') : 'End date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reportEndDate}
                        onSelect={setReportEndDate}
                        disabled={d => d > new Date() || d < new Date(Date.now() - 86400000 * 30)}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Format</label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger className="w-[100px] h-9 text-xs bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              className="h-9"
              onClick={handleGenerateReport}
              disabled={generating || (reportPreset === 'custom' && (!reportStartDate || !reportEndDate))}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {generating ? 'Generating...' : 'Download Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <FilterBar
        filterOptions={[
          { key: 'severity', label: 'Severity', options: severityOptions },
          { key: 'type', label: 'Type', options: typeOptions },
        ]}
        showAssetMatchToggle
      />

      {/* Items */}
      <div className="space-y-2">
        {displayItems.length === 0 && !isLoading ? (
          <EmptyState
            icon="radio"
            title="No fresh intel items"
            description="Items from the last 24 hours will appear here. Enable sources to start collecting intelligence."
            actionLabel="Enable Sources"
            onAction={() => navigate('/sources')}
          />
        ) : (
          displayItems.map(item => (
            <Card
              key={item.id}
              className={`border-border bg-card transition-all hover:border-primary/20 ${
                item.asset_match ? 'border-l-2 border-l-primary' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SeverityBadge severity={item.severity} />
                      <ObservableTypeBadge type={item.observable_type} />
                      {item.asset_match && (
                        <Badge className="bg-primary/20 text-primary text-xs">Asset Match</Badge>
                      )}
                      {item.dedup_count > 1 && (
                        <Badge variant="outline" className="text-xs">×{item.dedup_count}</Badge>
                      )}
                    </div>
                    <h3 className="font-medium text-sm text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{item.observable_value}</span>
                      <span>via {item.source_name}</span>
                      <span>{new Date(item.published_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <a href={item.original_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
