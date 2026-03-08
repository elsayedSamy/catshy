import { useState, useEffect, useRef, useMemo } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ZoomIn, ZoomOut, Maximize2, Loader2, Play, GitMerge, Link2,
  Shield, AlertTriangle, Network, Clock, Hash, CheckCircle2, XCircle, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  useEntities, useCorrelationClusters, useCorrelationStats,
  useCorrelationClusterDetail, useRunCorrelation, useUpdateClusterStatus,
  type CorrelationCluster,
} from '@/hooks/useApi';
import { EmptyState } from '@/components/EmptyState';
import type { Entity } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  indicator: '#06b6d4', vulnerability: '#ef4444', malware: '#a855f7',
  threat_actor: '#f59e0b', campaign: '#10b981', tool: '#6366f1',
  infrastructure: '#ec4899', organization: '#3b82f6', report: '#8b5cf6',
  source: '#14b8a6', sighting: '#f97316', ttp: '#d946ef',
  // Cluster types
  shared_ioc: '#06b6d4', shared_actor: '#f59e0b', shared_infra: '#ec4899',
  temporal: '#8b5cf6',
};

const CLUSTER_COLORS = ['#06b6d4', '#f59e0b', '#a855f7', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#f97316'];

const severityStyle: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-muted text-muted-foreground border-border',
};

const typeLabels: Record<string, string> = {
  shared_ioc: 'Shared IOC', campaign: 'Campaign',
  shared_actor: 'Shared Actor', shared_infra: 'Shared Infrastructure',
  temporal: 'Temporal Proximity',
};

interface GNode {
  id: string; label: string; type: string;
  x: number; y: number; vx: number; vy: number;
  clusterId?: string; clusterColor?: string;
}
interface GEdge { source: string; target: string; type: string; }

export default function Graph() {
  return (
    <FeatureGate feature="graph_explorer" moduleName="Graph Explorer" description="Interactive entity-relationship graph with auto-correlation clusters.">
      <GraphContent />
    </FeatureGate>
  );
}

function GraphContent() {
  const [tab, setTab] = useState<string>('graph');

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Graph Explorer</h1>
            <p className="text-sm text-muted-foreground mt-1">Entity relationships & auto-correlated threat clusters</p>
          </div>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="graph" className="text-xs">Entity Graph</TabsTrigger>
            <TabsTrigger value="clusters" className="text-xs">
              <GitMerge className="h-3 w-3 mr-1" /> Clusters
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="graph" className="mt-4"><EntityGraphTab /></TabsContent>
        <TabsContent value="clusters" className="mt-4"><ClustersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Entity Graph Tab ──

function EntityGraphTab() {
  const { data: apiEntities, isLoading } = useEntities();
  const { data: clustersData } = useCorrelationClusters();

  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const animRef = useRef<number>();
  const W = 900, H = 600;

  const entityList = useMemo(() =>
    apiEntities?.length ? apiEntities.map(e => ({ id: e.id, label: e.name, type: e.type })) : [],
    [apiEntities]
  );

  // Build cluster color map
  const clusterMap = useMemo(() => {
    const map: Record<string, string> = {};
    (clustersData?.items ?? []).forEach((c: CorrelationCluster, i: number) => {
      const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
      // Each linked item in the cluster gets this color
      map[c.id] = color;
    });
    return map;
  }, [clustersData]);

  useEffect(() => {
    if (!entityList.length) return;
    const ns: GNode[] = entityList.map((e, i) => ({
      id: e.id, label: e.label, type: e.type,
      x: W / 2 + Math.cos(i * Math.PI * 2 / entityList.length) * 200 + (Math.random() - 0.5) * 50,
      y: H / 2 + Math.sin(i * Math.PI * 2 / entityList.length) * 180 + (Math.random() - 0.5) * 50,
      vx: 0, vy: 0,
    }));
    nodesRef.current = ns;
    setNodes([...ns]);
  }, [entityList.length]);

  useEffect(() => {
    if (nodesRef.current.length === 0) return;
    const tick = () => {
      const ns = nodesRef.current;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = (ns[j].x - ns[i].x) || 1;
          const dy = (ns[j].y - ns[i].y) || 1;
          const d = Math.sqrt(dx * dx + dy * dy);
          const f = Math.min(800 / (d * d), 3);
          ns[i].vx -= (dx / d) * f; ns[i].vy -= (dy / d) * f;
          ns[j].vx += (dx / d) * f; ns[j].vy += (dy / d) * f;
        }
      }
      for (const edge of edges) {
        const s = ns.find(n => n.id === edge.source);
        const t = ns.find(n => n.id === edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const f = (d - 120) * 0.005;
        s.vx += (dx / d) * f; s.vy += (dy / d) * f;
        t.vx -= (dx / d) * f; t.vy -= (dy / d) * f;
      }
      for (const n of ns) {
        if (n.id === dragging) continue;
        n.vx += (W / 2 - n.x) * 0.003; n.vy += (H / 2 - n.y) * 0.003;
        n.vx *= 0.88; n.vy *= 0.88;
        n.x = Math.max(40, Math.min(W - 40, n.x + n.vx));
        n.y = Math.max(40, Math.min(H - 40, n.y + n.vy));
      }
      setNodes([...ns]);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes.length, dragging, edges]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const node = nodesRef.current.find(n => n.id === dragging);
    if (node) { node.x = (e.clientX - rect.left) / zoom; node.y = (e.clientY - rect.top) / zoom; node.vx = 0; node.vy = 0; }
  };

  const getNodePos = (id: string) => {
    const n = nodes.find(n => n.id === id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{entityList.length} entities, {edges.length} relationships</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(1)}><Maximize2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-[600px] cursor-grab active:cursor-grabbing bg-secondary/10"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}>
              <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <marker id="arrow" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary) / 0.4)" />
                </marker>
              </defs>
              {edges.map((edge, i) => {
                const s = getNodePos(edge.source), t = getNodePos(edge.target);
                const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2 - 15;
                return (
                  <g key={i}>
                    <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="hsl(var(--primary) / 0.2)" strokeWidth={1.5} markerEnd="url(#arrow)" />
                    <text x={mx} y={my} textAnchor="middle" fill="hsl(var(--muted-foreground))" style={{ fontSize: '8px' }}>{edge.type}</text>
                  </g>
                );
              })}
              {nodes.map(node => (
                <g key={node.id} transform={`translate(${node.x},${node.y})`}
                  onMouseDown={() => setDragging(node.id)}
                  onClick={() => setSelected(node)}
                  className="cursor-pointer">
                  <circle r={22} fill={TYPE_COLORS[node.type] || '#6b7280'} opacity={0.12} filter="url(#glow)" />
                  <circle r={16} fill={TYPE_COLORS[node.type] || '#6b7280'} opacity={selected?.id === node.id ? 1 : 0.75}
                    stroke={selected?.id === node.id ? 'hsl(var(--foreground))' : 'transparent'} strokeWidth={2} />
                  <text y={30} textAnchor="middle" fill="hsl(var(--foreground))" style={{ fontSize: '10px', fontWeight: 500 }}>{node.label.slice(0, 18)}</text>
                </g>
              ))}
            </svg>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-medium text-foreground">Entity Details</h3>
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: TYPE_COLORS[selected.type] }} />
                  <span className="font-medium text-sm text-foreground">{selected.label}</span>
                </div>
                <div><span className="text-xs text-muted-foreground">Type:</span> <Badge variant="outline" className="text-xs capitalize ml-1">{selected.type.replace('_', ' ')}</Badge></div>
                <div>
                  <span className="text-xs text-muted-foreground">Connections:</span>
                  <div className="mt-1 space-y-1">
                    {edges.filter(e => e.source === selected.id || e.target === selected.id).map((e, i) => {
                      const otherId = e.source === selected.id ? e.target : e.source;
                      const other = entityList.find(n => n.id === otherId);
                      return (
                        <button key={i} onClick={() => { const n = nodesRef.current.find(n => n.id === otherId); if (n) setSelected(n); }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full rounded px-1.5 py-1 hover:bg-secondary/30 transition-colors">
                          <span className="text-primary">{e.type}</span> → <span>{other?.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Click an entity node to view details and connections.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).filter(([type]) => !['shared_ioc', 'shared_actor', 'shared_infra', 'temporal'].includes(type)).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Clusters Tab (merged from Correlations) ──

function ClustersTab() {
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

      {/* Filters + Run */}
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
        <div className="ml-auto">
          <Button onClick={handleRun} disabled={runMutation.isPending} size="sm">
            <Play className="mr-2 h-4 w-4" />{runMutation.isPending ? 'Running...' : 'Run Correlation'}
          </Button>
        </div>
      </div>

      {/* Main layout */}
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
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]" style={{ minHeight: '55vh' }}>
          {/* Left: Cluster list */}
          <ScrollArea className="rounded-lg border border-border bg-card/30" style={{ height: 'calc(100vh - 420px)' }}>
            <div className="space-y-1 p-2">
              {clusters.map(cluster => (
                <button
                  key={cluster.id}
                  onClick={() => setSelectedId(cluster.id)}
                  className={`w-full text-left rounded-lg p-3 transition-all border ${
                    selectedId === cluster.id ? 'bg-primary/10 border-primary/30' : 'bg-transparent border-transparent hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 ${severityStyle[cluster.severity]}`}>{cluster.severity}</Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 border-border">
                      {typeLabels[cluster.cluster_type] || cluster.cluster_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">{cluster.item_count} items</span>
                  </div>
                  <p className="font-medium text-sm text-foreground line-clamp-1">{cluster.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>Confidence: {Math.round(cluster.confidence * 100)}%</span>
                    <span>•</span>
                    <span>{cluster.last_seen ? format(new Date(cluster.last_seen), 'MMM d HH:mm') : 'N/A'}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Right: Detail */}
          <div className="rounded-lg border border-border bg-card/30 p-4 overflow-y-auto" style={{ height: 'calc(100vh - 420px)' }}>
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <GitMerge className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">Select a cluster</p>
                <p className="text-xs mt-1">Click on a cluster to view linked threats</p>
              </div>
            ) : detailLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-32 w-full" />
              </div>
            ) : detail ? (
              <ClusterDetail detail={detail} statusMutation={statusMutation} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ClusterDetail({ detail, statusMutation }: { detail: any; statusMutation: any }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="outline" className={severityStyle[detail.severity]}>{detail.severity}</Badge>
          <Badge variant="outline" className="border-border text-xs">{typeLabels[detail.cluster_type] || detail.cluster_type}</Badge>
          <span className="text-xs text-muted-foreground font-mono ml-auto">{Math.round(detail.confidence * 100)}% confidence</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
        {detail.description && <p className="text-sm text-muted-foreground mt-1">{detail.description}</p>}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => {
          statusMutation.mutate({ clusterId: detail.id, status: 'resolved' }, { onSuccess: () => toast.success('Cluster resolved') });
        }}><CheckCircle2 className="mr-1 h-3 w-3" />Resolve</Button>
        <Button variant="outline" size="sm" className="text-xs h-7 text-destructive" onClick={() => {
          statusMutation.mutate({ clusterId: detail.id, status: 'false_positive' }, { onSuccess: () => toast.success('Marked as false positive') });
        }}><XCircle className="mr-1 h-3 w-3" />False Positive</Button>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast.success('Investigation created')}>
          <Eye className="mr-1 h-3 w-3" />Investigate
        </Button>
      </div>

      {detail.pivot_indicators?.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Pivot Indicators</h4>
          <div className="flex flex-wrap gap-1.5">
            {detail.pivot_indicators.map((p: any, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs font-mono">{p.type}: {p.value}</Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          Linked Items ({detail.linked_items?.length || 0})
        </h4>
        <div className="space-y-1.5">
          {(detail.linked_items || []).map((li: any) => (
            <div key={li.link_id} className="rounded-lg border border-border bg-secondary/10 p-2.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 ${severityStyle[li.item.severity]}`}>{li.item.severity}</Badge>
                <span className="text-[10px] text-muted-foreground">{li.link_reason}</span>
                {li.item.asset_match && (
                  <Badge variant="outline" className="text-[9px] px-1 border-accent/30 text-accent">ASSET MATCH</Badge>
                )}
              </div>
              <p className="text-xs text-foreground line-clamp-1">{li.item.title}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                <code className="font-mono">{li.item.observable_value}</code>
                <span>•</span><span>{li.item.source_name}</span>
                <span>•</span><span>Risk: {li.item.risk_score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {detail.tags?.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tags</h4>
          <div className="flex flex-wrap gap-1">{detail.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/20 p-3 text-xs">
        <div>
          <span className="text-muted-foreground">First Seen</span>
          <p className="font-medium text-foreground">{detail.first_seen ? format(new Date(detail.first_seen), 'MMM d, yyyy HH:mm') : 'N/A'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Last Seen</span>
          <p className="font-medium text-foreground">{detail.last_seen ? format(new Date(detail.last_seen), 'MMM d, yyyy HH:mm') : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
