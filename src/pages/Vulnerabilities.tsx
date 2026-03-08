import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/EmptyState';
import {
  ShieldAlert, Search, RefreshCw, AlertTriangle,
  CheckCircle2, Bug, ExternalLink, X, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface VulnItem {
  id: string;
  cve_id: string;
  title: string;
  description: string;
  cvss_score: number | null;
  severity: string;
  vendor: string | null;
  product: string | null;
  published_at: string | null;
  is_kev: boolean;
  kev_due_date: string | null;
  kev_ransomware_use: boolean;
  affects_assets: boolean;
  matched_asset_ids: string[];
  status: string;
  patch_available: boolean;
  tags: string[];
  source_name: string | null;
}


// API hooks for vulnerabilities
const useVulnerabilities = (params?: { severity?: string; kev_only?: boolean; assets_only?: boolean }) => {
  const sp = new URLSearchParams();
  if (params?.severity) sp.set('severity', params.severity);
  if (params?.kev_only) sp.set('kev_only', 'true');
  if (params?.assets_only) sp.set('assets_only', 'true');
  return useQuery({
    queryKey: ['vulnerabilities', params],
    queryFn: () => api.get<{ items: VulnItem[]; total: number }>(`/vulnerabilities/?${sp.toString()}`),
    retry: 1,
  });
};

const useTriageVulnerability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/vulnerabilities/${id}/triage`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vulnerabilities'] }),
  });
};

const useCorrelateAssets = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/vulnerabilities/correlate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vulnerabilities'] }),
  });
};

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-destructive/20 text-destructive border-destructive/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase', colors[severity] || colors.medium)}>{severity}</Badge>;
}

function CvssBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const color = score >= 9 ? 'text-destructive' : score >= 7 ? 'text-orange-400' : score >= 4 ? 'text-yellow-400' : 'text-muted-foreground';
  return <span className={cn('text-sm font-bold font-mono', color)}>{score.toFixed(1)}</span>;
}

export default function Vulnerabilities() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [kevOnly, setKevOnly] = useState(false);
  const [assetsOnly, setAssetsOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: apiData, isLoading } = useVulnerabilities({
    severity: severityFilter || undefined,
    kev_only: kevOnly || undefined,
    assets_only: assetsOnly || undefined,
  });
  const triageMutation = useTriageVulnerability();
  const correlateMutation = useCorrelateAssets();

  const items = apiData?.items ?? [];

  const filtered = useMemo(() => {
    let result = items;
    // In dev mode, apply client-side filters (API handles them server-side)
    if (isDevMode) {
      if (severityFilter) result = result.filter(v => v.severity === severityFilter);
      if (kevOnly) result = result.filter(v => v.is_kev);
      if (assetsOnly) result = result.filter(v => v.affects_assets);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.cve_id.toLowerCase().includes(q) || v.title.toLowerCase().includes(q) ||
        (v.vendor || '').toLowerCase().includes(q) || (v.product || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, severityFilter, kevOnly, assetsOnly, searchQuery, isDevMode]);

  const selected = filtered.find(v => v.id === selectedId) || null;
  const kevCount = items.filter(v => v.is_kev).length;
  const affectedCount = items.filter(v => v.affects_assets).length;
  const criticalCount = items.filter(v => v.severity === 'critical').length;
  const activeFilterCount = [severityFilter, kevOnly, assetsOnly].filter(Boolean).length;

  const handleTriage = (id: string, status: string) => {
    if (isDevMode) {
      toast.success(`Marked as ${status}`);
      return;
    }
    triageMutation.mutate({ id, status }, {
      onSuccess: () => toast.success(`Marked as ${status}`),
      onError: (e: any) => toast.error(e.message || 'Failed to triage'),
    });
  };

  const handleCorrelate = () => {
    if (isDevMode) {
      toast.success('Correlation triggered (dev mode)');
      return;
    }
    correlateMutation.mutate(undefined, {
      onSuccess: () => toast.success('Asset correlation completed'),
      onError: (e: any) => toast.error(e.message || 'Correlation failed'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vulnerability Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} vulnerabilities · {criticalCount} critical · {kevCount} KEV
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCorrelate} disabled={correlateMutation.isPending}>
            {correlateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Correlate Assets
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critical CVEs', value: criticalCount, icon: ShieldAlert, color: 'text-destructive' },
          { label: 'KEV This Week', value: kevCount, icon: AlertTriangle, color: 'text-orange-400' },
          { label: 'Affecting Assets', value: affectedCount, icon: Bug, color: 'text-primary' },
          { label: 'Patch Available', value: items.filter(v => v.patch_available).length, icon: CheckCircle2, color: 'text-accent' },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border bg-card/50">
            <CardContent className="p-3 flex items-center gap-3">
              <kpi.icon className={cn('h-5 w-5', kpi.color)} />
              <div>
                <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search CVE ID, vendor, product…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={severityFilter || 'all'} onValueChange={v => setSeverityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-auto min-w-[110px] border-border bg-secondary/50 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={kevOnly ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setKevOnly(!kevOnly)}>
          <AlertTriangle className="mr-1 h-3 w-3" />KEV Only
        </Button>
        <Button variant={assetsOnly ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={() => setAssetsOnly(!assetsOnly)}>
          <Bug className="mr-1 h-3 w-3" />Affecting Assets
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setSeverityFilter(''); setKevOnly(false); setAssetsOnly(false); }}>
            <X className="mr-1 h-3 w-3" />Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Main split */}
      {isLoading && !isDevMode ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="shield" title="No vulnerabilities found" description="No CVEs match your filters." actionLabel="Clear Filters"
          onAction={() => { setSeverityFilter(''); setKevOnly(false); setAssetsOnly(false); setSearchQuery(''); }} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]" style={{ minHeight: '60vh' }}>
          <ScrollArea className="rounded-lg border border-border bg-card/30" style={{ height: 'calc(100vh - 380px)' }}>
            <div className="space-y-1 p-2">
              {filtered.map(v => (
                <button key={v.id} onClick={() => setSelectedId(v.id)} className={cn(
                  'w-full text-left rounded-lg p-3 transition-all border',
                  selectedId === v.id ? 'bg-primary/10 border-primary/30' : 'bg-transparent border-transparent hover:bg-secondary/30'
                )}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <SeverityBadge severity={v.severity} />
                    <CvssBadge score={v.cvss_score} />
                    {v.is_kev && <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">KEV</Badge>}
                    {v.affects_assets && <Badge className="bg-primary/20 text-primary text-[10px]">Assets</Badge>}
                    {v.kev_ransomware_use && <Badge className="bg-destructive/20 text-destructive text-[10px]">Ransomware</Badge>}
                  </div>
                  <p className="font-medium text-sm text-foreground line-clamp-1">{v.cve_id} — {v.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>{v.vendor || 'Unknown vendor'}</span>
                    <span>•</span>
                    <span>{v.source_name}</span>
                    {v.published_at && <><span>•</span><span>{format(new Date(v.published_at), 'MMM d')}</span></>}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Detail */}
          <div className="rounded-lg border border-border bg-card/30 p-4 overflow-y-auto" style={{ height: 'calc(100vh - 380px)' }}>
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShieldAlert className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Select a vulnerability</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SeverityBadge severity={selected.severity} />
                    <CvssBadge score={selected.cvss_score} />
                    {selected.is_kev && <Badge className="bg-orange-500/20 text-orange-400 text-xs">CISA KEV</Badge>}
                    {selected.patch_available && <Badge className="bg-accent/20 text-accent text-xs">Patch Available</Badge>}
                    <Badge variant="outline" className="text-xs capitalize">{selected.status}</Badge>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{selected.cve_id}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selected.title}</p>

                  {/* Triage */}
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    <TooltipProvider>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7 text-accent border-accent/30"
                          onClick={() => handleTriage(selected.id, 'mitigated')} disabled={triageMutation.isPending}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />Mitigate
                        </Button>
                      </TooltipTrigger><TooltipContent>Mark as mitigated</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="text-xs h-7"
                          onClick={() => handleTriage(selected.id, 'accepted')}>
                          Accept Risk
                        </Button>
                      </TooltipTrigger><TooltipContent>Accept risk for this CVE</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                          <a href={`https://nvd.nist.gov/vuln/detail/${selected.cve_id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" />NVD
                          </a>
                        </Button>
                      </TooltipTrigger><TooltipContent>View on NVD</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                          <a href={`https://www.cvedetails.com/cve/${selected.cve_id}/`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1 h-3 w-3" />CVE Details
                          </a>
                        </Button>
                      </TooltipTrigger><TooltipContent>View on CVE Details</TooltipContent></Tooltip>
                      {selected.is_kev && (
                        <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                            <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" />CISA KEV
                            </a>
                          </Button>
                        </TooltipTrigger><TooltipContent>View CISA KEV Catalog</TooltipContent></Tooltip>
                      )}
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                          <a href={`https://www.google.com/search?q=${selected.cve_id}+exploit+advisory`} target="_blank" rel="noopener noreferrer">
                            <Search className="mr-1 h-3 w-3" />Search
                          </a>
                        </Button>
                      </TooltipTrigger><TooltipContent>Search for advisories & exploits</TooltipContent></Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/20 p-3 text-xs">
                  <div><span className="text-muted-foreground">Vendor</span><p className="font-medium">{selected.vendor || '—'}</p></div>
                  <div><span className="text-muted-foreground">Product</span><p className="font-medium">{selected.product || '—'}</p></div>
                  <div><span className="text-muted-foreground">CVSS</span><p className="font-medium">{selected.cvss_score?.toFixed(1) || 'N/A'}</p></div>
                  <div><span className="text-muted-foreground">Source</span><p className="font-medium">{selected.source_name || '—'}</p></div>
                  {selected.published_at && <div><span className="text-muted-foreground">Published</span><p className="font-medium">{format(new Date(selected.published_at), 'MMM d, yyyy')}</p></div>}
                  {selected.kev_due_date && <div><span className="text-muted-foreground">KEV Due Date</span><p className="font-medium text-orange-400">{format(new Date(selected.kev_due_date), 'MMM d, yyyy')}</p></div>}
                </div>

                {/* KEV callout */}
                {selected.is_kev && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                    <p className="text-xs font-medium text-orange-400">⚠️ CISA Known Exploited Vulnerability</p>
                    {selected.kev_ransomware_use && <p className="text-xs text-destructive mt-1">Known ransomware campaign use</p>}
                    {selected.kev_due_date && <p className="text-xs text-muted-foreground mt-1">Remediation due: {format(new Date(selected.kev_due_date), 'MMM d, yyyy')}</p>}
                  </div>
                )}

                {/* Asset match */}
                {selected.affects_assets && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs font-medium text-primary">⚡ Affects Organization Assets</p>
                    <p className="text-xs text-muted-foreground mt-1">{selected.matched_asset_ids.length} asset(s) matched</p>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Description</h4>
                  <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
                </div>

                {/* Tags */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tags</h4>
                  <div className="flex flex-wrap gap-1">
                    {(selected.tags || []).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
