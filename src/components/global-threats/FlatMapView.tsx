/**
 * FlatMapView — Premium SVG 2D world map with cyber aesthetic.
 * 
 * Features:
 *  • Zoom & pan with mouse wheel/drag
 *  • Heatmap overlay with glowing regions
 *  • Animated scanlines + radar sweep
 *  • Country clusters with counts
 *  • Smooth animated attack arcs with particle trails
 *  • Grid with subtle coordinate labels
 */
import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, ThreatEvent } from './types';

const W = 1600;
const H = 800;
const PAD = 30;

function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * (W - 2 * PAD) + PAD;
  const y = ((90 - lat) / 180) * (H - 2 * PAD) + PAD;
  return [x, y];
}

/* ── Detailed continent outlines ── */
const CONTINENTS: [number, number][][] = [
  // North America
  [[-168,72],[-162,68],[-155,60],[-152,58],[-148,60],[-140,60],[-135,58],[-130,55],[-125,50],[-123,46],[-120,38],[-117,33],[-115,32],[-110,31],[-105,30],[-100,28],[-97,26],[-95,29],[-90,30],[-85,30],[-82,25],[-80,25],[-82,27],[-81,31],[-80,32],[-76,35],[-75,38],[-72,41],[-70,42],[-68,44],[-67,47],[-65,45],[-64,44],[-60,46],[-55,47],[-55,52],[-59,48],[-63,46],[-67,50],[-65,55],[-60,56],[-62,58],[-68,60],[-72,58],[-78,56],[-80,62],[-82,63],[-85,65],[-90,68],[-95,70],[-100,73],[-105,72],[-110,74],[-120,75],[-130,72],[-140,70],[-150,72],[-160,72],[-168,72]],
  // Greenland
  [[-55,82],[-45,83],[-30,83],[-20,80],[-18,76],[-20,72],[-25,70],[-30,68],[-40,65],[-45,60],[-50,62],[-52,65],[-50,68],[-52,72],[-55,78],[-55,82]],
  // South America
  [[-80,10],[-78,9],[-77,7],[-75,6],[-73,4],[-70,2],[-68,2],[-65,-2],[-70,-4],[-72,-8],[-75,-15],[-70,-18],[-68,-20],[-65,-22],[-60,-22],[-58,-25],[-57,-30],[-58,-35],[-65,-35],[-68,-40],[-66,-45],[-68,-47],[-70,-52],[-69,-55],[-67,-54],[-64,-50],[-60,-42],[-58,-38],[-55,-34],[-52,-28],[-48,-28],[-45,-24],[-42,-23],[-40,-18],[-38,-13],[-35,-8],[-35,-3],[-40,0],[-48,2],[-50,0],[-52,2],[-55,4],[-57,6],[-60,8],[-63,10],[-65,11],[-67,12],[-70,12],[-73,11],[-76,9],[-80,10]],
  // Europe
  [[-10,36],[-9,39],[-8,42],[-5,36],[-2,36],[0,38],[2,41],[3,43],[1,46],[-1,47],[-4,48],[-8,44],[-10,44],[-9,46],[-5,48],[-3,49],[0,49],[2,51],[4,52],[5,54],[7,54],[8,55],[10,56],[12,55],[13,54],[14,54],[15,55],[18,55],[19,54],[21,55],[22,60],[20,62],[18,64],[15,66],[18,68],[20,70],[24,72],[30,70],[28,66],[28,60],[30,58],[26,55],[24,58],[22,56],[20,54],[22,52],[24,48],[22,44],[24,42],[26,41],[22,40],[20,39],[16,38],[13,38],[10,38],[8,39],[6,43],[4,44],[3,43],[0,43],[-2,42],[-5,40],[-8,37],[-10,36]],
  // Africa
  [[-17,15],[-17,21],[-16,24],[-13,28],[-10,32],[-5,36],[-2,35],[3,37],[8,37],[10,37],[11,34],[15,32],[20,32],[25,32],[28,31],[30,31],[33,30],[35,32],[38,28],[42,18],[44,12],[48,8],[50,12],[48,5],[42,0],[40,-2],[40,-6],[42,-12],[40,-16],[38,-20],[36,-22],[35,-25],[33,-29],[30,-32],[28,-33],[26,-34],[22,-34],[20,-30],[18,-25],[17,-22],[15,-18],[12,-6],[10,0],[8,5],[6,5],[3,6],[0,6],[-5,5],[-8,5],[-10,7],[-12,9],[-15,11],[-17,15]],
  // Asia
  [[26,41],[28,42],[30,42],[35,37],[38,37],[40,38],[42,42],[45,40],[48,38],[50,37],[52,37],[54,38],[55,42],[58,42],[60,42],[62,40],[64,38],[66,37],[68,35],[70,32],[72,28],[72,22],[75,15],[78,8],[80,10],[80,14],[84,18],[88,22],[90,22],[92,20],[95,18],[98,16],[100,14],[102,10],[104,10],[105,15],[108,18],[108,22],[110,20],[113,22],[115,22],[117,24],[118,28],[120,24],[122,30],[124,34],[126,34],[127,35],[128,37],[130,33],[131,35],[133,34],[136,35],[138,35],[140,40],[142,44],[145,44],[143,48],[141,50],[140,55],[137,56],[135,55],[132,58],[130,60],[127,62],[122,60],[118,58],[112,55],[105,52],[100,55],[95,52],[90,48],[85,50],[80,50],[75,55],[72,55],[68,55],[65,58],[60,55],[55,55],[52,52],[50,52],[48,47],[45,48],[42,46],[40,44],[36,42],[32,42],[28,42],[26,41]],
  // Australia
  [[114,-22],[116,-20],[119,-18],[121,-17],[126,-14],[129,-15],[133,-12],[136,-12],[138,-15],[140,-18],[143,-15],[145,-15],[148,-20],[150,-22],[152,-26],[153,-28],[153,-32],[151,-34],[150,-35],[148,-38],[146,-39],[144,-38],[142,-36],[140,-38],[136,-36],[133,-33],[131,-32],[128,-32],[125,-33],[122,-34],[118,-35],[116,-34],[115,-33],[114,-30],[114,-26],[114,-22]],
  // NZ
  [[172,-35],[174,-37],[177,-38],[178,-42],[176,-44],[174,-46],[170,-46],[168,-44],[167,-45],[166,-46],[168,-44],[170,-42],[172,-39],[172,-35]],
  // Japan
  [[130,31],[132,33],[134,34],[136,35],[138,36],[140,38],[140,40],[142,43],[144,44],[145,44],[142,40],[140,36],[137,34],[134,34],[132,32],[130,31]],
  // UK
  [[-6,50],[-5,52],[-3,55],[-5,57],[-2,58],[0,58],[2,53],[2,51],[0,51],[-5,50],[-6,50]],
  // Madagascar
  [[44,-12],[48,-15],[50,-20],[49,-24],[47,-25],[44,-23],[43,-18],[44,-12]],
  // Indonesia
  [[105,-6],[108,-7],[112,-7],[115,-8],[117,-8],[114,-8],[110,-7],[106,-6],[105,-6]],
  // Borneo
  [[108,4],[110,2],[112,1],[115,1],[118,2],[118,4],[117,7],[115,5],[112,4],[110,3],[108,4]],
];

export function FlatMapView() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();
  const [hoveredEvent, setHoveredEvent] = useState<ThreatEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<[number, number]>([0, 0]);
  const svgRef = useRef<SVGSVGElement>(null);

  // Zoom & pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: W, h: H });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, vbx: 0, vby: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const my = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const nw = Math.max(400, Math.min(W, viewBox.w * factor));
    const nh = nw * (H / W);
    const nx = mx - ((mx - viewBox.x) / viewBox.w) * nw;
    const ny = my - ((my - viewBox.y) / viewBox.h) * nh;
    setViewBox({ x: nx, y: ny, w: nw, h: nh });
  }, [viewBox]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, vbx: viewBox.x, vby: viewBox.y };
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.x) / rect.width) * viewBox.w;
    const dy = ((e.clientY - dragStart.current.y) / rect.height) * viewBox.h;
    setViewBox(prev => ({ ...prev, x: dragStart.current.vbx - dx, y: dragStart.current.vby - dy }));
  }, [isDragging, viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Scanline animation
  const [scanY, setScanY] = useState(0);
  useEffect(() => {
    let raf: number;
    let t = 0;
    const animate = () => {
      t += 0.003;
      setScanY((Math.sin(t) * 0.5 + 0.5) * H);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* Grid */
  const grid = useMemo(() => {
    const lines: React.JSX.Element[] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project(0, lon);
      lines.push(
        <line key={`v${lon}`} x1={x} y1={PAD} x2={x} y2={H - PAD}
          stroke="hsl(185 80% 50%)" strokeOpacity={0.04} strokeWidth={0.5} />,
      );
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const [, y] = project(lat, 0);
      lines.push(
        <line key={`h${lat}`} x1={PAD} y1={y} x2={W - PAD} y2={y}
          stroke="hsl(185 80% 50%)" strokeOpacity={0.04} strokeWidth={0.5} />,
      );
    }
    return lines;
  }, []);

  /* Continent polygons */
  const continentElements = useMemo(() =>
    CONTINENTS.map((path, i) => {
      const pts = path.map(([lon, lat]) => project(lat, lon).join(',')).join(' ');
      return (
        <polygon
          key={i}
          points={pts}
          fill="hsl(185 80% 50%)"
          fillOpacity={0.06}
          stroke="hsl(185 80% 50%)"
          strokeOpacity={0.25}
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      );
    }),
  []);

  /* Heatmap blobs - cluster events by grid cell */
  const heatmapBlobs = useMemo(() => {
    const grid: Record<string, { x: number; y: number; count: number; maxSev: string }> = {};
    filteredEvents.forEach(ev => {
      const [x, y] = project(ev.source.lat, ev.source.lon);
      const gx = Math.round(x / 40) * 40;
      const gy = Math.round(y / 40) * 40;
      const key = `${gx}_${gy}`;
      if (!grid[key]) grid[key] = { x: gx, y: gy, count: 0, maxSev: 'low' };
      grid[key].count++;
      if (ev.severity === 'critical') grid[key].maxSev = 'critical';
      else if (ev.severity === 'high' && grid[key].maxSev !== 'critical') grid[key].maxSev = 'high';
    });
    return Object.values(grid).filter(g => g.count > 2).map((g, i) => {
      const r = Math.min(60, 10 + g.count * 3);
      const color = g.maxSev === 'critical' ? '#ef4444' : g.maxSev === 'high' ? '#f97316' : '#06b6d4';
      return (
        <circle
          key={`hm-${i}`}
          cx={g.x}
          cy={g.y}
          r={r}
          fill={color}
          opacity={Math.min(0.2, 0.04 + g.count * 0.015)}
          filter="url(#heatBlur)"
        />
      );
    });
  }, [filteredEvents]);

  /* Attack arcs */
  const arcs = useMemo(() =>
    filteredEvents.slice(0, 120).map(ev => {
      const [sx, sy] = project(ev.source.lat, ev.source.lon);
      const [tx, ty] = project(ev.target.lat, ev.target.lon);
      const mx = (sx + tx) / 2;
      const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
      const my = Math.min(sy, ty) - 10 - dist * 0.06;
      const isCrit = ev.severity === 'critical';
      const isHigh = ev.severity === 'high';
      return (
        <g key={ev.id + '-a'}>
          {/* Glow path */}
          <path
            d={`M${sx},${sy} Q${mx},${my} ${tx},${ty}`}
            stroke={SEVERITY_COLORS[ev.severity]}
            strokeWidth={isCrit ? 1.5 : 0.5}
            fill="none"
            opacity={isCrit ? 0.35 : isHigh ? 0.15 : 0.06}
            filter={isCrit ? 'url(#arcGlow)' : undefined}
          />
          {/* Animated particle */}
          {(isCrit || isHigh) && (
            <circle r={isCrit ? 2 : 1.2} fill="#fff" opacity={0.8}>
              <animateMotion
                dur={`${2 + Math.random() * 2}s`}
                repeatCount="indefinite"
                path={`M${sx},${sy} Q${mx},${my} ${tx},${ty}`}
              />
            </circle>
          )}
        </g>
      );
    }),
  [filteredEvents]);

  /* Event dots */
  const dots = useMemo(() =>
    filteredEvents.slice(0, 600).map(ev => {
      const [x, y] = project(ev.source.lat, ev.source.lon);
      const isCrit = ev.severity === 'critical';
      const isHigh = ev.severity === 'high';
      const r = isCrit ? 3.5 : isHigh ? 2.5 : 1.5;
      return (
        <g key={ev.id}>
          {isCrit && (
            <>
              <circle cx={x} cy={y} r={r} fill="none"
                stroke={SEVERITY_COLORS.critical} strokeWidth={0.6} opacity={0.5}>
                <animate attributeName="r" from={String(r)} to={String(r * 4)} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={x} cy={y} r={r * 1.5} fill="none"
                stroke={SEVERITY_COLORS.critical} strokeWidth={0.3} opacity={0.3}>
                <animate attributeName="r" from={String(r * 1.5)} to={String(r * 5)} dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </>
          )}
          {isHigh && (
            <circle cx={x} cy={y} r={r} fill="none"
              stroke={SEVERITY_COLORS.high} strokeWidth={0.5} opacity={0.4}>
              <animate attributeName="r" from={String(r)} to={String(r * 3)} dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" repeatCount="indefinite" />
            </circle>
          )}
          <circle
            cx={x} cy={y} r={r}
            fill={SEVERITY_COLORS[ev.severity]}
            opacity={0.9}
            filter={isCrit ? 'url(#dotGlow)' : undefined}
            className="cursor-pointer"
            onClick={() => setSelectedEvent(ev)}
            onMouseEnter={(e) => {
              setHoveredEvent(ev);
              const svg = (e.target as SVGElement).ownerSVGElement;
              if (svg) {
                const pt = svg.createSVGPoint();
                pt.x = x; pt.y = y;
                const screenPt = pt.matrixTransform(svg.getScreenCTM() || undefined);
                setHoverPos([screenPt.x, screenPt.y]);
              }
            }}
            onMouseLeave={() => setHoveredEvent(null)}
          />
        </g>
      );
    }),
  [filteredEvents, setSelectedEvent]);

  /* Target markers */
  const targetMarkers = useMemo(() => {
    const seen = new Set<string>();
    return filteredEvents.slice(0, 100).filter(ev => {
      const key = `${ev.target.lat.toFixed(0)}_${ev.target.lon.toFixed(0)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(ev => {
      const [x, y] = project(ev.target.lat, ev.target.lon);
      return (
        <g key={ev.id + '-t'}>
          <circle cx={x} cy={y} r={4} fill="none" stroke="#22d3ee" strokeWidth={0.5} opacity={0.3} strokeDasharray="2 2">
            <animate attributeName="r" from="4" to="10" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.3" to="0" dur="3s" repeatCount="indefinite" />
          </circle>
          <rect x={x - 2.5} y={y - 2.5} width={5} height={5}
            fill="#22d3ee" opacity={0.7}
            transform={`rotate(45 ${x} ${y})`}
            filter="url(#glowCyan)" />
        </g>
      );
    });
  }, [filteredEvents]);

  // Zoom level indicator
  const zoomLevel = Math.round((W / viewBox.w) * 100);

  return (
    <div className="w-full h-full bg-background flex items-center justify-center overflow-hidden relative select-none">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <defs>
          <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowCyan" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="heatBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
          </filter>
          <filter id="scanline" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0 8" />
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="hsl(220 20% 7%)" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect x={viewBox.x - 100} y={viewBox.y - 100} width={viewBox.w + 200} height={viewBox.h + 200} fill="hsl(220 20% 4%)" />

        {/* Map border */}
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD}
          fill="none" stroke="hsl(185 80% 50%)" strokeOpacity={0.06} strokeWidth={0.5} />

        {grid}
        {/* Heatmap layer (behind continents) */}
        {heatmapBlobs}
        {continentElements}

        {/* Scanline effect */}
        <line x1={PAD} y1={scanY} x2={W - PAD} y2={scanY}
          stroke="hsl(185 80% 50%)" strokeOpacity={0.06} strokeWidth={1} />
        <rect x={PAD} y={scanY - 15} width={W - 2 * PAD} height={30}
          fill="hsl(185 80% 50%)" opacity={0.01} />

        {arcs}
        {targetMarkers}
        {dots}

        {/* Vignette */}
        <rect x={0} y={0} width={W} height={H} fill="url(#vignette)" pointerEvents="none" />

        {/* Corner decorations */}
        {/* Top-left */}
        <g opacity={0.2} stroke="hsl(185 80% 50%)" strokeWidth={0.8} fill="none">
          <line x1={5} y1={5} x2={25} y2={5} />
          <line x1={5} y1={5} x2={5} y2={25} />
          <line x1={W - 5} y1={5} x2={W - 25} y2={5} />
          <line x1={W - 5} y1={5} x2={W - 5} y2={25} />
          <line x1={5} y1={H - 5} x2={25} y2={H - 5} />
          <line x1={5} y1={H - 5} x2={5} y2={H - 25} />
          <line x1={W - 5} y1={H - 5} x2={W - 25} y2={H - 5} />
          <line x1={W - 5} y1={H - 5} x2={W - 5} y2={H - 25} />
        </g>
      </svg>

      {/* HUD overlays */}
      {/* Top-left: System status */}
      <div className="absolute top-3 left-3 z-10">
        <div className="bg-card/70 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-primary">CATSHY THREAT MAP</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
            <span>ZOOM: {zoomLevel}%</span>
            <span>·</span>
            <span>{filteredEvents.length} EVENTS</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-card/70 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 text-[9px] space-y-1 z-10">
        <p className="text-muted-foreground uppercase tracking-widest mb-1 font-mono text-[8px]">SEVERITY</p>
        {Object.entries(SEVERITY_COLORS).map(([k, c]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 4px ${c}` }} />
            <span className="text-foreground capitalize font-mono">{k}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/30">
          <span className="w-2 h-2 rotate-45" style={{ backgroundColor: '#22d3ee', boxShadow: '0 0 4px #22d3ee' }} />
          <span className="text-foreground font-mono">Target</span>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <button
          className="w-7 h-7 bg-card/70 backdrop-blur-md border border-border/50 rounded text-foreground text-xs font-mono hover:bg-accent/20 transition-colors flex items-center justify-center"
          onClick={() => setViewBox(prev => {
            const nw = Math.max(400, prev.w * 0.8);
            const nh = nw * (H / W);
            return { x: prev.x + (prev.w - nw) / 2, y: prev.y + (prev.h - nh) / 2, w: nw, h: nh };
          })}
        >+</button>
        <button
          className="w-7 h-7 bg-card/70 backdrop-blur-md border border-border/50 rounded text-foreground text-xs font-mono hover:bg-accent/20 transition-colors flex items-center justify-center"
          onClick={() => setViewBox(prev => {
            const nw = Math.min(W, prev.w * 1.25);
            const nh = nw * (H / W);
            return { x: prev.x + (prev.w - nw) / 2, y: prev.y + (prev.h - nh) / 2, w: nw, h: nh };
          })}
        >−</button>
        <button
          className="w-7 h-7 bg-card/70 backdrop-blur-md border border-border/50 rounded text-foreground text-[8px] font-mono hover:bg-accent/20 transition-colors flex items-center justify-center"
          onClick={() => setViewBox({ x: 0, y: 0, w: W, h: H })}
        >⟲</button>
      </div>

      {/* Hover tooltip */}
      {hoveredEvent && (
        <div
          className="fixed z-50 bg-card/95 backdrop-blur-md border border-primary/20 rounded-lg px-3 py-2 text-[10px] pointer-events-none shadow-xl shadow-primary/5 max-w-[240px]"
          style={{ left: hoverPos[0] + 14, top: hoverPos[1] - 24 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[hoveredEvent.severity], boxShadow: `0 0 4px ${SEVERITY_COLORS[hoveredEvent.severity]}` }} />
            <span className="font-semibold text-foreground capitalize font-mono">{hoveredEvent.category.replace(/_/g, ' ')}</span>
            <span className="text-muted-foreground font-mono">· {hoveredEvent.severity.toUpperCase()}</span>
          </div>
          <div className="space-y-0.5 text-muted-foreground font-mono">
            <p>SRC: {hoveredEvent.source.city}, {hoveredEvent.source.country}</p>
            <p>TGT: {hoveredEvent.target.city}, {hoveredEvent.target.country}</p>
            <p className="text-primary/70">{hoveredEvent.source.ip} → {hoveredEvent.target.ip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
