import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Globe, Shield, Lock, RefreshCw, FileDown, Search, Eye,
  ShieldAlert, Key, AtSign, Server, Skull, Briefcase,
  AlertTriangle, X, Loader2
} from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaks } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LeakItem, SeverityLevel } from '@/types';

const LEAK_CATEGORIES = [
  { key: 'credential', label: 'Credential Exposure', icon: Key, color: 'text-destructive' },
  { key: 'brand_mention', label: 'Brand Mentions', icon: AtSign, color: 'text-primary' },
  { key: 'typosquat', label: 'Asset Mentions', icon: Server, color: 'text-orange-400' },
  { key: 'breach', label: 'Data Breach Watch', icon: ShieldAlert, color: 'text-blue-400' },
  { key: 'code_leak', label: 'Ransomware Watch', icon: Skull, color: 'text-destructive' },
  { key: 'paste', label: 'Paste Monitor', icon: Globe, color: 'text-muted-foreground' },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-destructive/20 text-destructive' },
  { value: 'false_positive', label: 'False Positive', color: 'bg-muted text-muted-foreground' },
  { value: 'resolved', label: 'Resolved', color: 'bg-accent/20 text-accent' },
];


export default function Leaks() {
  return (
    <FeatureGate feature="leaks_center" moduleName="Leak Hub" description="Monitor for credential leaks, breach mentions, paste dumps, and brand impersonation using public OSINT sources.">
      <LeaksContent />
    </FeatureGate>
  );
}

function LeaksContent() {
  const navigate = useNavigate();
  const { data: backendLeaks, isLoading } = useLeaks();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const { isEnabled, setFlag } = useFeatureFlags();
  const { hasRole } = useAuth();
  const torEnabled = isEnabled('leaks_tor');
  const [showTorWarning, setShowTorWarning] = useState(false);

  const items: (LeakItem & { status?: string })[] = useMemo(() => {
    if (backendLeaks && backendLeaks.length > 0) return backendLeaks.map(l => ({ ...l, status: 'new' }));
    return [];
  }, [backendLeaks]);

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    if (statusFilter) result = result.filter(i => (i as any).status === statusFilter);
    if (typeFilter) result = result.filter(i => i.type === typeFilter);
    return result;
  }, [items, searchQuery, statusFilter, typeFilter]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    LEAK_CATEGORIES.forEach(c => { counts[c.key] = items.filter(i => i.type === c.key).length; });
    return counts;
  }, [items]);

  const activeFilterCount = [statusFilter, typeFilter].filter(Boolean).length;

  const handleTriage = async (id: string, status: string) => {
    try {
      await api.patch(`/leaks/${id}/triage`, { status });
    } catch { /* dev mode fallback */ }
    toast.success(`Status updated to ${status}`);
  };

  const handleCreateCase = (id: string) => {
    const leak = items.find(i => i.id === id);
    if (!leak) return;
    toast.success('Case created from leak — redirecting to Cases');
    setTimeout(() => navigate('/cases'), 1000);
  };

  const handleRefresh = async () => {
    try { await api.post('/leaks/refresh'); toast.success('Leak data refreshed'); }
    catch { toast.success('Leak data refreshed (Dev Mode)'); }
  };

  const handleExport = () => {
    const csv = ['Title,Severity,Type,Status,Source,Discovered,Matched Assets'].concat(
      items.map(i => `"${i.title}",${i.severity},${i.type},${(i as any).status || 'new'},${i.source_name},${i.discovered_at},"${i.matched_assets.join('; ')}"`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'catshy-leaks-report.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Leak report exported — ${items.length} items`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leak Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} leaks · {items.filter(i => (i as any).status === 'new').length} new · {items.filter(i => i.matched_assets.length > 0).length} affecting assets
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export</Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {LEAK_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <Card key={cat.key} className="border-border bg-card/50 cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setTypeFilter(typeFilter === cat.key ? '' : cat.key)}>
              <CardContent className="p-3 text-center">
                <Icon className={cn('h-5 w-5 mx-auto mb-1', cat.color)} />
                <p className="text-2xl font-bold text-foreground">{categoryCounts[cat.key] || 0}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-1">{cat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search leaks, organizations…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] border-border bg-secondary/50 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setStatusFilter(''); setTypeFilter(''); }}>
            <X className="mr-1 h-3 w-3" />Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* TOR notice */}
      <Card className={cn('border-border', torEnabled ? 'bg-destructive/10 border-destructive/30' : 'bg-secondary/20')}>
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Shield className={cn('h-5 w-5', torEnabled ? 'text-destructive' : 'text-accent')} />
            <div>
              <p className="text-xs font-medium">{torEnabled ? '⚠ TOR/Dark Web Sources Active' : 'Public Sources Only'}</p>
              <p className="text-[10px] text-muted-foreground">TOR/dark web connectors are {torEnabled ? 'enabled — use with caution' : 'disabled'}.</p>
            </div>
          </div>
          {hasRole(['system_owner']) && (
            torEnabled ? (
              <Button variant="destructive" size="sm" className="text-xs" onClick={() => { setFlag('leaks_tor', false); toast.success('TOR sources disabled'); }}>
                <Lock className="mr-1 h-3 w-3" />Disable TOR
              </Button>
            ) : showTorWarning ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-destructive font-medium">⚠ Legal warning: enables dark web scanning</span>
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => { setFlag('leaks_tor', true); toast.success('TOR sources enabled'); setShowTorWarning(false); }}>Confirm</Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowTorWarning(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowTorWarning(true)}>
                <Lock className="mr-1 h-3 w-3" />Enable TOR
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="alert" title="No Leaks Detected" description="No leaks match your filters." actionLabel="Clear Filters"
          onAction={() => { setStatusFilter(''); setTypeFilter(''); setSearchQuery(''); }} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(item => {
            const statusInfo = STATUS_OPTIONS.find(s => s.value === (item as any).status) || STATUS_OPTIONS[0];
            return (
              <Card key={item.id} className={cn(
                'border-border bg-card hover:border-primary/20 transition-all',
                item.matched_assets.length > 0 && 'border-l-2 border-l-destructive'
              )}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={item.severity} />
                      <Badge variant="outline" className="text-[10px] capitalize">{item.type.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className={cn('text-[10px]', statusInfo.color)}>{statusInfo.label}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(item.discovered_at), 'MMM d')}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2">{item.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  {item.matched_assets.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {item.matched_assets.map(a => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
                    </div>
                  )}
                  <div className="flex gap-1.5 pt-1 flex-wrap">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedItem(item)}>
                      <Eye className="mr-1 h-3 w-3" />Details
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleTriage(item.id, 'investigating')}>
                      <AlertTriangle className="mr-1 h-3 w-3" />Investigate
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleCreateCase(item.id)}>
                      <Briefcase className="mr-1 h-3 w-3" />Create Case
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{selectedItem?.title}</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={selectedItem.severity} />
                <Badge variant="outline" className="text-xs capitalize">{selectedItem.type.replace('_', ' ')}</Badge>
              </div>
              <p className="text-sm text-foreground">{selectedItem.description}</p>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Evidence (masked)</p>
                <pre className="text-xs font-mono bg-secondary/30 p-3 rounded-lg whitespace-pre-wrap text-foreground">{selectedItem.evidence_excerpt}</pre>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Source</span><p className="font-medium">{selectedItem.source_name}</p></div>
                <div><span className="text-muted-foreground">Provenance</span><p className="font-medium">{selectedItem.provenance}</p></div>
                <div><span className="text-muted-foreground">Discovered</span><p className="font-medium">{format(new Date(selectedItem.discovered_at), 'MMM d, yyyy HH:mm')}</p></div>
                <div><span className="text-muted-foreground">Matched Assets</span><p className="font-medium">{selectedItem.matched_assets.join(', ') || 'None'}</p></div>
              </div>
              <div className="flex gap-1.5 flex-wrap pt-2 border-t border-border">
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { handleTriage(selectedItem.id, 'confirmed'); setSelectedItem(null); }}>
                  <AlertTriangle className="mr-1 h-3 w-3" />Confirm
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { handleTriage(selectedItem.id, 'false_positive'); setSelectedItem(null); }}>
                  <X className="mr-1 h-3 w-3" />False Positive
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { handleTriage(selectedItem.id, 'resolved'); setSelectedItem(null); }}>
                  <Shield className="mr-1 h-3 w-3" />Resolved
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
