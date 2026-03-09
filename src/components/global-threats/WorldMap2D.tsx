/**
 * WorldMap2D — Enhanced flat 2D threat map with hover tooltips,
 * animated arc particles, severity pulse, and interactive zoom.
 */
import { useMemo, useCallback, useState, useRef } from 'react';
import { useThreatContext } from './ThreatContext';
import { ThreatEvent, SEVERITY_COLORS, CATEGORY_LABELS } from './types';

function latLonToXY(lat: number, lon: number, w: number, h: number) {
  const x = ((lon + 180) / 360) * w;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (w * mercN) / (2 * Math.PI);
  return { x, y: Math.max(0, Math.min(h, y)) };
}

const W = 1200;
const H = 600;
const MAX_ARCS = 100;
const MAX_POINTS = 500;

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 bg-card/85 backdrop-blur-xl border border-border/50 rounded-xl px-3 py-2.5 text-[9px] space-y-1 z-10 shadow-2xl">
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

function HoverTooltip({ event, position }: { event: ThreatEvent | null; position: { x: number; y: number } | null }) {
  if (!event || !position) return null;
  const sevColor = SEVERITY_COLORS[event.severity];

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: position.x + 14, top: position.y - 10, maxWidth: '260px' }}
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-lg px-3 py-2 shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sevColor, boxShadow: `0 0 6px ${sevColor}` }} />
          <span className="text-[9px] font-mono uppercase font-bold text-foreground">
            {event.severity} — {CATEGORY_LABELS[event.category]}
          </span>
        </div>
        <div className="space-y-0.5 text-[8px] font-mono">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Source</span>
            <span className="text-foreground">{event.source.city}, {event.source.country}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Target</span>
            <span className="text-foreground">{event.target.city}, {event.target.country}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">IP</span>
            <span className="text-foreground">{event.source.ip}</span>
          </div>
          {event.indicators.cve && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">CVE</span>
              <span className="text-destructive font-bold">{event.indicators.cve}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WorldMap2D() {
  const { filteredEvents, setSelectedEvent, setZoomToEvent } = useThreatContext();
  const [hoveredEvent, setHoveredEvent] = useState<ThreatEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = useMemo(() =>
    filteredEvents.slice(0, MAX_POINTS).map(ev => ({
      ...latLonToXY(ev.source.lat, ev.source.lon, W, H),
      ev,
      color: SEVERITY_COLORS[ev.severity],
      r: ev.severity === 'critical' ? 4.5 : ev.severity === 'high' ? 3.5 : ev.severity === 'medium' ? 2.5 : 1.8,
    })),
  [filteredEvents]);

  const arcs = useMemo(() =>
    filteredEvents.slice(0, MAX_ARCS).map(ev => {
      const s = latLonToXY(ev.source.lat, ev.source.lon, W, H);
      const t = latLonToXY(ev.target.lat, ev.target.lon, W, H);
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2 - Math.abs(s.x - t.x) * 0.18;
      return {
        id: ev.id,
        d: `M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`,
        color: SEVERITY_COLORS[ev.severity],
        opacity: ev.severity === 'critical' ? 0.65 : ev.severity === 'high' ? 0.3 : 0.1,
        width: ev.severity === 'critical' ? 1.8 : ev.severity === 'high' ? 1.2 : 0.5,
        severity: ev.severity,
      };
    }),
  [filteredEvents]);

  const handleClick = useCallback((ev: ThreatEvent) => {
    setSelectedEvent(ev);
    setZoomToEvent(ev);
  }, [setSelectedEvent, setZoomToEvent]);

  const handlePointerOver = useCallback((ev: ThreatEvent, e: React.MouseEvent) => {
    setHoveredEvent(ev);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerOut = useCallback(() => {
    setHoveredEvent(null);
    setHoverPos(null);
  }, []);

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const p1 = latLonToXY(lat, -180, W, H);
      const p2 = latLonToXY(lat, 180, W, H);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
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
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full max-h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Animated particle along arc */}
          {arcs.filter(a => a.severity === 'critical' || a.severity === 'high').map(a => (
            <circle key={`particle-${a.id}`} r={a.severity === 'critical' ? 3 : 2} fill="#ffffff">
              <animateMotion dur={a.severity === 'critical' ? '2s' : '3s'} repeatCount="indefinite" path={a.d} />
            </circle>
          ))}

          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {gridLines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="rgba(77,158,255,0.06)"
            strokeWidth="0.5"
          />
        ))}

        {/* Attack arcs */}
        {arcs.map(a => (
          <g key={a.id}>
            {/* Glow layer */}
            <path d={a.d} fill="none" stroke={a.color} strokeWidth={a.width * 3} opacity={a.opacity * 0.2} />
            {/* Main arc */}
            <path d={a.d} fill="none" stroke={a.color} strokeWidth={a.width} opacity={a.opacity} />
            {/* Traveling particle */}
            {(a.severity === 'critical' || a.severity === 'high') && (
              <circle r={a.severity === 'critical' ? 2.5 : 1.8} fill="#ffffff" opacity="0.9" filter="url(#glow)">
                <animateMotion dur={a.severity === 'critical' ? '2.5s' : '4s'} repeatCount="indefinite" path={a.d} />
              </circle>
            )}
          </g>
        ))}

        {/* Heatmap glow */}
        {points.map((p, i) => (
          <circle
            key={`glow-${i}`}
            cx={p.x} cy={p.y}
            r={p.r * 5}
            fill={p.color}
            opacity={0.06}
          />
        ))}

        {/* Event dots */}
        {points.map((p, i) => (
          <g key={`dot-${i}`}>
            {/* Outer pulse for critical */}
            {p.ev.severity === 'critical' && (
              <circle cx={p.x} cy={p.y} r={p.r} fill="none" stroke={p.color} strokeWidth="0.8" opacity="0.4">
                <animate attributeName="r" values={`${p.r};${p.r * 3};${p.r}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={p.x} cy={p.y}
              r={p.r}
              fill={p.color}
              stroke={p.color}
              strokeWidth="0.5"
              opacity={0.9}
              className="cursor-pointer transition-all duration-200"
              onClick={() => handleClick(p.ev)}
              onMouseOver={(e) => handlePointerOver(p.ev, e)}
              onMouseOut={handlePointerOut}
              style={{ filter: p.ev.severity === 'critical' ? 'url(#glow)' : undefined }}
            >
              {p.ev.severity === 'critical' && (
                <animate attributeName="r" values={`${p.r};${p.r * 1.5};${p.r}`} dur="1.5s" repeatCount="indefinite" />
              )}
            </circle>
          </g>
        ))}
      </svg>

      {/* Title overlay */}
      <div className="absolute top-3 left-3 z-10">
        <div className="bg-card/85 backdrop-blur-xl border border-border/50 rounded-xl px-3 py-2 shadow-2xl">
          <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-primary font-semibold">
            CATSHY THREAT MAP
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
            {filteredEvents.length} ACTIVE THREATS · 2D VIEW
          </div>
        </div>
      </div>

      <Legend />
      <HoverTooltip event={hoveredEvent} position={hoverPos} />
    </div>
  );
}
