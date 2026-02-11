import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Globe, Pause, Play, Maximize2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

// Simplified country centroids for plotting (lon, lat)
const COUNTRY_COORDS: Record<string, { lon: number; lat: number; name: string }> = {
  US: { lon: -98, lat: 38, name: 'United States' }, CN: { lon: 104, lat: 35, name: 'China' },
  RU: { lon: 90, lat: 60, name: 'Russia' }, DE: { lon: 10, lat: 51, name: 'Germany' },
  GB: { lon: -1, lat: 53, name: 'United Kingdom' }, FR: { lon: 2, lat: 47, name: 'France' },
  IN: { lon: 78, lat: 21, name: 'India' }, BR: { lon: -51, lat: -10, name: 'Brazil' },
  JP: { lon: 138, lat: 36, name: 'Japan' }, KR: { lon: 128, lat: 36, name: 'South Korea' },
  IR: { lon: 53, lat: 33, name: 'Iran' }, KP: { lon: 127, lat: 40, name: 'North Korea' },
  UA: { lon: 32, lat: 49, name: 'Ukraine' }, NL: { lon: 5, lat: 52, name: 'Netherlands' },
  AU: { lon: 134, lat: -25, name: 'Australia' }, SA: { lon: 45, lat: 24, name: 'Saudi Arabia' },
  EG: { lon: 30, lat: 27, name: 'Egypt' }, NG: { lon: 8, lat: 10, name: 'Nigeria' },
  ZA: { lon: 25, lat: -29, name: 'South Africa' }, IL: { lon: 35, lat: 31, name: 'Israel' },
  TR: { lon: 35, lat: 39, name: 'Turkey' }, PK: { lon: 70, lat: 30, name: 'Pakistan' },
  VN: { lon: 106, lat: 16, name: 'Vietnam' }, TW: { lon: 121, lat: 24, name: 'Taiwan' },
  SG: { lon: 104, lat: 1, name: 'Singapore' }, AE: { lon: 54, lat: 24, name: 'UAE' },
};

interface CountryDetail {
  code: string;
  name: string;
  threats: { critical: number; high: number; medium: number; low: number };
  topIocs: string[];
  topEventTypes: string[];
  assetsAffected: number;
}

interface MapEvent {
  source: string;
  target: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export function ThreatMapWidget({
  events = [],
  isLoading,
  myAssetsFirst,
  onToggleMyAssets,
}: {
  events?: MapEvent[];
  isLoading: boolean;
  myAssetsFirst: boolean;
  onToggleMyAssets: (v: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const animRef = useRef<number>();
  const timeRef = useRef(0);
  const navigate = useNavigate();

  const toXY = useCallback((lon: number, lat: number, W: number, H: number) => {
    const x = (lon + 180) / 360 * W;
    const y = (90 - lat) / 180 * H;
    return { x, y };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;

      if (playing) timeRef.current += 0.012;
      const t = timeRef.current;

      // Background
      ctx.fillStyle = 'hsl(220, 20%, 5%)';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'hsla(185, 80%, 50%, 0.04)';
      ctx.lineWidth = 0.5;
      for (let lat = -80; lat <= 80; lat += 20) {
        const { y } = toXY(0, lat, W, H);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let lon = -180; lon <= 180; lon += 30) {
        const { x } = toXY(lon, 0, W, H);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      // Equator
      ctx.strokeStyle = 'hsla(185, 80%, 50%, 0.1)';
      const eqY = toXY(0, 0, W, H).y;
      ctx.beginPath(); ctx.moveTo(0, eqY); ctx.lineTo(W, eqY); ctx.stroke();

      // Scan line
      const scanX = (t * 50) % W;
      const grad = ctx.createLinearGradient(scanX - 30, 0, scanX + 30, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, 'hsla(185, 80%, 50%, 0.2)');
      grad.addColorStop(1, 'transparent');
      ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(scanX, 0); ctx.lineTo(scanX, H); ctx.stroke();

      // Country dots with pulse
      const pulse = Math.sin(t * 3) * 0.5 + 0.5;
      const codes = Object.keys(COUNTRY_COORDS);
      for (const code of codes) {
        const c = COUNTRY_COORDS[code];
        const { x, y } = toXY(c.lon, c.lat, W, H);
        // Pulse ring
        ctx.beginPath(); ctx.arc(x, y, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(185, 80%, 50%, 0.08)'; ctx.fill();
        // Core dot
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = hoveredCountry === code ? 'hsl(185, 80%, 70%)' : 'hsla(185, 80%, 50%, 0.5)';
        ctx.fill();
      }

      // Animated arcs for events
      if (events.length > 0) {
        for (const ev of events) {
          const src = COUNTRY_COORDS[ev.source];
          const tgt = COUNTRY_COORDS[ev.target];
          if (!src || !tgt) continue;
          const s = toXY(src.lon, src.lat, W, H);
          const e = toXY(tgt.lon, tgt.lat, W, H);
          const mx = (s.x + e.x) / 2;
          const my = Math.min(s.y, e.y) - 30 - Math.random() * 10;
          const col = ev.severity === 'critical' ? '0, 72%, 51%' : ev.severity === 'high' ? '38, 92%, 50%' : '185, 80%, 50%';
          ctx.strokeStyle = `hsla(${col}, 0.2)`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(mx, my, e.x, e.y); ctx.stroke();
          const prog = (t * 0.4 + events.indexOf(ev) * 0.15) % 1;
          const dx = (1 - prog) ** 2 * s.x + 2 * (1 - prog) * prog * mx + prog ** 2 * e.x;
          const dy = (1 - prog) ** 2 * s.y + 2 * (1 - prog) * prog * my + prog ** 2 * e.y;
          ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${col}, 0.8)`; ctx.fill();
        }
      }

      // HUD
      ctx.fillStyle = 'hsla(185, 80%, 50%, 0.4)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('CATSHY GLOBAL THREAT MAP', 12, 18);
      ctx.fillStyle = 'hsla(210, 20%, 50%, 0.4)';
      ctx.fillText(`T+${Math.floor(t)}s  |  ${events.length} EVENTS`, 12, 32);
      if (myAssetsFirst) {
        ctx.fillStyle = 'hsla(160, 70%, 40%, 0.6)';
        ctx.fillText('⦿ MY ASSETS FOCUSED', W - 150, 18);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    const obs = new ResizeObserver(() => { resize(); });
    obs.observe(canvas);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); obs.disconnect(); };
  }, [playing, events, hoveredCountry, myAssetsFirst, toXY]);

  // Handle clicks on canvas
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = rect.width, H = rect.height;
    for (const [code, c] of Object.entries(COUNTRY_COORDS)) {
      const { x, y } = toXY(c.lon, c.lat, W, H);
      if (Math.hypot(mx - x, my - y) < 12) {
        setSelectedCountry({
          code, name: c.name,
          threats: { critical: 0, high: 0, medium: 0, low: 0 },
          topIocs: [], topEventTypes: [], assetsAffected: 0,
        });
        setDrawerOpen(true);
        return;
      }
    }
  }, [toXY]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = rect.width, H = rect.height;
    let found: string | null = null;
    for (const [code, c] of Object.entries(COUNTRY_COORDS)) {
      const { x, y } = toXY(c.lon, c.lat, W, H);
      if (Math.hypot(mx - x, my - y) < 12) { found = code; break; }
    }
    setHoveredCountry(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  }, [toXY]);

  if (isLoading) return <Card className="border-border bg-card"><CardContent className="p-6"><Skeleton className="h-[340px] w-full" /></CardContent></Card>;

  return (
    <>
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-primary" />
            Global Threat Intelligence Map
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="my-assets" checked={myAssetsFirst} onCheckedChange={onToggleMyAssets} className="h-4 w-7" />
              <Label htmlFor="my-assets" className="text-xs text-muted-foreground cursor-pointer">My Assets First</Label>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlaying(!playing)}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/threat-map')}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <canvas
            ref={canvasRef}
            className="w-full h-[340px] block"
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMove}
          />
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[480px] bg-card border-border overflow-y-auto">
          {selectedCountry && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground">{selectedCountry.name} ({selectedCountry.code})</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Threats by Severity</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                      <div key={s} className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                        <p className="text-lg font-mono font-bold text-foreground">{selectedCountry.threats[s]}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedCountry.topIocs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top IOCs</h4>
                    <div className="space-y-1">
                      {selectedCountry.topIocs.map((ioc, i) => (
                        <code key={i} className="block text-xs font-mono text-foreground bg-secondary/50 rounded px-2 py-1">{ioc}</code>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCountry.assetsAffected > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm text-primary font-medium">{selectedCountry.assetsAffected} of your assets affected</p>
                  </div>
                )}

                {selectedCountry.threats.critical === 0 && selectedCountry.threats.high === 0 && (
                  <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center">
                    <p className="text-sm text-muted-foreground">No threat data for this country yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Enable sources & add assets to start collecting intelligence.</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDrawerOpen(false); navigate(`/investigations`); }}>
                    Investigate
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDrawerOpen(false); navigate(`/alerts`); }}>
                    Create Alert Rule
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
