import { useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MapIncident {
  lat: number;
  lon: number;
  severity?: string;
  severity_max?: string;
  count?: number;
  has_asset_match?: boolean;
}

const SEV_COLORS: Record<string, string> = {
  critical: '239, 68, 68',
  high: '245, 158, 11',
  medium: '234, 179, 8',
  low: '6, 182, 212',
  info: '100, 116, 139',
};

function projectMercator(lat: number, lon: number, w: number, h: number): [number, number] {
  const x = (lon + 180) * (w / 360);
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (w * mercN) / (2 * Math.PI);
  return [x, Math.max(0, Math.min(h, y))];
}

export function MapPreview({ incidents = [], clusters = [], isLoading }: {
  incidents?: MapIncident[];
  clusters?: MapIncident[];
  isLoading: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const animRef = useRef<number>();
  const timeRef = useRef(0);

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

    timeRef.current += 0.02;
    const pulse = Math.sin(timeRef.current * 3) * 0.5 + 0.5;

    // Background
    ctx.fillStyle = 'hsl(220, 20%, 7%)';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
    ctx.lineWidth = 0.5;
    for (let lat = -60; lat <= 60; lat += 30) {
      const [, y] = projectMercator(lat, 0, W, H);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    for (let lon = -180; lon <= 180; lon += 60) {
      const [x] = projectMercator(0, lon, W, H);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Plot points
    for (const p of points) {
      const [x, y] = projectMercator(p.lat, p.lon, W, H);
      const rgb = SEV_COLORS[p.severity || p.severity_max || 'info'] || SEV_COLORS.info;
      const count = p.count ?? 1;
      const radius = Math.min(12, 2 + Math.sqrt(count) * 1.5);

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, radius + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${0.05 + pulse * 0.05})`;
      ctx.fill();

      // Main dot
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, 0.7)`;
      ctx.fill();

      // Asset match indicator
      if (p.has_asset_match) {
        ctx.strokeStyle = `rgba(16, 185, 129, 0.8)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // HUD
    ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${points.length} INCIDENTS`, 8, 14);

    animRef.current = requestAnimationFrame(draw);
  }, [points]);

  useEffect(() => {
    if (!isLoading) {
      animRef.current = requestAnimationFrame(draw);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw, isLoading]);

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Map className="h-4 w-4 text-primary" />Threat Map
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/global-threats')} title="Expand to full map">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <canvas ref={canvasRef} className="w-full h-[200px] cursor-pointer" onClick={() => navigate('/global-threats')} />
        )}
      </CardContent>
    </Card>
  );
}
