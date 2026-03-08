import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { History as HistoryIcon, ExternalLink, Search, Clock, RefreshCw, Filter, X } from 'lucide-react';
import { useThreatHistory } from '@/hooks/useApi';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import type { IntelItem, SeverityLevel, ObservableType } from '@/types';


type RangeFilter = '24h' | '7d' | '30d';

export default function History() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeFilter>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters from URL params
  const severityFilter = searchParams.get('severity') || '';
  const typeFilter = searchParams.get('type') || '';
  const assetMatchOnly = searchParams.get('asset_match') === 'true';

  const { data, isLoading, refetch, isFetching } = useThreatHistory(range, searchQuery);

  const rawItems = data?.items ?? [];

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    let result = rawItems;
    if (severityFilter) result = result.filter(i => i.severity === severityFilter);
    if (typeFilter) result = result.filter(i => i.observable_type === typeFilter);
    if (assetMatchOnly) result = result.filter(i => i.asset_match);
    return result;
  }, [rawItems, severityFilter, typeFilter, assetMatchOnly]);

  const total = filteredItems.length;
  const activeFilterCount = [severityFilter, typeFilter, assetMatchOnly].filter(Boolean).length;
  const queriedAt = data?.queried_at;

  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') { next.delete(key); } else { next.set(key, value); }
      return next;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => setSearchParams({}), [setSearchParams]);

  const handleRefresh = useCallback(() => {
    if (!isDevMode) {
      refetch();
    } else {
      toast('History refreshed (Dev Mode)');
    }
  }, [isDevMode, refetch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-muted-foreground" />
            Threat History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} items · Retention: 30 days
            {activeFilterCount > 0 && ` · ${activeFilterCount} filter(s) active`}
            {queriedAt && <span className="ml-2">· Last queried: {format(new Date(queriedAt), 'MMM d, HH:mm')}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/feed')}>
            <Clock className="mr-2 h-4 w-4" /> Live Feed
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Range Tabs + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['24h', '7d', '30d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              {r === '24h' ? 'Last 24h' : r === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search title or description..."
            className="pl-10 bg-secondary/50 border-border h-9 text-sm"
          />
        </div>
      </div>

      {/* Severity + Type + Asset Match Filters */}
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
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="search"
          title="No historical items"
          description={activeFilterCount > 0 || searchQuery
            ? 'No items match the current filters or search. Try adjusting your criteria.'
            : 'Items older than 24 hours will appear here. They are retained for up to 30 days.'}
          actionLabel={activeFilterCount > 0 ? 'Clear Filters' : undefined}
          onAction={activeFilterCount > 0 ? clearFilters : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
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
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-[10px]">
                          {format(new Date(item.published_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    <h3 className="font-medium text-sm text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{item.observable_value}</span>
                      <span>via {item.source_name}</span>
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
