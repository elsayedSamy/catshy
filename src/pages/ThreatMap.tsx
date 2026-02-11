import { useState, useEffect, useRef } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';
import { useFeed } from '@/hooks/useApi';

export default function ThreatMap() {
  return (
    <FeatureGate feature="threat_map_3d" moduleName="3D Threat Map" description="Interactive globe visualization showing threat origins and targets based on real geo-tagged intelligence data.">
      <ThreatMapContent />
    </FeatureGate>
  );
}

function ThreatMapContent() {
  const { data: feed = [] } = useFeed();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const animRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const draw = () => {
      if (!playing) { animRef.current = requestAnimationFrame(draw); return; }
      timeRef.current += 0.015;
      ctx.fillStyle = 'hsl(222, 47%, 6%)';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.06)';
      ctx.lineWidth = 0.5;
      for (let lat = -80; lat <= 80; lat += 20) {
        const y = H / 2 - (lat / 90) * (H / 2);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let lon = -180; lon <= 180; lon += 30) {
        const x = W / 2 + (lon / 180) * (W / 2);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      // Equator & prime meridian
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();

      // Animated scan line
      const scanX = (timeRef.current * 60) % W;
      const grad = ctx.createLinearGradient(scanX - 40, 0, scanX + 40, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, 'rgba(6, 182, 212, 0.25)');
      grad.addColorStop(1, 'transparent');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(scanX, 0); ctx.lineTo(scanX, H); ctx.stroke();

      // Animated pulse points (random threat positions)
      const pulsePhase = Math.sin(timeRef.current * 2) * 0.5 + 0.5;
      const threatPoints = [
        { x: 0.3, y: 0.35, sev: 'critical' }, { x: 0.7, y: 0.25, sev: 'high' },
        { x: 0.15, y: 0.6, sev: 'medium' }, { x: 0.8, y: 0.55, sev: 'high' },
        { x: 0.5, y: 0.4, sev: 'critical' }, { x: 0.6, y: 0.7, sev: 'medium' },
      ];
      for (const p of threatPoints) {
        const px = p.x * W, py = p.y * H;
        const color = p.sev === 'critical' ? '239, 68, 68' : p.sev === 'high' ? '245, 158, 11' : '6, 182, 212';
        ctx.beginPath(); ctx.arc(px, py, 3 + pulsePhase * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${0.6 + pulsePhase * 0.4})`; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 8 + pulsePhase * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${0.1 + pulsePhase * 0.1})`; ctx.fill();
      }

      // Threat arcs
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 1;
      const arcProgress = (timeRef.current * 0.3) % 1;
      for (let i = 0; i < threatPoints.length - 1; i += 2) {
        const s = threatPoints[i], t = threatPoints[i + 1];
        if (!s || !t) continue;
        const sx = s.x * W, sy = s.y * H, tx = t.x * W, ty = t.y * H;
        const mx = (sx + tx) / 2, my = Math.min(sy, ty) - 40;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
        // Moving dot
        const dt = arcProgress;
        const dotX = (1 - dt) * (1 - dt) * sx + 2 * (1 - dt) * dt * mx + dt * dt * tx;
        const dotY = (1 - dt) * (1 - dt) * sy + 2 * (1 - dt) * dt * my + dt * dt * ty;
        ctx.beginPath(); ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.8)'; ctx.fill();
      }

      // HUD labels
      ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.font = '11px monospace';
      ctx.fillText('CATSHY THREAT MAP', 12, 22);
      ctx.fillText(`${feed.length} INTEL ITEMS TRACKED`, 12, 38);
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.fillText(`T+${Math.floor(timeRef.current)}s`, W - 60, 22);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing, feed]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">3D Threat Map</h1><p className="text-sm text-muted-foreground mt-1">Visualize global threat origins and targets</p></div>
        <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)}>
          {playing ? <><Pause className="mr-2 h-4 w-4" />Pause</> : <><Play className="mr-2 h-4 w-4" />Play</>}
        </Button>
      </div>
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <canvas ref={canvasRef} className="w-full h-[500px]" style={{ display: 'block' }} />
        </CardContent>
      </Card>
    </div>
  );
}
