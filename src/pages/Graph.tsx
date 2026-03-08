import { useState, useEffect, useRef } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, Maximize2, Loader2 } from 'lucide-react';
import { useEntities, useEntityRelationships } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import type { Entity, EntityType } from '@/types';

const TYPE_COLORS: Record<string, string> = {
  indicator: '#06b6d4', vulnerability: '#ef4444', malware: '#a855f7',
  threat_actor: '#f59e0b', campaign: '#10b981', tool: '#6366f1',
  infrastructure: '#ec4899', organization: '#3b82f6', report: '#8b5cf6',
  source: '#14b8a6', sighting: '#f97316', ttp: '#d946ef',
};

interface GNode {
  id: string; label: string; type: string;
  x: number; y: number; vx: number; vy: number;
}
interface GEdge { source: string; target: string; type: string; }

// Demo entities + relationships
const DEMO_ENTITIES: { id: string; label: string; type: EntityType }[] = [
  { id: 'e1', label: 'APT29', type: 'threat_actor' },
  { id: 'e2', label: 'CVE-2024-3400', type: 'vulnerability' },
  { id: 'e3', label: 'CobaltStrike', type: 'tool' },
  { id: 'e4', label: 'Emotet', type: 'malware' },
  { id: 'e5', label: 'LockBit 3.0', type: 'threat_actor' },
  { id: 'e6', label: 'CVE-2024-21887', type: 'vulnerability' },
  { id: 'e7', label: 'SolarWinds Campaign', type: 'campaign' },
  { id: 'e8', label: '185.244.25.14', type: 'indicator' },
  { id: 'e9', label: 'phishing-kit-v2', type: 'tool' },
  { id: 'e10', label: 'Healthcare Org', type: 'organization' },
  { id: 'e11', label: 'Company VPN', type: 'infrastructure' },
  { id: 'e12', label: 'T1566 - Phishing', type: 'ttp' },
];

const DEMO_EDGES: GEdge[] = [
  { source: 'e1', target: 'e3', type: 'uses' },
  { source: 'e1', target: 'e7', type: 'attributed-to' },
  { source: 'e1', target: 'e2', type: 'exploits' },
  { source: 'e4', target: 'e8', type: 'communicates-with' },
  { source: 'e5', target: 'e10', type: 'targets' },
  { source: 'e5', target: 'e4', type: 'uses' },
  { source: 'e6', target: 'e11', type: 'affects' },
  { source: 'e1', target: 'e12', type: 'uses' },
  { source: 'e9', target: 'e12', type: 'implements' },
  { source: 'e7', target: 'e6', type: 'exploits' },
  { source: 'e3', target: 'e8', type: 'communicates-with' },
];

export default function Graph() {
  return (
    <FeatureGate feature="graph_explorer" moduleName="Graph Explorer" description="Interactive entity-relationship graph for exploring STIX-like threat intelligence entities and their connections.">
      <GraphContent />
    </FeatureGate>
  );
}

function GraphContent() {
  const { isDevMode } = useAuth();
  const { data: apiEntities, isLoading } = useEntities();

  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>(DEMO_EDGES);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<GNode | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const animRef = useRef<number>();
  const W = 900, H = 600;

  // Use API entities when available
  const entityList = isDevMode ? DEMO_ENTITIES : (
    apiEntities && apiEntities.length > 0
      ? apiEntities.map(e => ({ id: e.id, label: e.value, type: e.type }))
      : DEMO_ENTITIES
  );

  useEffect(() => {
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

  if (isLoading && !isDevMode) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Graph Explorer</h1><p className="text-sm text-muted-foreground mt-1">{entityList.length} entities, {edges.length} relationships</p></div>
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
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(6,182,212,0.4)" />
                </marker>
              </defs>
              {edges.map((edge, i) => {
                const s = getNodePos(edge.source), t = getNodePos(edge.target);
                const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2 - 15;
                return (
                  <g key={i}>
                    <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(6,182,212,0.2)" strokeWidth={1.5} markerEnd="url(#arrow)" />
                    <text x={mx} y={my} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '8px' }}>{edge.type}</text>
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
                    stroke={selected?.id === node.id ? '#fff' : 'transparent'} strokeWidth={2} />
                  <text y={30} textAnchor="middle" className="fill-foreground" style={{ fontSize: '10px', fontWeight: 500 }}>{node.label.slice(0, 18)}</text>
                </g>
              ))}
            </svg>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-medium">Entity Details</h3>
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: TYPE_COLORS[selected.type] }} />
                  <span className="font-medium text-sm">{selected.label}</span>
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
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
