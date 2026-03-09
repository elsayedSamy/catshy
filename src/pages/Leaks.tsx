import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileDown, Search, X, Loader2 } from 'lucide-react';
import { useLeaks, useTriageLeak, useCreateCaseFromLeak } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import type { LeakItem } from '@/types';

import { LeakCategoryGrid } from '@/components/leaks/LeakCategoryGrid';
import { LeakCard } from '@/components/leaks/LeakCard';
import { LeakDetailDialog } from '@/components/leaks/LeakDetailDialog';
import { TorToggle } from '@/components/leaks/TorToggle';
import { STATUS_OPTIONS } from '@/components/leaks/constants';

export default function Leaks() {
  return (
    <FeatureGate feature="leaks_center" moduleName="Leak Hub" description="Monitor for credential leaks, breach mentions, paste dumps, and brand impersonation using public OSINT sources.">
      <LeaksContent />
    </FeatureGate>
  );
}

function LeaksContent() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState<LeakItem | null>(null);

  const { data, isLoading } = useLeaks({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    search: searchQuery || undefined,
  });
  const triageMutation = useTriageLeak();
  const createCaseMutation = useCreateCaseFromLeak();

  const items = data?.items ?? [];

  const handleTriage = (id: string, status: string) => {
    triageMutation.mutate({ leakId: id, status }, {
      onSuccess: () => toast.success(`Status updated to ${status}`),
      onError: (e: any) => toast.error(e.message || 'Failed to update status'),
    });
  };

  const handleCreateCase = (id: string) => {
    createCaseMutation.mutate(id, {
      onSuccess: (res) => {
        toast.success(`Case created: ${res.case_title}`);
        setTimeout(() => navigate('/cases'), 1000);
      },
      onError: (e: any) => toast.error(e.message || 'Failed to create case'),
    });
  };

  const handleRefresh = async () => {
    try { await api.post('/leaks/refresh'); toast.success('Leak data refreshed'); }
    catch (e: any) { toast.error(e.message || 'Failed to refresh leak data'); }
  };

  const handleExport = () => {
    const csv = ['Title,Severity,Type,Status,Source,Discovered,Matched Assets'].concat(
      items.map(i => {
        const assets = i.matched_assets || i.matched_asset_ids || [];
        return `"${i.title}",${i.severity},${i.type},${i.status || 'new'},${i.source_name},${i.discovered_at},"${assets.join('; ')}"`;
      })
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'catshy-leaks-report.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Leak report exported — ${items.length} items`);
  };

  const activeFilterCount = [statusFilter, typeFilter].filter(Boolean).length;
  const newCount = items.filter(i => i.status === 'new').length;
  const assetCount = items.filter(i => (i.matched_assets || i.matched_asset_ids || []).length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leak Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} leaks · {newCount} new · {assetCount} affecting assets
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export</Button>
        </div>
      </div>

      <LeakCategoryGrid items={items} activeType={typeFilter} onToggleType={setTypeFilter} />

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

      <TorToggle />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="alert" title="No Leaks Detected" description="No leaks match your filters." actionLabel="Clear Filters"
          onAction={() => { setStatusFilter(''); setTypeFilter(''); setSearchQuery(''); }} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map(item => (
            <LeakCard
              key={item.id}
              item={item}
              onViewDetails={setSelectedItem}
              onInvestigate={(id) => handleTriage(id, 'investigating')}
              onCreateCase={handleCreateCase}
            />
          ))}
        </div>
      )}

      <LeakDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} onTriage={handleTriage} />
    </div>
  );
}
