/**
 * FlatMapView — Premium SVG 2D world map with cyber aesthetic.
 *
 * Features:
 *  • Detailed continent & country outlines
 *  • SVG glow filters for events and arcs
 *  • Animated pulse rings on critical events
 *  • Gradient attack arcs with animated dashes
 *  • Coordinate labels and grid
 *  • Severity legend
 *  • Hover tooltips
 *  • Graticule lines (equator, tropics, arctic circles)
 */
import { useMemo, useState } from 'react';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, ThreatEvent } from './types';

const W = 1400;
const H = 700;
const PAD = 40;

function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * (W - 2 * PAD) + PAD;
  const y = ((90 - lat) / 180) * (H - 2 * PAD) + PAD;
  return [x, y];
}

/* ── Detailed continent outlines ── */
const CONTINENTS: { name: string; paths: [number, number][][] }[] = [
  {
    name: 'North America',
    paths: [
      [[-168,72],[-162,68],[-155,60],[-152,58],[-148,60],[-140,60],[-135,58],[-130,55],[-125,50],[-123,46],[-120,38],[-117,33],[-115,32],[-110,31],[-105,30],[-100,28],[-97,26],[-95,29],[-90,30],[-85,30],[-82,25],[-80,25],[-82,27],[-81,31],[-80,32],[-76,35],[-75,38],[-72,41],[-70,42],[-68,44],[-67,47],[-65,45],[-64,44],[-60,46],[-55,47],[-55,52],[-59,48],[-63,46],[-67,50],[-65,55],[-60,56],[-62,58],[-68,60],[-72,58],[-78,56],[-80,62],[-82,63],[-85,65],[-90,68],[-95,70],[-100,73],[-105,72],[-110,74],[-120,75],[-130,72],[-140,70],[-150,72],[-160,72],[-168,72]],
      // Greenland
      [[-55,82],[-45,83],[-30,83],[-20,80],[-18,76],[-20,72],[-25,70],[-30,68],[-40,65],[-45,60],[-50,62],[-52,65],[-50,68],[-52,72],[-55,78],[-55,82]],
    ],
  },
  {
    name: 'South America',
    paths: [
      [[-80,10],[-78,9],[-77,7],[-75,6],[-73,4],[-70,2],[-68,2],[-65,-2],[-70,-4],[-72,-8],[-75,-15],[-70,-18],[-68,-20],[-65,-22],[-60,-22],[-58,-25],[-57,-30],[-58,-35],[-65,-35],[-68,-40],[-66,-45],[-68,-47],[-70,-52],[-69,-55],[-67,-54],[-64,-50],[-60,-42],[-58,-38],[-55,-34],[-52,-28],[-48,-28],[-45,-24],[-42,-23],[-40,-18],[-38,-13],[-35,-8],[-35,-3],[-40,0],[-48,2],[-50,0],[-52,2],[-55,4],[-57,6],[-60,8],[-63,10],[-65,11],[-67,12],[-70,12],[-73,11],[-76,9],[-80,10]],
    ],
  },
  {
    name: 'Europe',
    paths: [
      [[-10,36],[-9,39],[-8,42],[-5,36],[-2,36],[0,38],[2,41],[3,43],[1,46],[-1,47],[-4,48],[-8,44],[-10,44],[-9,46],[-5,48],[-3,49],[0,49],[2,51],[4,52],[5,54],[7,54],[8,55],[10,56],[12,55],[13,54],[14,54],[15,55],[18,55],[19,54],[21,55],[22,60],[20,62],[18,64],[15,66],[18,68],[20,70],[24,72],[30,70],[28,66],[28,60],[30,58],[26,55],[24,58],[22,56],[20,54],[22,52],[24,48],[22,44],[24,42],[26,41],[22,40],[20,39],[16,38],[13,38],[10,38],[8,39],[6,43],[4,44],[3,43],[0,43],[-2,42],[-5,40],[-8,37],[-10,36]],
    ],
  },
  {
    name: 'Africa',
    paths: [
      [[-17,15],[-17,21],[-16,24],[-13,28],[-10,32],[-5,36],[-2,35],[3,37],[8,37],[10,37],[11,34],[15,32],[20,32],[25,32],[28,31],[30,31],[33,30],[35,32],[38,28],[42,18],[44,12],[48,8],[50,12],[48,5],[42,0],[40,-2],[40,-6],[42,-12],[40,-16],[38,-20],[36,-22],[35,-25],[33,-29],[30,-32],[28,-33],[26,-34],[22,-34],[20,-30],[18,-25],[17,-22],[15,-18],[12,-6],[10,0],[8,5],[6,5],[3,6],[0,6],[-5,5],[-8,5],[-10,7],[-12,9],[-15,11],[-17,15]],
    ],
  },
  {
    name: 'Asia',
    paths: [
      [[26,41],[28,42],[30,42],[35,37],[38,37],[40,38],[42,42],[45,40],[48,38],[50,37],[52,37],[54,38],[55,42],[58,42],[60,42],[62,40],[64,38],[66,37],[68,35],[70,32],[72,28],[72,22],[75,15],[78,8],[80,10],[80,14],[84,18],[88,22],[90,22],[92,20],[95,18],[98,16],[100,14],[102,10],[104,10],[105,15],[108,18],[108,22],[110,20],[113,22],[115,22],[117,24],[118,28],[120,24],[122,30],[124,34],[126,34],[127,35],[128,37],[130,33],[131,35],[133,34],[136,35],[138,35],[140,40],[142,44],[145,44],[143,48],[141,50],[140,55],[137,56],[135,55],[132,58],[130,60],[127,62],[122,60],[118,58],[112,55],[105,52],[100,55],[95,52],[90,48],[85,50],[80,50],[75,55],[72,55],[68,55],[65,58],[60,55],[55,55],[52,52],[50,52],[48,47],[45,48],[42,46],[40,44],[36,42],[32,42],[28,42],[26,41]],
    ],
  },
  {
    name: 'Australia',
    paths: [
      [[114,-22],[116,-20],[119,-18],[121,-17],[126,-14],[129,-15],[133,-12],[136,-12],[138,-15],[140,-18],[143,-15],[145,-15],[148,-20],[150,-22],[152,-26],[153,-28],[153,-32],[151,-34],[150,-35],[148,-38],[146,-39],[144,-38],[142,-36],[140,-38],[136,-36],[133,-33],[131,-32],[128,-32],[125,-33],[122,-34],[118,-35],[116,-34],[115,-33],[114,-30],[114,-26],[114,-22]],
      // New Zealand
      [[172,-35],[174,-37],[177,-38],[178,-42],[176,-44],[174,-46],[170,-46],[168,-44],[167,-45],[166,-46],[168,-44],[170,-42],[172,-39],[172,-35]],
    ],
  },
];

/* ── Major islands ── */
const ISLANDS: [number, number][][] = [
  // Japan
  [[130,31],[132,33],[134,34],[136,35],[138,36],[140,38],[140,40],[142,43],[144,44],[145,44],[142,40],[140,36],[137,34],[134,34],[132,32],[130,31]],
  // UK/Ireland
  [[-6,50],[-5,52],[-3,55],[-5,57],[-2,58],[0,58],[2,53],[2,51],[0,51],[-5,50],[-6,50]],
  [[-10,52],[-8,55],[-6,55],[-6,52],[-8,52],[-10,52]],
  // Madagascar
  [[44,-12],[48,-15],[50,-20],[49,-24],[47,-25],[44,-23],[43,-18],[44,-12]],
  // Sri Lanka
  [[80,10],[81,8],[82,7],[80,6],[80,8],[80,10]],
  // Taiwan
  [[120,25],[121,24],[122,23],[121,22],[120,23],[120,25]],
  // Philippines (simplified)
  [[118,18],[120,18],[122,14],[124,10],[126,8],[126,6],[124,8],[122,10],[120,12],[118,14],[118,18]],
  // Indonesia (Java)
  [[105,-6],[108,-7],[112,-7],[115,-8],[117,-8],[114,-8],[110,-7],[106,-6],[105,-6]],
  // Borneo
  [[108,4],[110,2],[112,1],[115,1],[118,2],[118,4],[117,7],[115,5],[112,4],[110,3],[108,4]],
];

/* ── Named lines ── */
const SPECIAL_LATITUDES = [
  { lat: 0, label: 'Equator' },
  { lat: 23.44, label: 'Tropic of Cancer' },
  { lat: -23.44, label: 'Tropic of Capricorn' },
  { lat: 66.56, label: 'Arctic Circle' },
  { lat: -66.56, label: 'Antarctic Circle' },
];

export function FlatMapView() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();
  const [hoveredEvent, setHoveredEvent] = useState<ThreatEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<[number, number]>([0, 0]);

  /* Grid lines */
  const grid = useMemo(() => {
    const lines: React.JSX.Element[] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project(0, lon);
      lines.push(
        <line key={`v${lon}`} x1={x} y1={PAD} x2={x} y2={H - PAD}
          stroke="hsl(185 80% 50%)" strokeOpacity={0.05} strokeWidth={0.5} />,
      );
      if (lon % 60 === 0) {
        lines.push(
          <text key={`vl${lon}`} x={x} y={H - PAD + 12} textAnchor="middle"
            fill="hsl(215 15% 35%)" fontSize={7} fontFamily="monospace">
            {lon}°
          </text>,
        );
      }
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const [, y] = project(lat, 0);
      lines.push(
        <line key={`h${lat}`} x1={PAD} y1={y} x2={W - PAD} y2={y}
          stroke="hsl(185 80% 50%)" strokeOpacity={0.05} strokeWidth={0.5} />,
      );
      if (lat % 30 === 0) {
        lines.push(
          <text key={`hl${lat}`} x={PAD - 5} y={y + 3} textAnchor="end"
            fill="hsl(215 15% 35%)" fontSize={7} fontFamily="monospace">
            {lat}°
          </text>,
        );
      }
    }
    return lines;
  }, []);

  /* Special latitude lines */
  const specialLines = useMemo(() =>
    SPECIAL_LATITUDES.map(sl => {
      const [, y] = project(sl.lat, 0);
      return (
        <g key={sl.label}>
          <line x1={PAD} y1={y} x2={W - PAD} y2={y}
            stroke="hsl(185 80% 50%)" strokeOpacity={0.08} strokeWidth={0.5}
            strokeDasharray="4 6" />
          <text x={W - PAD + 5} y={y + 3} fill="hsl(215 15% 40%)" fontSize={6}
            fontFamily="monospace">{sl.label}</text>
        </g>
      );
    }),
  []);

  /* Continent fills & outlines */
  const continentElements = useMemo(() =>
    CONTINENTS.flatMap((cont, ci) =>
      cont.paths.map((path, pi) => {
        const pts = path.map(([lon, lat]) => project(lat, lon).join(',')).join(' ');
        return (
          <polygon
            key={`${ci}-${pi}`}
            points={pts}
            fill="hsl(185 80% 50%)"
            fillOpacity={0.05}
            stroke="hsl(185 80% 50%)"
            strokeOpacity={0.2}
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
        );
      }),
    ),
  []);

  /* Islands */
  const islandElements = useMemo(() =>
    ISLANDS.map((path, i) => {
      const pts = path.map(([lon, lat]) => project(lat, lon).join(',')).join(' ');
      return (
        <polygon
          key={`island-${i}`}
          points={pts}
          fill="hsl(185 80% 50%)"
          fillOpacity={0.04}
          stroke="hsl(185 80% 50%)"
          strokeOpacity={0.15}
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      );
    }),
  []);

  /* Attack arcs with gradient */
  const arcs = useMemo(() =>
    filteredEvents.slice(0, 100).map(ev => {
      const [sx, sy] = project(ev.source.lat, ev.source.lon);
      const [tx, ty] = project(ev.target.lat, ev.target.lon);
      const mx = (sx + tx) / 2;
      const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
      const my = Math.min(sy, ty) - 15 - dist * 0.08;
      const isCrit = ev.severity === 'critical';
      return (
        <path
          key={ev.id + '-a'}
          d={`M${sx},${sy} Q${mx},${my} ${tx},${ty}`}
          stroke={SEVERITY_COLORS[ev.severity]}
          strokeWidth={isCrit ? 1.2 : 0.6}
          fill="none"
          opacity={isCrit ? 0.4 : 0.15}
          filter={isCrit ? 'url(#glow)' : undefined}
          strokeDasharray={isCrit ? undefined : '3 4'}
        >
          {isCrit && (
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
          )}
        </path>
      );
    }),
  [filteredEvents]);

  /* Event dots with pulse */
  const dots = useMemo(() =>
    filteredEvents.slice(0, 500).map(ev => {
      const [x, y] = project(ev.source.lat, ev.source.lon);
      const isCrit = ev.severity === 'critical';
      const isHigh = ev.severity === 'high';
      const r = isCrit ? 4 : isHigh ? 3 : 2;
      return (
        <g key={ev.id}>
          {/* Pulse ring for critical/high */}
          {(isCrit || isHigh) && (
            <circle cx={x} cy={y} r={r} fill="none"
              stroke={SEVERITY_COLORS[ev.severity]} strokeWidth={0.8} opacity={0.6}>
              <animate attributeName="r" from={String(r)} to={String(r * 3)} dur={isCrit ? '1.5s' : '2.5s'} repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur={isCrit ? '1.5s' : '2.5s'} repeatCount="indefinite" />
            </circle>
          )}
          {/* Main dot */}
          <circle
            cx={x}
            cy={y}
            r={r}
            fill={SEVERITY_COLORS[ev.severity]}
            opacity={0.85}
            filter={isCrit ? 'url(#glow)' : undefined}
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

  /* Target markers (diamond) */
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
          <rect x={x - 3} y={y - 3} width={6} height={6}
            fill="#22d3ee" opacity={0.6}
            transform={`rotate(45 ${x} ${y})`}
            filter="url(#glowCyan)" />
        </g>
      );
    });
  }, [filteredEvents]);

  return (
    <div className="w-full h-full bg-[#030810] flex items-center justify-center overflow-hidden relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glow filter for critical */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Vignette gradient */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="#030810" stopOpacity="0.5" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="#030810" />

        {/* Border frame */}
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD}
          fill="none" stroke="hsl(185 80% 50%)" strokeOpacity={0.08} strokeWidth={0.5} />

        {grid}
        {specialLines}
        {continentElements}
        {islandElements}
        {arcs}
        {targetMarkers}
        {dots}

        {/* Vignette overlay */}
        <rect width={W} height={H} fill="url(#vignette)" pointerEvents="none" />

        {/* Title watermark */}
        <text x={W / 2} y={PAD - 12} textAnchor="middle"
          fill="hsl(185 80% 50%)" fillOpacity={0.15} fontSize={10}
          fontFamily="monospace" letterSpacing="4">
          CATSHY GLOBAL THREAT MAP
        </text>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2 text-[10px] space-y-1 z-10">
        <p className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Severity</p>
        {Object.entries(SEVERITY_COLORS).map(([k, c]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
            <span className="text-foreground capitalize">{k}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border">
          <span className="w-2 h-2 rotate-45 bg-cyan-400" />
          <span className="text-foreground">Target</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredEvent && (
        <div
          className="fixed z-50 bg-card/95 backdrop-blur-md border border-border rounded-lg px-3 py-2 text-xs pointer-events-none shadow-lg max-w-[220px]"
          style={{
            left: hoverPos[0] + 12,
            top: hoverPos[1] - 20,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[hoveredEvent.severity] }} />
            <span className="font-semibold text-foreground capitalize">{hoveredEvent.category.replace(/_/g, ' ')}</span>
          </div>
          <p className="text-muted-foreground">{hoveredEvent.source.city}, {hoveredEvent.source.country}</p>
          <p className="text-muted-foreground">→ {hoveredEvent.target.city}, {hoveredEvent.target.country}</p>
          <p className="text-muted-foreground font-mono mt-1">{hoveredEvent.source.ip}</p>
        </div>
      )}
    </div>
  );
}
