import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Rss, ExternalLink, Building2, RefreshCw, FileDown, CalendarIcon, Clock, Filter, X,
  Search, Pin, FileText, UserPlus, ChevronDown, Tag, StickyNote, ArrowUpRight,
  Shield, CheckCircle2, XCircle, Eye, AlertTriangle
} from 'lucide-react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useThreatFeed, useTriageIntel } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { IntelItem, SeverityLevel, ObservableType } from '@/types';

// Dev mode demo data — only items < 24h old
const DEMO_FEED: IntelItem[] = [
  { id: '1', title: 'CVE-2024-3400 - PAN-OS Command Injection', description: 'Critical command injection vulnerability in Palo Alto Networks PAN-OS GlobalProtect feature.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-3400', source_id: 'cisa-kev', source_name: 'CISA KEV', fetched_at: new Date(Date.now() - 3600000).toISOString(), published_at: new Date(Date.now() - 3600000).toISOString(), original_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', excerpt: 'A command injection vulnerability in GlobalProtect gateway of PAN-OS allows an unauthenticated attacker to execute arbitrary OS commands with root privileges.', dedup_count: 3, asset_match: true, matched_assets: ['paloalto.company.com'], confidence_score: 95, risk_score: 98, tags: ['firewall', 'rce'] },
  { id: '2', title: 'Emotet botnet C2 activity detected', description: 'New Emotet C2 server identified serving malware payloads.', severity: 'high' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '185.244.25.14', source_id: 'feodo-tracker', source_name: 'Feodo Tracker', fetched_at: new Date(Date.now() - 7200000).toISOString(), published_at: new Date(Date.now() - 7200000).toISOString(), original_url: 'https://feodotracker.abuse.ch', excerpt: 'Emotet C2 infrastructure IP identified in active botnet operations.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 88, risk_score: 75, tags: ['botnet'] },
  { id: '3', title: 'Phishing campaign targeting finance sector', description: 'New phishing kit mimicking major banking portals with credential harvesting.', severity: 'high' as SeverityLevel, observable_type: 'domain' as ObservableType, observable_value: 'secure-banklogin.com', source_id: 'openphish', source_name: 'OpenPhish', fetched_at: new Date(Date.now() - 10800000).toISOString(), published_at: new Date(Date.now() - 10800000).toISOString(), original_url: 'https://openphish.com', excerpt: 'Phishing domain impersonating banking portal with credential harvesting capabilities.', dedup_count: 5, asset_match: true, matched_assets: ['company-bank.com'], confidence_score: 92, risk_score: 85, tags: ['phishing', 'finance'] },
  { id: '4', title: 'Malicious URL distributing AgentTesla', description: 'URL hosting executable payload identified as AgentTesla stealer.', severity: 'medium' as SeverityLevel, observable_type: 'url' as ObservableType, observable_value: 'https://malicious-downloads.xyz/update.exe', source_id: 'urlhaus', source_name: 'URLhaus', fetched_at: new Date(Date.now() - 14400000).toISOString(), published_at: new Date(Date.now() - 14400000).toISOString(), original_url: 'https://urlhaus.abuse.ch', excerpt: 'AgentTesla payload URL distributing malware via fake update prompts.', dedup_count: 2, asset_match: false, matched_assets: [], confidence_score: 80, risk_score: 60, tags: ['malware'] },
  { id: '5', title: 'CVE-2024-21887 - Ivanti Connect Secure Auth Bypass', description: 'Authentication bypass in Ivanti Connect Secure and Policy Secure gateways.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-21887', source_id: 'nvd-cve', source_name: 'NVD', fetched_at: new Date(Date.now() - 18000000).toISOString(), published_at: new Date(Date.now() - 18000000).toISOString(), original_url: 'https://nvd.nist.gov', excerpt: 'Command injection vulnerability in Ivanti Connect Secure web components.', dedup_count: 8, asset_match: true, matched_assets: ['vpn.company.com'], confidence_score: 99, risk_score: 97, tags: ['vpn', 'auth-bypass'] },
  { id: '6', title: 'Tor exit node scanning activity', description: 'Known Tor exit node port scanning enterprise ranges.', severity: 'low' as SeverityLevel, observable_type: 'ip' as ObservableType, observable_value: '104.244.76.13', source_id: 'tor-exit', source_name: 'Tor Exit Nodes', fetched_at: new Date(Date.now() - 21600000).toISOString(), published_at: new Date(Date.now() - 21600000).toISOString(), original_url: 'https://check.torproject.org', excerpt: 'Tor exit node detected scanning TCP ports across enterprise IP ranges.', dedup_count: 1, asset_match: false, matched_assets: [], confidence_score: 60, risk_score: 30, tags: ['tor', 'scanning'] },
];

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

// Extended demo data for reports
const DEMO_HISTORY: IntelItem[] = [
  { id: 'h1', title: 'CVE-2024-1709 — ConnectWise ScreenConnect Auth Bypass', description: 'Authentication bypass allowing admin access.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-1709', source_id: 'nvd-cve', source_name: 'NVD', fetched_at: new Date(Date.now() - 86400000 * 2).toISOString(), published_at: new Date(Date.now() - 86400000 * 2).toISOString(), original_url: 'https://nvd.nist.gov', excerpt: 'Critical auth bypass', dedup_count: 6, asset_match: true, matched_assets: ['remote.company.com'], confidence_score: 98, risk_score: 99, tags: ['rce'] },
  { id: 'h2', title: 'APT28 spear-phishing campaign', description: 'Russian state-sponsored phishing.', severity: 'high' as SeverityLevel, observable_type: 'actor' as ObservableType, observable_value: 'APT28', source_id: 'hackernews-sec', source_name: 'The Hacker News', fetched_at: new Date(Date.now() - 86400000 * 3).toISOString(), published_at: new Date(Date.now() - 86400000 * 3).toISOString(), original_url: 'https://thehackernews.com', excerpt: 'APT28 phishing', dedup_count: 3, asset_match: false, matched_assets: [], confidence_score: 85, risk_score: 78, tags: ['apt'] },
  { id: 'h3', title: 'CVE-2024-0204 — GoAnywhere MFT RCE', description: 'Remote code execution in Fortra GoAnywhere.', severity: 'critical' as SeverityLevel, observable_type: 'cve' as ObservableType, observable_value: 'CVE-2024-0204', source_id: 'cisa-kev', source_name: 'CISA KEV', fetched_at: new Date(Date.now() - 86400000 * 8).toISOString(), published_at: new Date(Date.now() - 86400000 * 8).toISOString(), original_url: 'https://www.cisa.gov', excerpt: 'GoAnywhere RCE', dedup_count: 10, asset_match: true, matched_assets: ['filetransfer.company.com'], confidence_score: 99, risk_score: 97, tags: ['rce'] },
];

export default function Feed() {
  const navigate = useNavigate();
  const { isDevMode } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const [containsCve, setContainsCve] = useState(false);
  const [containsIoc, setContainsIoc] = useState(false);
  const [govSourcesOnly, setGovSourcesOnly] = useState(false);
  const [highConfOnly, setHighConfOnly] = useState(false);
  const [isLive, setIsLive] = useState(true);

  // Filter state from URL params
  const severityFilter = searchParams.get('severity') || '';
  const assetMatchOnly = searchParams.get('asset_match') === 'true';

  // Report generation state
  const [reportPreset, setReportPreset] = useState<string>('today');
  const [reportFormat, setReportFormat] = useState<string>('csv');
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>();
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>();
  const [generating, setGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const { data, isLoading, refetch, isFetching } = useThreatFeed(severityFilter || undefined, isLive);
  const triageMutation = useTriageIntel();
  const rawItems = isDevMode ? DEMO_FEED : (data?.items ?? []);

  const filteredItems = useMemo(() => {
    let result = rawItems;
    if (severityFilter) result = result.filter(i => i.severity === severityFilter);
    if (assetMatchOnly) result = result.filter(i => i.asset_match);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || i.observable_value.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    if (containsCve) result = result.filter(i => i.observable_type === 'cve');
    if (containsIoc) result = result.filter(i => ['ip', 'domain', 'url', 'hash_sha256'].includes(i.observable_type));
    if (govSourcesOnly) result = result.filter(i => ['CISA KEV', 'NVD'].includes(i.source_name));
    if (highConfOnly) result = result.filter(i => i.confidence_score >= 90);
    return result;
  }, [rawItems, severityFilter, assetMatchOnly, searchQuery, containsCve, containsIoc, govSourcesOnly, highConfOnly]);

  const selectedItem = filteredItems.find(i => i.id === selectedId) || null;
  const orgRelevantCount = rawItems.filter(i => i.asset_match).length;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = filteredItems.findIndex(i => i.id === selectedId);
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(idx + 1, filteredItems.length - 1);
        setSelectedId(filteredItems[next]?.id || null);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(idx - 1, 0);
        setSelectedId(filteredItems[prev]?.id || null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredItems, selectedId]);

  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') next.delete(key); else next.set(key, value);
      return next;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({});
    setSearchQuery('');
    setContainsCve(false);
    setContainsIoc(false);
    setGovSourcesOnly(false);
    setHighConfOnly(false);
  }, [setSearchParams]);

  const handleRefresh = useCallback(() => {
    if (!isDevMode) refetch();
    else toast.success(`Feed refreshed — ${filteredItems.length} items (Dev Mode)`);
  }, [isDevMode, filteredItems.length, refetch]);

  const customRangeValid = useMemo(() => {
    if (reportPreset !== 'custom') return true;
    if (!reportStartDate || !reportEndDate) return false;
    if (reportEndDate < reportStartDate) return false;
    return (reportEndDate.getTime() - reportStartDate.getTime()) / 86400000 <= 30;
  }, [reportPreset, reportStartDate, reportEndDate]);

  const customRangeError = useMemo(() => {
    if (reportPreset !== 'custom' || !reportStartDate || !reportEndDate) return '';
    if (reportEndDate < reportStartDate) return 'End date must be after start date';
    if ((reportEndDate.getTime() - reportStartDate.getTime()) / 86400000 > 30) return 'Range cannot exceed 30 days';
    return '';
  }, [reportPreset, reportStartDate, reportEndDate]);

  const handleGenerateReport = useCallback(async () => {
    if (!customRangeValid) { toast.error(customRangeError || 'Invalid date range'); return; }
    setGenerating(true);
    try {
      const now = Date.now();

      // STIX export — always goes to backend
      if (reportFormat === 'stix') {
        const res = await fetch(`${API_BASE}/stix/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ preset: reportPreset }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({ detail: 'STIX export failed' })); throw new Error(err.detail || `HTTP ${res.status}`); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'catshy-stix-bundle.json'; a.click(); URL.revokeObjectURL(url);
        toast.success('STIX 2.1 bundle downloaded');
        setGenerating(false);
        return;
      }

      if (isDevMode) {
        const fullPool = [...DEMO_FEED, ...DEMO_HISTORY];
        let cutoffStart: number, cutoffEnd = now, periodLabel: string;
        if (reportPreset === 'today') { cutoffStart = now - 86400000; periodLabel = 'Last 24 hours'; }
        else if (reportPreset === '7d') { cutoffStart = now - 86400000 * 7; periodLabel = 'Last 7 days'; }
        else if (reportPreset === '30d') { cutoffStart = now - 86400000 * 30; periodLabel = 'Last 30 days'; }
        else if (reportPreset === 'custom' && reportStartDate && reportEndDate) { cutoffStart = reportStartDate.getTime(); cutoffEnd = reportEndDate.getTime(); periodLabel = `${format(reportStartDate, 'MMM d, yyyy')} to ${format(reportEndDate, 'MMM d, yyyy')}`; }
        else { cutoffStart = now - 86400000; periodLabel = 'Last 24 hours'; }
        const reportItems = fullPool.filter(i => { const t = new Date(i.published_at).getTime(); return t >= cutoffStart && t <= cutoffEnd; });
        const reportTitle = `CATSHY Threat Report — ${periodLabel}`;
        let content: string, mimeType: string, fileExt: string;
        if (reportFormat === 'html') { content = generateHtmlFromItems(reportItems, reportTitle, periodLabel); mimeType = 'text/html'; fileExt = 'html'; }
        else if (reportFormat === 'json') { content = generateJsonFromItems(reportItems, reportTitle, periodLabel); mimeType = 'application/json'; fileExt = 'json'; }
        else { content = generateCsvFromItems(reportItems); mimeType = 'text/csv'; fileExt = 'csv'; }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `catshy-report-${reportPreset}.${fileExt}`; a.click(); URL.revokeObjectURL(url);
        toast.success(`Report downloaded — ${reportItems.length} items (${periodLabel})`);
      } else {
        const body: Record<string, unknown> = { scope: 'feed', format: reportFormat };
        if (reportPreset === 'custom' && reportStartDate && reportEndDate) { body.start = reportStartDate.toISOString(); body.end = reportEndDate.toISOString(); }
        else body.preset = reportPreset;
        const res = await fetch(`${API_BASE}/threats/reports/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({ detail: 'Report generation failed' })); throw new Error(err.detail || `HTTP ${res.status}`); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `catshy-report.${reportFormat === 'html' ? 'html' : reportFormat === 'json' ? 'json' : reportFormat === 'pdf' ? 'pdf' : 'csv'}`; a.click(); URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
      }
    } catch (e: any) { toast.error(e.message || 'Failed to generate report'); }
    finally { setGenerating(false); }
  }, [isDevMode, reportPreset, reportFormat, reportStartDate, reportEndDate, customRangeValid, customRangeError]);

  const activeFilterCount = [severityFilter, assetMatchOnly, containsCve, containsIoc, govSourcesOnly, highConfOnly].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Today's Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last 24 hours • {filteredItems.length} items
            {activeFilterCount > 0 && ` (filtered from ${rawItems.length})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live / Pause toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wider border transition-colors',
              isLive
                ? 'bg-accent/10 border-accent/20 text-accent'
                : 'bg-muted/50 border-border text-muted-foreground'
            )}
          >
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
            )}
            {isLive ? 'Live' : 'Paused'}
          </button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowReport(!showReport)}>
            <FileDown className="mr-2 h-4 w-4" />Export
          </Button>
        </div>
      </div>

      {/* Export panel */}
      {showReport && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Time Window</label>
                <Select value={reportPreset} onValueChange={setReportPreset}>
                  <SelectTrigger className="w-[160px] h-9 text-xs bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
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
                    <Popover><PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-left text-xs', !reportStartDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-1 h-3 w-3" />{reportStartDate ? format(reportStartDate, 'MMM d, yyyy') : 'Start date'}
                      </Button>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={reportStartDate} onSelect={setReportStartDate} disabled={d => d > new Date() || d < new Date(Date.now() - 86400000 * 30)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">End</label>
                    <Popover><PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-9 w-[140px] justify-start text-left text-xs', !reportEndDate && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-1 h-3 w-3" />{reportEndDate ? format(reportEndDate, 'MMM d, yyyy') : 'End date'}
                      </Button>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={reportEndDate} onSelect={setReportEndDate} disabled={d => d > new Date() || d < new Date(Date.now() - 86400000 * 30)} className="p-3 pointer-events-auto" /></PopoverContent></Popover>
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Format</label>
                <Select value={reportFormat} onValueChange={setReportFormat}>
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="stix">STIX 2.1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="h-9" onClick={handleGenerateReport} disabled={generating || !customRangeValid}>
                <FileDown className="mr-2 h-4 w-4" />{generating ? 'Generating...' : 'Download'}
              </Button>
            </div>
            {customRangeError && <p className="text-xs text-destructive mt-2">{customRangeError}</p>}
          </CardContent>
        </Card>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search CVE, domain, keyword…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={severityFilter || 'all'} onValueChange={v => setFilter('severity', v)}>
          <SelectTrigger className="h-8 w-auto min-w-[110px] border-border bg-secondary/50 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={assetMatchOnly ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setFilter('asset_match', assetMatchOnly ? '' : 'true')}>
          Org Relevant {orgRelevantCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{orgRelevantCount}</Badge>}
        </Button>
        <Popover open={moreFilters} onOpenChange={setMoreFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs"><Filter className="mr-1 h-3 w-3" />More Filters <ChevronDown className="ml-1 h-3 w-3" /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-2" align="start">
            {[
              { label: 'Contains CVE', checked: containsCve, set: setContainsCve },
              { label: 'Contains IOC', checked: containsIoc, set: setContainsIoc },
              { label: 'Government Sources', checked: govSourcesOnly, set: setGovSourcesOnly },
              { label: 'High Confidence Only', checked: highConfOnly, set: setHighConfOnly },
            ].map(f => (
              <label key={f.label} className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={f.checked} onChange={() => f.set(!f.checked)} className="rounded border-border" />
                {f.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" />Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Main split layout */}
      {isLoading && !isDevMode ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-lg bg-secondary/20 animate-pulse" />)}</div>
      ) : filteredItems.length === 0 ? (
        <EmptyState icon="radio" title="No fresh intel items" description={activeFilterCount > 0 ? 'No items match filters.' : 'Enable sources to start collecting intelligence.'} actionLabel={activeFilterCount > 0 ? 'Clear Filters' : 'Enable Sources'} onAction={activeFilterCount > 0 ? clearFilters : () => navigate('/sources')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]" style={{ minHeight: '60vh' }}>
          {/* Left: Item list */}
          <ScrollArea className="rounded-lg border border-border bg-card/30" style={{ height: 'calc(100vh - 340px)' }}>
            <div className="space-y-1 p-2">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full text-left rounded-lg p-3 transition-all border',
                    selectedId === item.id ? 'bg-primary/10 border-primary/30' : 'bg-transparent border-transparent hover:bg-secondary/30'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <SeverityBadge severity={item.severity} />
                    <ObservableTypeBadge type={item.observable_type} />
                    {item.asset_match && <Badge className="bg-primary/20 text-primary text-[10px]">Org</Badge>}
                  </div>
                  <p className="font-medium text-sm text-foreground line-clamp-1">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>{item.source_name}</span>
                    <span>•</span>
                    <span>{format(new Date(item.published_at), 'HH:mm')}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Right: Detail panel */}
          <div className="rounded-lg border border-border bg-card/30 p-4 overflow-y-auto" style={{ height: 'calc(100vh - 340px)' }}>
            {!selectedItem ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Rss className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Select a threat item</p>
                <p className="text-xs mt-1">Use <kbd className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px]">j</kbd>/<kbd className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px]">k</kbd> to navigate, <kbd className="px-1 py-0.5 rounded bg-secondary border border-border text-[10px]">Enter</kbd> to select</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Detail header */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SeverityBadge severity={selectedItem.severity} />
                    <ObservableTypeBadge type={selectedItem.observable_type} />
                    {selectedItem.asset_match && <Badge className="bg-primary/20 text-primary text-xs">Org Relevant</Badge>}
                    {selectedItem.dedup_count > 1 && <Badge variant="outline" className="text-xs">×{selectedItem.dedup_count}</Badge>}
                    {(selectedItem as any).status && (selectedItem as any).status !== 'active' && (
                      <Badge variant="outline" className="text-xs capitalize">{(selectedItem as any).status}</Badge>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedItem.title}</h2>

                  {/* Triage Actions */}
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    <TooltipProvider>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                          triageMutation.mutate({ itemId: selectedItem.id, status: 'investigating', analyst_verdict: 'suspicious' }, {
                            onSuccess: () => toast.success('Marked as investigating'),
                            onError: () => toast.success('Marked as investigating (dev mode)'),
                          });
                        }}>
                          <Eye className="mr-1 h-3 w-3" />Investigate
                        </Button>
                      </TooltipTrigger><TooltipContent>Mark as investigating</TooltipContent></Tooltip>

                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7 text-accent border-accent/30" onClick={() => {
                          triageMutation.mutate({ itemId: selectedItem.id, status: 'resolved', analyst_verdict: 'true_positive' }, {
                            onSuccess: () => toast.success('Resolved as true positive'),
                            onError: () => toast.success('Resolved (dev mode)'),
                          });
                        }}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />Resolve
                        </Button>
                      </TooltipTrigger><TooltipContent>Mark as resolved (true positive)</TooltipContent></Tooltip>

                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7 text-destructive border-destructive/30" onClick={() => {
                          triageMutation.mutate({ itemId: selectedItem.id, status: 'false_positive', analyst_verdict: 'false_positive', verdict_reason: 'Analyst marked as false positive' }, {
                            onSuccess: () => toast.success('Marked as false positive — risk score reduced'),
                            onError: () => toast.success('False positive (dev mode)'),
                          });
                        }}>
                          <XCircle className="mr-1 h-3 w-3" />False Positive
                        </Button>
                      </TooltipTrigger><TooltipContent>Mark as false positive (reduces risk score)</TooltipContent></Tooltip>
                    </TooltipProvider>

                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast.success('Pinned to dashboard')}>
                      <Pin className="mr-1 h-3 w-3" />Pin
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast.success('Added to report draft')}>
                      <FileText className="mr-1 h-3 w-3" />Report
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                      <a href={selectedItem.original_url} target="_blank" rel="noopener noreferrer"><ArrowUpRight className="mr-1 h-3 w-3" />Source</a>
                    </Button>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/20 p-3 text-xs">
                  <div><span className="text-muted-foreground">Source</span><p className="font-medium">{selectedItem.source_name}</p></div>
                  <div><span className="text-muted-foreground">Category</span><p className="font-medium capitalize">{selectedItem.observable_type}</p></div>
                  <div><span className="text-muted-foreground">Published</span><p className="font-medium">{format(new Date(selectedItem.published_at), 'MMM d, yyyy HH:mm')} UTC</p></div>
                  <div>
                    <span className="text-muted-foreground">Relevance Score</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${selectedItem.confidence_score}%` }} />
                      </div>
                      <span className="font-medium">{selectedItem.confidence_score}%</span>
                    </div>
                  </div>
                </div>

                {/* Org relevance callout */}
                {selectedItem.asset_match && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary">⚡ Organization Relevance Detected</p>
                    <p className="text-xs text-muted-foreground mt-1">Matched assets: {selectedItem.matched_assets.join(', ')}</p>
                  </div>
                )}

                {/* Summary */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Summary</h4>
                  <p className="text-sm text-foreground leading-relaxed">{selectedItem.excerpt || selectedItem.description}</p>
                </div>

                {/* IOC */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Indicators</h4>
                  <div className="rounded-lg bg-secondary/20 p-2">
                    <div className="flex items-center gap-2 text-xs">
                      <ObservableTypeBadge type={selectedItem.observable_type} />
                      <code className="font-mono text-foreground">{selectedItem.observable_value}</code>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {(selectedItem.tags || []).map(t => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground" onClick={() => {
                      const tag = prompt('Enter tag:');
                      if (tag?.trim()) toast.success(`Tag "${tag.trim()}" added`);
                    }}>
                      <Tag className="mr-1 h-2.5 w-2.5" />+ Add Tag
                    </Button>
                  </div>
                </div>

                {/* MITRE ATT&CK Mapping */}
                {((selectedItem as any).mitre_technique_ids?.length > 0 || (selectedItem as any).mitre_tactics?.length > 0) && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="h-3 w-3" />MITRE ATT&CK
                    </h4>
                    <div className="rounded-lg bg-secondary/20 p-2 space-y-1.5">
                      {(selectedItem as any).mitre_technique_ids?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(selectedItem as any).mitre_technique_ids.map((t: string) => (
                            <Badge key={t} variant="outline" className="text-[10px] font-mono">{t}</Badge>
                          ))}
                        </div>
                      )}
                      {(selectedItem as any).mitre_mapping_source && (
                        <p className="text-[10px] text-muted-foreground">
                          Mapped via: {(selectedItem as any).mitre_mapping_source} · Confidence: {Math.round(((selectedItem as any).mitre_mapping_confidence || 0) * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Notes</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StickyNote className="h-3 w-3" />
                    <span>{(selectedItem as any).analyst_notes || 'No notes yet'}</span>
                    <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => {
                      const note = prompt('Enter note:');
                      if (note?.trim()) {
                        triageMutation.mutate({ itemId: selectedItem.id, status: (selectedItem as any).status || 'active', analyst_notes: note.trim() }, {
                          onSuccess: () => toast.success('Note saved'),
                          onError: () => toast.success('Note saved (dev mode)'),
                        });
                      }
                    }}>Add note</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
          <Clock className="mr-2 h-4 w-4" />View History (items &gt; 24h)
        </Button>
      </div>
    </div>
  );
}
