/**
 * WorldMap2D — Clean flat 2D threat map with pan/zoom,
 * hover tooltips, no animated particles.
 */
import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
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
const MAX_ARCS = 80;
const MAX_POINTS = 400;

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(5, Math.max(0.8, prev - e.deltaY * 0.002)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const points = useMemo(() =>
    filteredEvents.slice(0, MAX_POINTS).map(ev => ({
      ...latLonToXY(ev.source.lat, ev.source.lon, W, H),
      ev,
      color: SEVERITY_COLORS[ev.severity],
      r: ev.severity === 'critical' ? 4 : ev.severity === 'high' ? 3 : ev.severity === 'medium' ? 2.2 : 1.5,
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
        opacity: ev.severity === 'critical' ? 0.5 : ev.severity === 'high' ? 0.2 : 0.08,
        width: ev.severity === 'critical' ? 1.5 : ev.severity === 'high' ? 1 : 0.4,
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

  // Continent outlines (simplified paths for major landmasses)
  const continentPaths = useMemo(() => {
    const regions: { name: string; coords: [number, number][] }[] = [
      // North America (simplified)
      { name: 'na', coords: [[-10,170],[-10,168],[15,145],[25,130],[30,105],[48,90],[55,80],[60,70],[72,65],[75,60],[72,50],[65,55],[50,55],[45,60],[35,75],[30,80],[25,85],[20,95],[15,100],[10,105],[5,110],[0,105],[-5,100],[-10,105],[-10,170]] },
    ];
    // We'll use grid lines instead for a cleaner look
    return regions;
  }, []);

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let lat = -60; lat <= 80; lat += 20) {
      const p1 = latLonToXY(lat, -180, W, H);
      const p2 = latLonToXY(lat, 180, W, H);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    for (let lon = -180; lon <= 180; lon += 20) {
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
    <div
      ref={containerRef}
      className="w-full h-full relative flex items-center justify-center overflow-hidden select-none"
      style={{ background: 'linear-gradient(180deg, #060d18 0%, #0a1628 50%, #0c1a30 100%)' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full max-h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
          cursor: isPanning.current ? 'grabbing' : 'grab',
        }}
      >
        <defs>
          <filter id="glow2d">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grid */}
        {gridLines.map((l, i) => (
          <line
            key={i}
            x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="rgba(59,130,246,0.05)"
            strokeWidth="0.4"
          />
        ))}

        {/* Attack arcs — static, no particles */}
        {arcs.map(a => (
          <g key={a.id}>
            <path d={a.d} fill="none" stroke={a.color} strokeWidth={a.width * 2.5} opacity={a.opacity * 0.15} />
            <path d={a.d} fill="none" stroke={a.color} strokeWidth={a.width} opacity={a.opacity} strokeLinecap="round" />
          </g>
        ))}

        {/* Heatmap glow under dots */}
        {points.map((p, i) => (
          <circle
            key={`hm-${i}`}
            cx={p.x} cy={p.y}
            r={p.r * 6}
            fill={p.color}
            opacity={0.04}
          />
        ))}

        {/* Event dots — clean, static */}
        {points.map((p, i) => (
          <g key={`dot-${i}`}>
            <circle
              cx={p.x} cy={p.y}
              r={p.r}
              fill={p.color}
              opacity={0.85}
              className="cursor-pointer"
              onClick={() => handleClick(p.ev)}
              onMouseOver={(e) => handlePointerOver(p.ev, e)}
              onMouseOut={handlePointerOut}
            />
            {/* Subtle glow ring for critical only */}
            {p.ev.severity === 'critical' && (
              <circle
                cx={p.x} cy={p.y}
                r={p.r * 2.5}
                fill="none"
                stroke={p.color}
                strokeWidth="0.6"
                opacity={0.3}
              />
            )}
          </g>
        ))}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <button
          onClick={() => setZoom(prev => Math.min(5, prev + 0.3))}
          className="bg-card/80 backdrop-blur border border-border/50 rounded-lg w-7 h-7 flex items-center justify-center text-foreground text-xs font-mono hover:bg-card transition-colors"
        >+</button>
        <button
          onClick={() => setZoom(prev => Math.max(0.8, prev - 0.3))}
          className="bg-card/80 backdrop-blur border border-border/50 rounded-lg w-7 h-7 flex items-center justify-center text-foreground text-xs font-mono hover:bg-card transition-colors"
        >−</button>
        <button
          onClick={resetView}
          className="bg-card/80 backdrop-blur border border-border/50 rounded-lg w-7 h-7 flex items-center justify-center text-muted-foreground text-[8px] font-mono hover:bg-card transition-colors"
        >⟲</button>
      </div>

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
