import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitMerge, Play, ArrowRight, Shield, AlertTriangle, Network, Zap,
  Clock, Hash, Globe, Link2, ChevronRight, CheckCircle2, XCircle, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  useCorrelationClusters, useCorrelationStats, useCorrelationClusterDetail,
  useRunCorrelation, useUpdateClusterStatus,
  type CorrelationCluster,
} from '@/hooks/useApi';
import { EmptyState } from '@/components/EmptyState';

const severityStyle: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-muted text-muted-foreground border-border',
};

const typeIcons: Record<string, typeof GitMerge> = {
  shared_ioc: Link2,
  campaign: Shield,
  shared_actor: AlertTriangle,
  shared_infra: Network,
  temporal: Clock,
};

const typeLabels: Record<string, string> = {
  shared_ioc: 'Shared IOC',
  campaign: 'Campaign',
  shared_actor: 'Shared Actor',
  shared_infra: 'Shared Infrastructure',
  temporal: 'Temporal Proximity',
};

export default function Correlations() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clustersData, isLoading } = useCorrelationClusters(
    typeFilter === 'all' ? undefined : typeFilter,
    sevFilter === 'all' ? undefined : sevFilter,
  );
  const { data: stats, isLoading: statsLoading } = useCorrelationStats();
  const { data: detail, isLoading: detailLoading } = useCorrelationClusterDetail(selectedId || undefined);
  const runMutation = useRunCorrelation();
  const statusMutation = useUpdateClusterStatus();

  const clusters = clustersData?.items ?? [];

  const handleRun = () => {
    runMutation.mutate(48, {
      onSuccess: (data) => toast.success(`Correlation complete: ${data.new_clusters} new, ${data.updated_clusters} updated`),
      onError: (e: any) => toast.error(e.message || 'Correlation failed'),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GitMerge className="h-6 w-6 text-primary" />
            Correlation Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Auto-correlated threat clusters based on shared indicators</p>
        </div>
        <Button onClick={handleRun} disabled={runMutation.isPending} size="sm">
          <Play className="mr-2 h-4 w-4" />{runMutation.isPending ? 'Running...' : 'Run Correlation'}
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Active Clusters', value: stats?.total_active_clusters ?? 0, icon: GitMerge, color: 'text-primary' },
          { label: 'Linked Items', value: stats?.total_linked_items ?? 0, icon: Link2, color: 'text-accent' },
          { label: 'IOC Clusters', value: stats?.by_type?.shared_ioc ?? 0, icon: Hash, color: 'text-orange-400' },
          { label: 'Campaigns', value: stats?.by_type?.campaign ?? 0, icon: Shield, color: 'text-yellow-400' },
        ].map(s => (
          <Card key={s.label} className="border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/50 border border-border">
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                {statsLoading ? <Skeleton className="h-6 w-10" /> : (
                  <p className="text-xl font-bold font-mono tabular-nums text-foreground">{s.value}</p>
                )}
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[150px] text-xs bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="shared_ioc">Shared IOC</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="temporal">Temporal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main split layout */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : clusters.length === 0 ? (
        <EmptyState
          icon="radio"
          title="No correlation clusters yet"
          description="Run the correlation engine to auto-detect related threats sharing common indicators."
          actionLabel="Run Correlation"
          onAction={handleRun}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]" style={{ minHeight: '60vh' }}>
          {/* Left: Cluster list */}
          <ScrollArea className="rounded-lg border border-border bg-card/30" style={{ height: 'calc(100vh - 380px)' }}>
            <div className="space-y-1 p-2">
              {clusters.map(cluster => {
                const TypeIcon = typeIcons[cluster.cluster_type] || GitMerge;
                return (
                  <button
                    key={cluster.id}
                    onClick={() => setSelectedId(cluster.id)}
                    className={`w-full text-left rounded-lg p-3 transition-all border ${
                      selectedId === cluster.id ? 'bg-primary/10 border-primary/30' : 'bg-transparent border-transparent hover:bg-secondary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${severityStyle[cluster.severity]}`}>
                        {cluster.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 border-border">
                        <TypeIcon className="h-2.5 w-2.5 mr-1" />
                        {typeLabels[cluster.cluster_type] || cluster.cluster_type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                        {cluster.item_count} items
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground line-clamp-1">{cluster.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>Confidence: {Math.round(cluster.confidence * 100)}%</span>
                      <span>•</span>
                      <span>{cluster.last_seen ? format(new Date(cluster.last_seen), 'MMM d HH:mm') : 'N/A'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Right: Detail panel */}
          <div className="rounded-lg border border-border bg-card/30 p-4 overflow-y-auto" style={{ height: 'calc(100vh - 380px)' }}>
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <GitMerge className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Select a cluster</p>
                <p className="text-xs mt-1">Click on a correlation cluster to view details</p>
              </div>
            ) : detailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detail ? (
              <div className="space-y-4">
                {/* Detail header */}
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="outline" className={`${severityStyle[detail.severity]}`}>
                      {detail.severity}
                    </Badge>
                    <Badge variant="outline" className="border-border text-xs">
                      {typeLabels[detail.cluster_type] || detail.cluster_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono ml-auto">
                      {Math.round(detail.confidence * 100)}% confidence
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
                  {detail.description && (
                    <p className="text-sm text-muted-foreground mt-1">{detail.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-wrap">
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                    statusMutation.mutate({ clusterId: detail.id, status: 'resolved' }, {
                      onSuccess: () => toast.success('Cluster resolved'),
                    });
                  }}>
                    <CheckCircle2 className="mr-1 h-3 w-3" />Resolve
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 text-destructive" onClick={() => {
                    statusMutation.mutate({ clusterId: detail.id, status: 'false_positive' }, {
                      onSuccess: () => toast.success('Marked as false positive'),
                    });
                  }}>
                    <XCircle className="mr-1 h-3 w-3" />False Positive
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast.success('Investigation created')}>
                    <Eye className="mr-1 h-3 w-3" />Investigate
                  </Button>
                </div>

                {/* Pivot indicators */}
                {detail.pivot_indicators && detail.pivot_indicators.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Pivot Indicators</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.pivot_indicators.map((p, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-mono">
                          {p.type}: {p.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked items */}
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Linked Items ({detail.linked_items?.length || 0})
                  </h4>
                  <div className="space-y-1.5">
                    {(detail.linked_items || []).map(li => (
                      <div key={li.link_id} className="rounded-lg border border-border bg-secondary/10 p-2.5">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] px-1.5 ${severityStyle[li.item.severity]}`}>
                            {li.item.severity}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{li.link_reason}</span>
                          {li.item.asset_match && (
                            <Badge variant="outline" className="text-[9px] px-1 border-accent/30 text-accent">ASSET MATCH</Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground line-clamp-1">{li.item.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <code className="font-mono">{li.item.observable_value}</code>
                          <span>•</span>
                          <span>{li.item.source_name}</span>
                          <span>•</span>
                          <span>Risk: {li.item.risk_score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {detail.tags && detail.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tags</h4>
                    <div className="flex flex-wrap gap-1">
                      {detail.tags.map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/20 p-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">First Seen</span>
                    <p className="font-medium">{detail.first_seen ? format(new Date(detail.first_seen), 'MMM d, yyyy HH:mm') : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Seen</span>
                    <p className="font-medium">{detail.last_seen ? format(new Date(detail.last_seen), 'MMM d, yyyy HH:mm') : 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
