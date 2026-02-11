import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Rss, ExternalLink, Building2, RefreshCw, FileDown, CalendarIcon, Clock, Filter, X } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useThreatFeed } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import type { IntelItem, SeverityLevel, ObservableType } from '@/types';

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

/**
 * Generate a CSV string from IntelItem array with proper escaping.
 */
function generateCsvFromItems(items: IntelItem[]): string {
  const headers = ['Title', 'Severity', 'Observable Type', 'Observable Value', 'Source', 'Published At', 'URL', 'Asset Match', 'Risk Score', 'Confidence Score', 'Tags'];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = items.map(i => [
    escape(i.title), i.severity, i.observable_type, escape(i.observable_value),
    i.source_name, i.published_at, i.original_url, i.asset_match ? 'Yes' : 'No',
    i.risk_score.toString(), i.confidence_score.toString(), (i.tags || []).join('; '),
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate an HTML report string from IntelItem array.
 */
function generateHtmlFromItems(items: IntelItem[], title: string, period: string): string {
  const critCount = items.filter(i => i.severity === 'critical').length;
  const highCount = items.filter(i => i.severity === 'high').length;
  const medCount = items.filter(i => i.severity === 'medium').length;
  const itemRows = items.map(i =>
    `<tr><td>${i.severity.toUpperCase()}</td><td>${i.title}</td><td><code>${i.observable_value}</code></td><td>${i.source_name}</td><td>${i.published_at}</td><td>${i.asset_match ? '✓' : ''}</td></tr>`
  ).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;padding:40px}
.header{border-bottom:2px solid #00bcd4;padding-bottom:20px;margin-bottom:24px}h1{color:#e6edf3;font-size:24px}
.meta{color:#8b949e;font-size:13px;margin-top:8px}.brand{color:#00bcd4;font-weight:700;letter-spacing:2px;font-size:11px;text-transform:uppercase}
.summary{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:16px;margin:16px 0}
.summary span{margin-right:16px;font-size:14px}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{text-align:left;padding:8px;border-bottom:1px solid #21262d;font-size:13px}th{color:#e6edf3;font-weight:600}
code{background:#161b22;padding:2px 6px;border-radius:3px;font-size:12px}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #30363d;color:#484f58;font-size:11px;text-align:center}
</style></head><body>
<div class="header"><div class="brand">CATSHY — Threat Intelligence Report</div><h1>${title}</h1>
<div class="meta">Period: ${period} · Generated: ${new Date().toISOString().slice(0, 16)} UTC · Classification: TLP:AMBER</div></div>
<div class="summary"><span>Total: <strong>${items.length}</strong></span><span style="color:#f85149">Critical: <strong>${critCount}</strong></span>
<span style="color:#d29922">High: <strong>${highCount}</strong></span><span style="color:#388bfd">Medium: <strong>${medCount}</strong></span></div>
<table><thead><tr><th>Severity</th><th>Title</th><th>Observable</th><th>Source</th><th>Published</th><th>Asset</th></tr></thead><tbody>${itemRows}</tbody></table>
<div class="footer">CATSHY Threat Intelligence Platform — Confidential</div></body></html>`;
}

/**
 * Generate a JSON report string from IntelItem array.
 */
function generateJsonFromItems(items: IntelItem[], title: string, period: string): string {
  return JSON.stringify({
    title,
    metadata: { generated_at: new Date().toISOString(), period, total: items.length, classification: 'TLP:AMBER' },
    summary: {
      critical: items.filter(i => i.severity === 'critical').length,
      high: items.filter(i => i.severity === 'high').length,
      medium: items.filter(i => i.severity === 'medium').length,
      low: items.filter(i => i.severity === 'low').length,
    },
    items: items.map(i => ({
      id: i.id, title: i.title, severity: i.severity, observable_type: i.observable_type,
      observable_value: i.observable_value, source_name: i.source_name, published_at: i.published_at,
      original_url: i.original_url, asset_match: i.asset_match, risk_score: i.risk_score,
      confidence_score: i.confidence_score, tags: i.tags,
    })),
  }, null, 2);
}

export default function Feed() {
  const navigate = useNavigate();
  const { isDevMode } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state from URL params
  const severityFilter = searchParams.get('severity') || '';
  const typeFilter = searchParams.get('type') || '';
  const assetMatchOnly = searchParams.get('asset_match') === 'true';
  const [companyFirst, setCompanyFirst] = useState(false);

  // Report generation state
  const [reportPreset, setReportPreset] = useState<string>('today');
  const [reportFormat, setReportFormat] = useState<string>('csv');
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>();
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>();
  const [generating, setGenerating] = useState(false);

  // API query — passes severity filter to backend
  const { data, isLoading, refetch, isFetching } = useThreatFeed(severityFilter || undefined);

  // Build filtered items list
  const rawItems = isDevMode ? DEMO_FEED : (data?.items ?? []);

  const filteredItems = useMemo(() => {
    let result = rawItems;
    // Apply severity filter (client-side for dev mode; backend handles it in production but double-filter is safe)
    if (severityFilter) {
      result = result.filter(i => i.severity === severityFilter);
    }
    // Apply type filter (client-side)
    if (typeFilter) {
      result = result.filter(i => i.observable_type === typeFilter);
    }
    // Asset match filter
    if (assetMatchOnly) {
      result = result.filter(i => i.asset_match);
    }
    return result;
  }, [rawItems, severityFilter, typeFilter, assetMatchOnly]);

  const displayItems = companyFirst
    ? [...filteredItems].sort((a, b) => (b.asset_match ? 1 : 0) - (a.asset_match ? 1 : 0))
    : filteredItems;

  const activeFilterCount = [severityFilter, typeFilter, assetMatchOnly].filter(Boolean).length;

  // ── Filter handlers ──
  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') { next.delete(key); } else { next.set(key, value); }
      return next;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // ── Refresh handler ──
  const handleRefresh = useCallback(() => {
    if (!isDevMode) {
      refetch();
    } else {
      toast.success(`Feed refreshed — ${filteredItems.length} items (Dev Mode)`);
    }
  }, [isDevMode, filteredItems.length, refetch]);

  // ── Report generation ──
  const customRangeValid = useMemo(() => {
    if (reportPreset !== 'custom') return true;
    if (!reportStartDate || !reportEndDate) return false;
    if (reportEndDate < reportStartDate) return false;
    const diffDays = (reportEndDate.getTime() - reportStartDate.getTime()) / 86400000;
    if (diffDays > 30) return false;
    return true;
  }, [reportPreset, reportStartDate, reportEndDate]);

  const customRangeError = useMemo(() => {
    if (reportPreset !== 'custom' || !reportStartDate || !reportEndDate) return '';
    if (reportEndDate < reportStartDate) return 'End date must be after start date';
    const diffDays = (reportEndDate.getTime() - reportStartDate.getTime()) / 86400000;
    if (diffDays > 30) return 'Range cannot exceed 30 days (retention policy)';
    return '';
  }, [reportPreset, reportStartDate, reportEndDate]);

  const handleGenerateReport = useCallback(async () => {
    if (!customRangeValid) {
      toast.error(customRangeError || 'Invalid date range');
      return;
    }
    setGenerating(true);
    try {
      // Determine time window for dev mode report filtering
      const now = Date.now();
      let reportItems: IntelItem[];
      let periodLabel: string;

      if (isDevMode) {
        // Dev mode: apply time-window filter to ALL demo data (feed + history combined)
        const allDemoItems = [...DEMO_FEED];
        // Also include history-aged items for 7d/30d reports
        const DEMO_HISTORY: IntelItem[] = [
          { id: 'h1', title: 'CVE-2024-1709 — ConnectWise ScreenConnect Auth Bypass', description: 'Authentication bypass allowing admin access.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-1709', source_id: 'nvd-cve', source_name: 'NVD', fetched_at: new Date(now - 86400000 * 2).toISOString(), published_at: new Date(now - 86400000 * 2).toISOString(), original_url: 'https://nvd.nist.gov', excerpt: 'Critical auth bypass', dedup_count: 6, asset_match: true, matched_assets: ['remote.company.com'], confidence_score: 98, risk_score: 99, tags: ['rce'] },
          { id: 'h2', title: 'APT28 spear-phishing campaign', description: 'Russian state-sponsored phishing.', severity: 'high' as SeverityLevel, observable_type: 'actor' as ObservableType, observable_value: 'APT28', source_id: 'hackernews-sec', source_name: 'The Hacker News', fetched_at: new Date(now - 86400000 * 3).toISOString(), published_at: new Date(now - 86400000 * 3).toISOString(), original_url: 'https://thehackernews.com', excerpt: 'APT28 phishing', dedup_count: 3, asset_match: false, matched_assets: [], confidence_score: 85, risk_score: 78, tags: ['apt'] },
          { id: 'h3', title: 'CVE-2024-0204 — GoAnywhere MFT RCE', description: 'Remote code execution in Fortra GoAnywhere.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-0204', source_id: 'cisa-kev', source_name: 'CISA KEV', fetched_at: new Date(now - 86400000 * 8).toISOString(), published_at: new Date(now - 86400000 * 8).toISOString(), original_url: 'https://www.cisa.gov', excerpt: 'GoAnywhere RCE', dedup_count: 10, asset_match: true, matched_assets: ['filetransfer.company.com'], confidence_score: 99, risk_score: 97, tags: ['rce'] },
          { id: 'h4', title: 'DDoS botnet targeting financial services', description: 'Mirai variant targeting finance.', severity: 'medium' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '203.0.113.42', source_id: 'feodo-tracker', source_name: 'Feodo Tracker', fetched_at: new Date(now - 86400000 * 12).toISOString(), published_at: new Date(now - 86400000 * 12).toISOString(), original_url: 'https://feodotracker.abuse.ch', excerpt: 'Mirai C2', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 75, risk_score: 55, tags: ['botnet'] },
        ];
        const fullPool = [...allDemoItems, ...DEMO_HISTORY];

        let cutoffStart: number;
        let cutoffEnd: number = now;

        if (reportPreset === 'today') {
          cutoffStart = now - 86400000;
          periodLabel = 'Last 24 hours';
        } else if (reportPreset === '7d') {
          cutoffStart = now - 86400000 * 7;
          periodLabel = 'Last 7 days';
        } else if (reportPreset === '30d') {
          cutoffStart = now - 86400000 * 30;
          periodLabel = 'Last 30 days';
        } else if (reportPreset === 'custom' && reportStartDate && reportEndDate) {
          cutoffStart = reportStartDate.getTime();
          cutoffEnd = reportEndDate.getTime();
          periodLabel = `${format(reportStartDate, 'MMM d, yyyy')} to ${format(reportEndDate, 'MMM d, yyyy')}`;
        } else {
          cutoffStart = now - 86400000;
          periodLabel = 'Last 24 hours';
        }

        reportItems = fullPool.filter(i => {
          const pubTime = new Date(i.published_at).getTime();
          return pubTime >= cutoffStart && pubTime <= cutoffEnd;
        });

        // Generate file based on selected format
        const reportTitle = `CATSHY Threat Report — ${periodLabel}`;
        let content: string;
        let mimeType: string;
        let fileExt: string;

        if (reportFormat === 'html') {
          content = generateHtmlFromItems(reportItems, reportTitle, periodLabel);
          mimeType = 'text/html';
          fileExt = 'html';
        } else if (reportFormat === 'json') {
          content = generateJsonFromItems(reportItems, reportTitle, periodLabel);
          mimeType = 'application/json';
          fileExt = 'json';
        } else {
          content = generateCsvFromItems(reportItems);
          mimeType = 'text/csv';
          fileExt = 'csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `catshy-report-${reportPreset}.${fileExt}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Report downloaded — ${reportItems.length} items (${periodLabel})`);
      } else {
        // Production: call backend report endpoint with auth
        const body: Record<string, unknown> = {
          scope: 'feed',
          format: reportFormat,
        };
        if (reportPreset === 'custom' && reportStartDate && reportEndDate) {
          body.start = reportStartDate.toISOString();
          body.end = reportEndDate.toISOString();
        } else {
          body.preset = reportPreset;
        }

        const token = localStorage.getItem('catshy_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token && token !== 'dev-token') {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/threats/reports/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Report generation failed' }));
          throw new Error(err.detail || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = reportFormat === 'html' ? 'html' : reportFormat === 'json' ? 'json' : 'csv';
        a.download = `catshy-report.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [isDevMode, reportPreset, reportFormat, reportStartDate, reportEndDate, customRangeValid, customRangeError]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intel Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <Clock className="inline h-3 w-3 mr-1" />
            Fresh items from the last 24 hours · {filteredItems.length} items
            {activeFilterCount > 0 && ` (filtered from ${rawItems.length})`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
            <Clock className="mr-2 h-4 w-4" /> View History
          </Button>
          <Button
            variant={companyFirst ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCompanyFirst(!companyFirst)}
          >
            <Building2 className="mr-2 h-4 w-4" /> Company First
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
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
              disabled={generating || !customRangeValid}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {generating ? 'Generating...' : 'Download Report'}
            </Button>
          </div>
          {customRangeError && (
            <p className="text-xs text-destructive mt-2">{customRangeError}</p>
          )}
        </CardContent>
      </Card>

      {/* Filters — fully wired to data */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={severityFilter || 'all'} onValueChange={v => setFilter('severity', v)}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] border-border bg-secondary/50 text-xs">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter || 'all'} onValueChange={v => setFilter('type', v)}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] border-border bg-secondary/50 text-xs">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="ip">IP</SelectItem>
            <SelectItem value="domain">Domain</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            <SelectItem value="hash_sha256">Hash</SelectItem>
            <SelectItem value="cve">CVE</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="actor">Actor</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={assetMatchOnly ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setFilter('asset_match', assetMatchOnly ? '' : 'true')}
        >
          Company Match
        </Button>
        {activeFilterCount > 0 && (
          <>
            <Badge variant="secondary" className="text-xs">{activeFilterCount} active</Badge>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          </>
        )}
      </div>

      {/* Items */}
      {isLoading && !isDevMode ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 w-full rounded-lg bg-secondary/20 animate-pulse" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <EmptyState
          icon="radio"
          title="No fresh intel items"
          description={activeFilterCount > 0
            ? 'No items match the current filters. Try adjusting or clearing filters.'
            : 'Items from the last 24 hours will appear here. Enable sources to start collecting intelligence.'}
          actionLabel={activeFilterCount > 0 ? 'Clear Filters' : 'Enable Sources'}
          onAction={activeFilterCount > 0 ? clearFilters : () => navigate('/sources')}
        />
      ) : (
        <div className="space-y-2">
          {displayItems.map(item => (
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
          ))}
        </div>
      )}
    </div>
  );
}
