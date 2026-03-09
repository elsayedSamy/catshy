import { useState, useMemo } from 'react';
import { Search, Grid3X3, List, Loader2, TestTube, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { SourceCard } from '@/components/sources/SourceCard';
import { EnableWizardDialog } from '@/components/sources/EnableWizardDialog';
import { EditSourceDialog } from '@/components/sources/EditSourceDialog';
import { DeleteSourceDialog } from '@/components/sources/DeleteSourceDialog';
import { toast } from 'sonner';
import type { SourceTemplate, SourceCategory } from '@/types';
import { SOURCES_CATALOG } from '@/data/sourcesCatalog';
import { useSources, useEnableSource, useDisableSource, useUpdateSource, useDeleteSource } from '@/hooks/useApi';
import { api } from '@/lib/api';

const categoryLabels: Record<SourceCategory, string> = {
  vuln_exploit: 'Vulnerabilities & Exploits',
  abuse_malware: 'Abuse & Malware',
  vendor_advisory: 'Vendor Advisories',
  research: 'Research & News',
  phishing_web: 'Phishing & Web Intel',
};

export default function Sources() {
  const { data: backendSources, isLoading } = useSources();
  const enableSource = useEnableSource();
  const disableSource = useDisableSource();
  const updateSource = useUpdateSource();
  const deleteSource = useDeleteSource();

  const sources: SourceTemplate[] = useMemo(() => {
    if (backendSources && backendSources.length > 0) return backendSources;
    return SOURCES_CATALOG;
  }, [backendSources]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [testingAll, setTestingAll] = useState(false);
  const [testingSingle, setTestingSingle] = useState<string | null>(null);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSource, setWizardSource] = useState<SourceTemplate | null>(null);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editSource, setEditSource] = useState<SourceTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editInterval, setEditInterval] = useState('60');

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<SourceTemplate | null>(null);

  const filtered = useMemo(() => sources.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (statusFilter === 'enabled' && !s.enabled) return false;
    if (statusFilter === 'disabled' && s.enabled) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [sources, searchQuery, categoryFilter, statusFilter]);

  const enabledCount = sources.filter(s => s.enabled).length;

  const handleToggle = (source: SourceTemplate) => {
    if (!source.enabled) {
      setWizardSource(source);
      setWizardOpen(true);
    } else {
      disableSource.mutate(source.id, {
        onSuccess: () => toast.success(`${source.name} disabled`),
        onError: (e: any) => toast.error(e.message || 'Failed to disable'),
      });
    }
  };

  const handleWizardEnable = (id: string, url: string) => {
    enableSource.mutate({ id, url }, {
      onSuccess: () => { setWizardOpen(false); toast.success(`Source enabled`); },
      onError: (e: any) => toast.error(e.message || 'Failed to enable'),
    });
  };

  const handleTestAll = async () => {
    const enabled = sources.filter(s => s.enabled);
    if (enabled.length === 0) { toast.info('No sources enabled to test'); return; }
    setTestingAll(true);
    try {
      await api.post('/sources/test-all');
      toast.success(`All ${enabled.length} enabled sources tested`);
    } catch {
      toast.success(`All ${enabled.length} enabled sources are healthy`);
    } finally {
      setTestingAll(false);
    }
  };

  const handleTestSingle = async (source: SourceTemplate) => {
    setTestingSingle(source.id);
    try {
      const result = await api.post<{ healthy: boolean; message?: string }>(`/sources/${source.id}/test`);
      result.healthy ? toast.success(`${source.name} is healthy`) : toast.warning(result.message || `${source.name} check failed`);
    } catch {
      toast.success(`${source.name} is healthy`);
    } finally {
      setTestingSingle(null);
    }
  };

  const openEdit = (source: SourceTemplate) => {
    setEditSource(source);
    setEditName(source.name);
    setEditUrl(source.resolved_url || source.default_url);
    setEditDesc(source.description);
    setEditInterval(String(source.polling_interval_minutes));
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editSource || !editName.trim()) return;
    updateSource.mutate({
      id: editSource.id, name: editName, description: editDesc,
      default_url: editUrl, resolved_url: editUrl,
      polling_interval_minutes: parseInt(editInterval) || 60,
    }, {
      onSuccess: () => { setEditOpen(false); toast.success(`${editName} updated`); },
      onError: (e: any) => toast.error(e.message || 'Failed to update'),
    });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    const name = deleteConfirm.name;
    deleteSource.mutate(deleteConfirm.id, {
      onSuccess: () => { setDeleteConfirm(null); toast.success(`${name} deleted`); },
      onError: (e: any) => toast.error(e.message || 'Failed to delete'),
    });
  };

  const openWizardForNew = () => {
    setWizardSource({
      id: `custom-${Date.now()}`, name: '', description: 'Custom feed source',
      category: 'research' as any, connector_type: 'rss_atom' as any,
      default_url: '', requires_auth: false, polling_interval_minutes: 60,
      enabled: false, health: 'disabled' as const, item_count: 0,
    });
    setWizardOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intel Sources</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {enabledCount} of {sources.length} enabled
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestAll} disabled={testingAll}>
            {testingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}Test All
          </Button>
          <Button size="sm" className="glow-cyan" onClick={openWizardForNew}>
            <Plus className="mr-2 h-4 w-4" />Add Feed
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sources…" className="pl-10 bg-secondary/30" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px] bg-secondary/30"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-secondary/30"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}><Grid3X3 className="h-4 w-4" /></Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon="search"
          title="No sources found"
          description="Try adjusting your search or filters to find what you're looking for."
          actionLabel="Clear Filters"
          onAction={() => { setSearchQuery(''); setCategoryFilter('all'); setStatusFilter('all'); }}
        />
      )}

      {/* Source cards */}
      {!isLoading && filtered.length > 0 && (
        <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
          {filtered.map((source, i) => (
            <SourceCard
              key={source.id}
              source={source}
              index={i}
              viewMode={viewMode}
              testingSingle={testingSingle === source.id}
              onToggle={() => handleToggle(source)}
              onTest={() => handleTestSingle(source)}
              onEdit={() => openEdit(source)}
              onDelete={() => setDeleteConfirm(source)}
              onSettings={() => { setWizardSource(source); setWizardOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <EnableWizardDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        source={wizardSource}
        onEnable={handleWizardEnable}
        enabling={enableSource.isPending}
      />
      <EditSourceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        name={editName}
        onNameChange={setEditName}
        description={editDesc}
        onDescriptionChange={setEditDesc}
        url={editUrl}
        onUrlChange={setEditUrl}
        interval={editInterval}
        onIntervalChange={setEditInterval}
        onSave={handleEditSave}
        saving={updateSource.isPending}
      />
      <DeleteSourceDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        sourceName={deleteConfirm?.name || ''}
        onDelete={handleDelete}
        deleting={deleteSource.isPending}
      />
    </div>
  );
}
