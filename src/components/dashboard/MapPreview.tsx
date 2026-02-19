import { useEffect, useRef, useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Maximize2, ZoomIn, ZoomOut, RotateCcw, Brain, Shield, Crosshair,
  CheckCircle, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCreateCase } from '@/hooks/useApi';
import { toast } from '@/hooks/use-toast';

interface MapIncident {
  id?: string;
  lat: number;
  lon: number;
  severity?: string;
  severity_max?: string;
  count?: number;
  has_asset_match?: boolean;
  title?: string;
  source_name?: string;
  country_name?: string;
  city?: string;
  risk?: number;
  confidence?: number;
  asset_match?: boolean;
  campaign?: string;
  timestamp?: string;
  sample_titles?: string[];
}

const SEV_COLORS: Record<string, string> = {
  critical: '239, 68, 68',
  high: '245, 158, 11',
  medium: '234, 179, 8',
  low: '6, 182, 212',
  info: '100, 116, 139',
};

const THREAT_LEVELS = [
  { label: 'L1 — LOW', color: '#eab308', key: 'low' },
  { label: 'L2 — MEDIUM', color: '#f97316', key: 'medium' },
  { label: 'L3 — HIGH / CRITICAL', color: '#ef4444', key: 'high' },
];

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-muted text-muted-foreground border-border',
};

function projectMercator(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = (lon + 180) * (w / 360);
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (w * mercN) / (2 * Math.PI);
  return [x, Math.max(0, Math.min(h, y))];
}

export function MapPreview({ incidents = [], clusters = [], isLoading, timeRange, onTimeRangeChange }: {
  incidents?: MapIncident[];
  clusters?: MapIncident[];
  isLoading: boolean;
  timeRange?: string;
  onTimeRangeChange?: (v: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const animRef = useRef<number>();
  const timeRef = useRef(0);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const pointPositions = useRef<{ x: number; y: number; point: MapIncident }[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; point: MapIncident } | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<MapIncident | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const createCase = useCreateCase();

  const points = clusters.length > 0 ? clusters : incidents;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const zoom = zoomRef.current;
    const pan = panRef.current;

    timeRef.current += 0.015;
    const pulse = Math.sin(timeRef.current * 3) * 0.5 + 0.5;

    // Dark cinematic background
    ctx.fillStyle = 'hsl(220, 20%, 5%)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Grid lines
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.03)';
    ctx.lineWidth = 0.5 / zoom;
    for (let lat = -80; lat <= 80; lat += 20) {
      const [, y] = projectMercator(lat, 0, W, H);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = projectMercator(0, lon, W, H);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Equator
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.07)';
    const [, eqY] = projectMercator(0, 0, W, H);
    ctx.beginPath(); ctx.moveTo(0, eqY); ctx.lineTo(W, eqY); ctx.stroke();

    // Scan line
    const scanX = (timeRef.current * 35) % W;
    const grad = ctx.createLinearGradient(scanX - 40, 0, scanX + 40, 0);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.1)');
    grad.addColorStop(1, 'transparent');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath(); ctx.moveTo(scanX, 0); ctx.lineTo(scanX, H); ctx.stroke();

    // Plot points
    const positions: { x: number; y: number; point: MapIncident }[] = [];
    for (const p of points) {
      const [x, y] = projectMercator(p.lat, p.lon, W, H);
      const sev = p.severity || p.severity_max || 'info';
      const rgb = SEV_COLORS[sev] || SEV_COLORS.info;
      const count = p.count ?? 1;
      const radius = Math.min(14, 3 + Math.sqrt(count) * 2) / zoom;

      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, radius + 6 / zoom + pulse * 4 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${0.04 + pulse * 0.04})`;
      ctx.fill();

      // Main dot
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, 0.8)`;
      ctx.fill();

      // Asset match ring
      if (p.has_asset_match || p.asset_match) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3 / zoom, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Count label
      if (count > 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `bold ${Math.max(8, 10 / zoom)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(count), x, y);
      }

      positions.push({ x: x * zoom + pan.x, y: y * zoom + pan.y, point: p });
    }
    pointPositions.current = positions;

    ctx.restore();

    // HUD overlay
    ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CATSHY THREAT MAP', 12, 20);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${points.length} INCIDENTS`, 12, 34);

    animRef.current = requestAnimationFrame(draw);
  }, [points]);

  useEffect(() => {
    if (!isLoading) animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw, isLoading]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      panRef.current.x += e.clientX - lastMouse.current.x;
      panRef.current.y += e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    // Hover detection
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let found: typeof hoveredPoint = null;
    for (const pos of pointPositions.current) {
      const dist = Math.sqrt((pos.x - mx) ** 2 + (pos.y - my) ** 2);
      if (dist < 18) { found = pos; break; }
    }
    setHoveredPoint(found);
  };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.5, Math.min(5, zoomRef.current - e.deltaY * 0.001));
  };
  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (const pos of pointPositions.current) {
      const dist = Math.sqrt((pos.x - mx) ** 2 + (pos.y - my) ** 2);
      if (dist < 18) {
        setSelectedIncident(pos.point);
        setAnalysisOpen(true);
        return;
      }
    }
  };

  const handleAcceptMobilize = async () => {
    if (!selectedIncident) return;
    try {
      await createCase.mutateAsync({
        title: `Mobilize: ${selectedIncident.title || selectedIncident.sample_titles?.[0] || 'Threat Incident'}`,
        description: `Created from Dashboard Map.\nSeverity: ${selectedIncident.severity || selectedIncident.severity_max}\nRisk: ${selectedIncident.risk ?? 'N/A'}`,
        priority: (selectedIncident.severity || selectedIncident.severity_max) === 'critical' ? 'critical' : 'medium',
      });
      toast({ title: 'Case created & mobilized', description: 'Playbooks triggered if configured.' });
      setAnalysisOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to create case', variant: 'destructive' });
    }
  };

  return (
    <>
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0 relative">
          {isLoading ? (
            <Skeleton className="w-full aspect-video" />
          ) : (
            <div className="relative w-full aspect-video">
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { handleMouseUp(); setHoveredPoint(null); }}
                onWheel={handleWheel}
                onClick={handleCanvasClick}
              />

              {/* Threat Levels floating panel */}
              <div className="absolute top-3 left-3 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 space-y-1">
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Threat Levels</p>
                {THREAT_LEVELS.map(tl => (
                  <div key={tl.key} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tl.color }} />
                    <span className="text-[10px] font-mono text-muted-foreground">{tl.label}</span>
                  </div>
                ))}
              </div>

              {/* Mini filter controls */}
              <div className="absolute top-3 right-14 flex items-center gap-1.5">
                {onTimeRangeChange && (
                  <Select value={timeRange || '24h'} onValueChange={onTimeRangeChange}>
                    <SelectTrigger className="h-7 w-[100px] text-[10px] bg-card/90 backdrop-blur-sm border-border">
                      <Clock className="h-2.5 w-2.5 mr-1" /><SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="6h">6 hours</SelectItem>
                      <SelectItem value="24h">24 hours</SelectItem>
                      <SelectItem value="7d">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Zoom controls */}
              <div className="absolute bottom-3 right-3 flex flex-col gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7 bg-card/90 backdrop-blur-sm border-border" onClick={() => { zoomRef.current = Math.min(5, zoomRef.current + 0.3); }}>
                  <ZoomIn className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7 bg-card/90 backdrop-blur-sm border-border" onClick={() => { zoomRef.current = Math.max(0.5, zoomRef.current - 0.3); }}>
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7 bg-card/90 backdrop-blur-sm border-border" onClick={() => { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }}>
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>

              {/* Expand button */}
              <Button
                variant="outline"
                size="icon"
                className="absolute top-3 right-3 h-7 w-7 bg-card/90 backdrop-blur-sm border-border"
                onClick={() => navigate('/global-threat-monitoring')}
                title="Expand to full map"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>

              {/* Hover tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none z-20 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg"
                  style={{ left: hoveredPoint.x + 12, top: hoveredPoint.y - 10, maxWidth: 220 }}
                >
                  <p className="text-[10px] font-medium text-foreground truncate">
                    {hoveredPoint.point.title || hoveredPoint.point.sample_titles?.[0] || 'Incident'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[8px] px-1 ${SEV_BADGE[hoveredPoint.point.severity || hoveredPoint.point.severity_max || 'info']}`}>
                      {hoveredPoint.point.severity || hoveredPoint.point.severity_max || 'info'}
                    </Badge>
                    {(hoveredPoint.point.count ?? 1) > 1 && (
                      <span className="text-[9px] text-muted-foreground font-mono">{hoveredPoint.point.count} incidents</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini Analysis Panel */}
      <Sheet open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <SheetContent className="w-[420px] bg-card border-border overflow-y-auto">
          {selectedIncident && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />Threat Analysis
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div>
                  <Badge variant="outline" className={SEV_BADGE[selectedIncident.severity || selectedIncident.severity_max || 'info']}>
                    {selectedIncident.severity || selectedIncident.severity_max || 'info'}
                  </Badge>
                  <h3 className="text-sm font-medium text-foreground mt-2">
                    {selectedIncident.title || selectedIncident.sample_titles?.[0] || 'Threat Incident'}
                  </h3>
                  {selectedIncident.source_name && <p className="text-xs text-muted-foreground mt-1">Source: {selectedIncident.source_name}</p>}
                  {selectedIncident.country_name && <p className="text-xs text-muted-foreground">Location: {selectedIncident.country_name}{selectedIncident.city ? `, ${selectedIncident.city}` : ''}</p>}
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Crosshair className="h-3 w-3" />Risk Score
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                      <p className="text-lg font-mono font-bold text-foreground">{selectedIncident.risk ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">Risk</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                      <p className="text-lg font-mono font-bold text-foreground">{selectedIncident.confidence ? `${Math.round(selectedIncident.confidence * 100)}%` : '—'}</p>
                      <p className="text-[10px] text-muted-foreground">Confidence</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                      <p className="text-lg font-mono font-bold text-foreground">{(selectedIncident.asset_match || selectedIncident.has_asset_match) ? 'Yes' : 'No'}</p>
                      <p className="text-[10px] text-muted-foreground">Asset Match</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Shield className="h-3 w-3" />Evidence
                  </h4>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
                    <p className="text-xs text-foreground">Coordinates: {selectedIncident.lat.toFixed(4)}, {selectedIncident.lon.toFixed(4)}</p>
                    {selectedIncident.campaign && <p className="text-xs text-foreground">Campaign: {selectedIncident.campaign}</p>}
                    {selectedIncident.timestamp && <p className="text-xs text-muted-foreground">Time: {new Date(selectedIncident.timestamp).toLocaleString()}</p>}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />Suggested Action
                  </h4>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs text-primary">
                      {(selectedIncident.severity || selectedIncident.severity_max) === 'critical'
                        ? 'Immediate response. Create case and trigger incident playbook.'
                        : 'Monitor and enrich. Escalate if pattern recurs.'}
                    </p>
                  </div>
                </div>

                <Button className="w-full" size="sm" onClick={handleAcceptMobilize} disabled={createCase.isPending}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {createCase.isPending ? 'Creating...' : 'Accept & Mobilize'}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">Creates Case, triggers Playbooks, sends notifications.</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
