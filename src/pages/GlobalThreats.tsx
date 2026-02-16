import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ZoomIn, ZoomOut, Rss, AlertTriangle, Shield,
  Target, Brain, CheckCircle, Crosshair, Layers, Clock, Radio,
  RotateCcw, RefreshCw
} from 'lucide-react';
import { useMapIncidents, useCreateCase } from '@/hooks/useApi';
import { toast } from '@/hooks/use-toast';

const SEV_COLORS: Record<string, string> = {
  critical: '239, 68, 68',
  high: '245, 158, 11',
  medium: '234, 179, 8',
  low: '6, 182, 212',
  info: '100, 116, 139',
};

const SEV_BADGE: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-muted text-muted-foreground border-border',
};

const THREAT_LEVELS = [
  { label: 'L1 — LOW', color: '#eab308', key: 'low' },
  { label: 'L2 — MEDIUM', color: '#f97316', key: 'medium' },
  { label: 'L3 — HIGH / CRITICAL', color: '#ef4444', key: 'high' },
];

function projectMercator(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = (lon + 180) * (w / 360);
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (w * mercN) / (2 * Math.PI);
  return [x, Math.max(0, Math.min(h, y))];
}

interface Incident {
  id: string;
  lat: number;
  lon: number;
  country?: string;
  country_name?: string;
  city?: string;
  title: string;
  severity: string;
  asset_match: boolean;
  confidence: number;
  risk: number;
  source_name: string;
  campaign?: string;
  timestamp: string;
}

interface Cluster {
  lat: number;
  lon: number;
  count: number;
  severity_max: string;
  has_asset_match: boolean;
  countries: string[];
  sample_titles: string[];
}

export default function GlobalThreats() {
  const [timeRange, setTimeRange] = useState('24h');
  const [severity, setSeverity] = useState<string>('all');
  const [relevantOnly, setRelevantOnly] = useState(false);
  const [liveToggle, setLiveToggle] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const timeRef = useRef(0);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const incidentPositions = useRef<{ x: number; y: number; incident: Incident }[]>([]);

  const createCase = useCreateCase();

  const { data: mapData, isLoading, refetch } = useMapIncidents({
    range: timeRange,
    severity: severity !== 'all' ? severity : undefined,
    relevant_only: relevantOnly,
    cluster: true,
  });

  useEffect(() => {
    if (!liveToggle) return;
    const timer = setInterval(() => refetch(), 15000);
    return () => clearInterval(timer);
  }, [liveToggle, refetch]);

  const incidents: Incident[] = mapData?.incidents ?? [];
  const clusters: Cluster[] = mapData?.clusters ?? [];
  const points = clusters.length > 0
    ? clusters.map(c => ({ lat: c.lat, lon: c.lon, severity: c.severity_max, count: c.count, has_asset_match: c.has_asset_match, titles: c.sample_titles }))
    : incidents.map(i => ({ lat: i.lat, lon: i.lon, severity: i.severity, count: 1, has_asset_match: i.asset_match, titles: [i.title] }));

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

    ctx.fillStyle = 'hsl(220, 20%, 5%)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Grid
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

    // Equator + prime meridian
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
    const [pmX, eqY] = projectMercator(0, 0, W, H);
    ctx.beginPath(); ctx.moveTo(0, eqY); ctx.lineTo(W, eqY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pmX, 0); ctx.lineTo(pmX, H); ctx.stroke();

    // Scan line
    const scanX = (timeRef.current * 40) % W;
    const grad = ctx.createLinearGradient(scanX - 30, 0, scanX + 30, 0);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.12)');
    grad.addColorStop(1, 'transparent');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath(); ctx.moveTo(scanX, 0); ctx.lineTo(scanX, H); ctx.stroke();

    // Plot
    const positions: { x: number; y: number; incident: Incident }[] = [];
    for (const p of points) {
      const [x, y] = projectMercator(p.lat, p.lon, W, H);
      const rgb = SEV_COLORS[p.severity] || SEV_COLORS.info;
      const radius = Math.min(16, 3 + Math.sqrt(p.count) * 2) / zoom;

      ctx.beginPath();
      ctx.arc(x, y, radius + 6 / zoom + pulse * 4 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${0.04 + pulse * 0.04})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, 0.75)`;
      ctx.fill();

      if (p.has_asset_match) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(x, y, radius + 3 / zoom, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (p.count > 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `bold ${Math.max(9, 11 / zoom)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.count), x, y);
      }
    }

    for (const inc of incidents) {
      const [x, y] = projectMercator(inc.lat, inc.lon, W, H);
      positions.push({ x: x * zoom + pan.x, y: y * zoom + pan.y, incident: inc });
    }
    incidentPositions.current = positions;

    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CATSHY GLOBAL THREATS', 12, 22);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${mapData?.count ?? 0} INCIDENTS | ${timeRange.toUpperCase()}`, 12, 38);
    if (liveToggle) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.fillText('● LIVE', W - 60, 22);
    }

    animRef.current = requestAnimationFrame(draw);
  }, [points, incidents, mapData, timeRange, liveToggle]);

  useEffect(() => {
    if (!isLoading) animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw, isLoading]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    panRef.current.x += e.clientX - lastMouse.current.x;
    panRef.current.y += e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.5, Math.min(5, zoomRef.current - e.deltaY * 0.001));
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    for (const pos of incidentPositions.current) {
      const dist = Math.sqrt((pos.x - clickX) ** 2 + (pos.y - clickY) ** 2);
      if (dist < 15) {
        setSelectedIncident(pos.incident);
        setAnalysisOpen(true);
        return;
      }
    }
  };

  const handleAcceptMobilize = async () => {
    if (!selectedIncident) return;
    try {
      await createCase.mutateAsync({
        title: `Mobilize: ${selectedIncident.title}`,
        description: `Created from Global Threats map.\nSource: ${selectedIncident.source_name}\nSeverity: ${selectedIncident.severity}\nRisk: ${selectedIncident.risk}\nConfidence: ${selectedIncident.confidence}`,
        priority: selectedIncident.severity === 'critical' ? 'critical' : selectedIncident.severity === 'high' ? 'high' : 'medium',
      });
      toast({ title: 'Case created & mobilized', description: `Case created for "${selectedIncident.title}". Playbooks triggered if configured.` });
      setAnalysisOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to create case', variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden -m-4">
      {/* LEFT — Full cinematic map */}
      <div className="flex-1 relative">
        {/* Threat Levels floating panel */}
        <div className="absolute top-4 left-4 z-10 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2.5 space-y-1.5">
          <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Threat Levels</p>
          {THREAT_LEVELS.map(tl => (
            <div key={tl.key} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tl.color }} />
              <span className="text-[10px] font-mono text-muted-foreground">{tl.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-accent" />
            <span className="text-[10px] font-mono text-muted-foreground">Asset Match</span>
          </div>
        </div>

        {/* Zoom + Reset controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border" onClick={() => { zoomRef.current = Math.min(5, zoomRef.current + 0.3); }}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border" onClick={() => { zoomRef.current = Math.max(0.5, zoomRef.current - 0.3); }}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur-sm border-border" onClick={() => { zoomRef.current = 1; panRef.current = { x: 0, y: 0 }; }}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onClick={handleCanvasClick}
          />
        )}
      </div>

      {/* RIGHT PANEL — Threat Feed / Incidents */}
      <div className="w-[340px] shrink-0 border-l border-border bg-card flex flex-col">
        {/* Panel Header with controls */}
        <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Intelligence</h2>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3" />
              </Button>
              <div className="flex items-center gap-1">
                <Switch id="live-global" checked={liveToggle} onCheckedChange={setLiveToggle} className="h-4 w-7" />
                <Label htmlFor="live-global" className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-0.5">
                  <Radio className="h-2.5 w-2.5" />Live
                </Label>
              </div>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-1.5">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-7 flex-1 text-[10px] bg-secondary/50 border-border">
                <Clock className="h-2.5 w-2.5 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="6h">6 hours</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-7 flex-1 text-[10px] bg-secondary/50 border-border">
                <Layers className="h-2.5 w-2.5 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="rel-only" className="text-[10px] text-muted-foreground cursor-pointer">Asset Matched Only</Label>
            <Switch id="rel-only" checked={relevantOnly} onCheckedChange={setRelevantOnly} className="h-4 w-7" />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="feed" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-3 mt-2 shrink-0 bg-secondary/50">
            <TabsTrigger value="feed" className="text-xs">
              <Rss className="h-3 w-3 mr-1" />Threat Feed
            </TabsTrigger>
            <TabsTrigger value="incidents" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />Incidents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Rss className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No geo-tagged intel yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Intel items with IP addresses will appear here after GeoIP enrichment.</p>
              </div>
            ) : (
              <div className="space-y-1 mt-2">
                {incidents.slice(0, 50).map(inc => (
                  <div
                    key={inc.id}
                    className="rounded-lg border border-border bg-secondary/10 px-2 py-1.5 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => { setSelectedIncident(inc); setAnalysisOpen(true); }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[9px] px-1 ${SEV_BADGE[inc.severity] || ''}`}>{inc.severity}</Badge>
                      <span className="text-[10px] text-foreground truncate flex-1">{inc.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">{inc.source_name}</span>
                      {inc.asset_match && <Badge variant="outline" className="text-[8px] px-1 py-0 border-accent/30 text-accent">MATCH</Badge>}
                      {inc.country_name && <span className="text-[9px] text-muted-foreground">{inc.country_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="incidents" className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
            {clusters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Target className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No clusters detected.</p>
              </div>
            ) : (
              <div className="space-y-1 mt-2">
                {clusters.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary/10 px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[9px] px-1 ${SEV_BADGE[c.severity_max] || ''}`}>{c.severity_max}</Badge>
                      <span className="text-[10px] font-mono text-foreground">{c.count} incidents</span>
                      {c.has_asset_match && <Badge variant="outline" className="text-[8px] px-1 py-0 border-accent/30 text-accent">MATCH</Badge>}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{c.countries.join(', ')}</p>
                    {c.sample_titles[0] && <p className="text-[9px] text-muted-foreground truncate">{c.sample_titles[0]}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Threat Analysis Drawer */}
      <Sheet open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <SheetContent className="w-[480px] bg-card border-border overflow-y-auto">
          {selectedIncident && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />AI Threat Analysis
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div>
                  <Badge variant="outline" className={SEV_BADGE[selectedIncident.severity]}>{selectedIncident.severity}</Badge>
                  <h3 className="text-sm font-medium text-foreground mt-2">{selectedIncident.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Source: {selectedIncident.source_name}</p>
                  {selectedIncident.country_name && <p className="text-xs text-muted-foreground">Location: {selectedIncident.country_name}{selectedIncident.city ? `, ${selectedIncident.city}` : ''}</p>}
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Crosshair className="h-3 w-3" />Risk Score Breakdown
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                      <p className="text-lg font-mono font-bold text-foreground">{selectedIncident.risk}</p>
                      <p className="text-[10px] text-muted-foreground">Risk</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                      <p className="text-lg font-mono font-bold text-foreground">{Math.round(selectedIncident.confidence * 100)}%</p>
                      <p className="text-[10px] text-muted-foreground">Confidence</p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                      <p className="text-lg font-mono font-bold text-foreground">{selectedIncident.asset_match ? 'Yes' : 'No'}</p>
                      <p className="text-[10px] text-muted-foreground">Asset Match</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Shield className="h-3 w-3" />Evidence
                  </h4>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
                    <p className="text-xs text-foreground">Geo coordinates: {selectedIncident.lat.toFixed(4)}, {selectedIncident.lon.toFixed(4)}</p>
                    {selectedIncident.campaign && <p className="text-xs text-foreground">Campaign: {selectedIncident.campaign}</p>}
                    <p className="text-xs text-muted-foreground">Timestamp: {new Date(selectedIncident.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Brain className="h-3 w-3" />Reasoning
                  </h4>
                  <div className="rounded-lg border border-border bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground">
                      {selectedIncident.asset_match
                        ? `This incident is directly relevant to your assets. The ${selectedIncident.severity}-severity threat from ${selectedIncident.source_name} was matched against your monitored infrastructure. Immediate attention is recommended.`
                        : `This incident originates from ${selectedIncident.country_name || 'an unknown location'}. While not directly matched to your assets, the ${selectedIncident.severity} severity and ${Math.round(selectedIncident.confidence * 100)}% confidence warrant monitoring.`
                      }
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />Suggested Action
                  </h4>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-xs text-primary">
                      {selectedIncident.severity === 'critical'
                        ? 'Immediate response recommended. Create case and trigger incident response playbook.'
                        : selectedIncident.severity === 'high'
                        ? 'Escalate to analyst. Create case for tracking and enrichment.'
                        : 'Monitor and enrich. Add to watchlist if recurring pattern detected.'
                      }
                    </p>
                  </div>
                </div>

                <Button className="w-full" size="sm" onClick={handleAcceptMobilize} disabled={createCase.isPending}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {createCase.isPending ? 'Creating...' : 'Accept & Mobilize'}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Creates a Case, triggers configured Playbooks, and sends notifications.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
