/**
 * WorldMap2D — Flat 2D threat map with Mercator projection.
 */
import { useMemo, useCallback } from 'react';
import { useThreatContext } from './ThreatContext';
import { ThreatEvent, SEVERITY_COLORS } from './types';

function latLonToXY(lat: number, lon: number, w: number, h: number) {
  const x = ((lon + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (w * mercN) / (2 * Math.PI);
  return { x, y: Math.max(0, Math.min(h, y)) };
}

const W = 1200;
const H = 600;
const MAX_ARCS = 80;
const MAX_POINTS = 400;

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl px-3 py-2.5 text-[9px] space-y-1 z-10 shadow-lg">
      <p className="text-muted-foreground uppercase tracking-widest mb-1 font-mono text-[8px]">SEVERITY</p>
      {Object.entries(SEVERITY_COLORS).map(([k, c]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }} />
          <span className="text-foreground capitalize font-mono">{k}</span>
        </div>
      ))}
    </div>
  );
}

export function WorldMap2D() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();

  const points = useMemo(() =>
    filteredEvents.slice(0, MAX_POINTS).map(ev => ({
      ...latLonToXY(ev.source.lat, ev.source.lon, W, H),
      ev,
      color: SEVERITY_COLORS[ev.severity],
      r: ev.severity === 'critical' ? 4 : ev.severity === 'high' ? 3 : 2,
    })),
  [filteredEvents]);

  const arcs = useMemo(() =>
    filteredEvents.slice(0, MAX_ARCS).map(ev => {
      const s = latLonToXY(ev.source.lat, ev.source.lon, W, H);
      const t = latLonToXY(ev.target.lat, ev.target.lon, W, H);
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2 - Math.abs(s.x - t.x) * 0.15;
      return {
        id: ev.id,
        d: `M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`,
        color: SEVERITY_COLORS[ev.severity],
        opacity: ev.severity === 'critical' ? 0.7 : ev.severity === 'high' ? 0.35 : 0.12,
        width: ev.severity === 'critical' ? 1.5 : ev.severity === 'high' ? 1 : 0.5,
      };
    }),
  [filteredEvents]);

  const handleClick = useCallback((ev: ThreatEvent) => {
    setSelectedEvent(ev);
  }, [setSelectedEvent]);

  // Simple world outline (simplified coastlines via rect placeholder)
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    // Latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
      const p1 = latLonToXY(lat, -180, W, H);
      const p2 = latLonToXY(lat, 180, W, H);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    // Longitude lines every 30°
    for (let lon = -180; lon <= 180; lon += 30) {
      const pts: { x: number; y: number }[] = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        pts.push(latLonToXY(lat, lon, W, H));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        lines.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
      }
    }
    return lines;
  }, []);

  return (
    <div className="w-full h-full relative bg-[#020408] flex items-center justify-center overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full max-h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid */}
        {gridLines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="rgba(77,158,255,0.08)"
            strokeWidth="0.5"
          />
        ))}

        {/* Attack arcs */}
        {arcs.map(a => (
          <path
            key={a.id}
            d={a.d}
            fill="none"
            stroke={a.color}
            strokeWidth={a.width}
            opacity={a.opacity}
          />
        ))}

        {/* Heatmap glow */}
        {points.map((p, i) => (
          <circle
            key={`glow-${i}`}
            cx={p.x} cy={p.y}
            r={p.r * 4}
            fill={p.color}
            opacity={0.08}
          />
        ))}

        {/* Event dots */}
        {points.map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p.x} cy={p.y}
            r={p.r}
            fill={p.color}
            stroke={p.color}
            strokeWidth="0.5"
            opacity={0.9}
            className="cursor-pointer hover:opacity-100"
            onClick={() => handleClick(p.ev)}
          >
            {p.ev.severity === 'critical' && (
              <animate attributeName="r" values={`${p.r};${p.r * 1.8};${p.r}`} dur="2s" repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </svg>

      {/* Title overlay */}
      <div className="absolute top-3 left-3 z-10">
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl px-3 py-2 shadow-lg">
          <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-primary font-semibold">
            CATSHY THREAT MAP
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
            {filteredEvents.length} ACTIVE THREATS · 2D VIEW
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}
