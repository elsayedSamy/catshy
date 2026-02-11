import { useState, useEffect, useRef } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useEntities } from '@/hooks/useApi';
import type { Entity } from '@/types';

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

export default function Graph() {
  return (
    <FeatureGate feature="graph_explorer" moduleName="Graph Explorer" description="Interactive entity-relationship graph for exploring STIX-like threat intelligence entities and their connections.">
      <GraphContent />
    </FeatureGate>
  );
}

function GraphContent() {
  const { data: entities = [] } = useEntities();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const nodesRef = useRef<GNode[]>([]);
  const animRef = useRef<number>();
  const W = 800, H = 600;

  useEffect(() => {
    const ns: GNode[] = entities.map(() => ({
      id: crypto.randomUUID(), label: '', type: 'indicator',
      x: W / 2 + (Math.random() - 0.5) * 300,
      y: H / 2 + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0,
    }));
    entities.forEach((e, i) => {
      if (ns[i]) { ns[i].id = e.id; ns[i].label = e.name; ns[i].type = e.type; }
    });
    nodesRef.current = ns;
    setNodes([...ns]);
  }, [entities]);

  useEffect(() => {
    if (nodesRef.current.length === 0) return;
    const tick = () => {
      const ns = nodesRef.current;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = (ns[j].x - ns[i].x) || 1;
          const dy = (ns[j].y - ns[i].y) || 1;
          const d = Math.sqrt(dx * dx + dy * dy);
          const f = Math.min(600 / (d * d), 4);
          ns[i].vx -= (dx / d) * f; ns[i].vy -= (dy / d) * f;
          ns[j].vx += (dx / d) * f; ns[j].vy += (dy / d) * f;
        }
      }
      for (const n of ns) {
        if (n.id === dragging) continue;
        n.vx += (W / 2 - n.x) * 0.005;
        n.vy += (H / 2 - n.y) * 0.005;
        n.vx *= 0.9; n.vy *= 0.9;
        n.x = Math.max(25, Math.min(W - 25, n.x + n.vx));
        n.y = Math.max(25, Math.min(H - 25, n.y + n.vy));
      }
      setNodes([...ns]);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes.length, dragging]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const node = nodesRef.current.find(n => n.id === dragging);
    if (node) { node.x = (e.clientX - rect.left) / zoom; node.y = (e.clientY - rect.top) / zoom; node.vx = 0; node.vy = 0; }
  };

  if (entities.length === 0) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Graph Explorer</h1><p className="text-sm text-muted-foreground mt-1">Visualize relationships between threat intelligence entities</p></div>
        <EmptyState icon="search" title="No Entities Yet" description="Entities are created automatically when intelligence is ingested and normalized. Enable sources and fetch data to populate the graph." actionLabel="View Sources" onAction={() => window.location.href = '/sources'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Graph Explorer</h1><p className="text-sm text-muted-foreground mt-1">{entities.length} entities</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(1)}><Maximize2 className="h-4 w-4" /></Button>
        </div>
      </div>
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-[600px] cursor-grab active:cursor-grabbing bg-secondary/10"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            onMouseMove={handleMouseMove} onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)}>
            <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
            {nodes.map(node => (
              <g key={node.id} transform={`translate(${node.x},${node.y})`} onMouseDown={() => setDragging(node.id)} className="cursor-pointer">
                <circle r={20} fill={TYPE_COLORS[node.type] || '#6b7280'} opacity={0.15} filter="url(#glow)" />
                <circle r={14} fill={TYPE_COLORS[node.type] || '#6b7280'} opacity={0.8} />
                <text y={28} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: '10px' }}>{node.label.slice(0, 16)}</text>
              </g>
            ))}
          </svg>
        </CardContent>
      </Card>
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
