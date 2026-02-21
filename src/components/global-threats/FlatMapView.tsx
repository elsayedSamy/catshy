/**
 * FlatMapView — SVG-based 2D equirectangular projection threat map.
 *
 * Features:
 *  • Simplified continent outlines (styled polygons)
 *  • Lat/Lon grid with cyber aesthetic
 *  • Event dots colored by severity
 *  • Attack arc curves (source → target)
 *  • Click on dot → select event
 */
import { useMemo } from 'react';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS } from './types';

const W = 1200;
const H = 600;
const PAD = 20;

function project(lat: number, lon: number): [number, number] {
  const x = ((lon + 180) / 360) * (W - 2 * PAD) + PAD;
  const y = ((90 - lat) / 180) * (H - 2 * PAD) + PAD;
  return [x, y];
}

/* Simplified continent outlines — [lon, lat] pairs */
const CONTINENTS: [number, number][][] = [
  // North America
  [[-130,55],[-125,50],[-123,46],[-120,35],[-117,33],[-105,30],[-97,26],[-90,30],[-82,25],[-80,32],[-75,35],[-68,44],[-67,47],[-60,46],[-55,52],[-65,60],[-72,58],[-80,63],[-95,68],[-108,70],[-125,70],[-140,62],[-130,55]],
  // South America
  [[-80,10],[-77,7],[-73,4],[-70,-4],[-75,-15],[-70,-23],[-65,-28],[-65,-35],[-68,-47],[-70,-52],[-69,-55],[-64,-50],[-58,-38],[-48,-28],[-42,-23],[-38,-13],[-35,-6],[-50,0],[-57,6],[-63,10],[-73,11],[-80,10]],
  // Europe
  [[-10,36],[-9,39],[0,38],[3,43],[0,46],[-4,48],[2,51],[5,54],[8,54],[12,55],[15,56],[20,55],[22,60],[28,60],[30,70],[22,70],[18,66],[12,58],[8,58],[5,49],[-2,48],[-5,44],[-10,36]],
  // Africa
  [[-17,15],[-15,11],[-8,5],[5,5],[10,2],[25,0],[30,-3],[35,-10],[40,-15],[38,-25],[35,-34],[28,-33],[20,-30],[18,-23],[12,-17],[12,-6],[10,0],[5,5],[0,6],[-10,6],[-17,15]],
  // Asia
  [[26,41],[35,42],[40,40],[50,38],[55,44],[62,40],[68,35],[72,22],[78,8],[80,14],[88,22],[98,16],[105,10],[110,20],[120,24],[127,35],[132,34],[140,40],[145,44],[143,48],[135,55],[125,60],[110,55],[90,50],[75,55],[60,55],[45,48],[38,42],[26,41]],
  // Australia
  [[114,-22],[121,-17],[133,-12],[140,-18],[150,-22],[153,-30],[148,-38],[140,-38],[130,-32],[118,-35],[114,-30],[114,-22]],
];

export function FlatMapView() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();

  /* Grid */
  const grid = useMemo(() => {
    const lines: React.JSX.Element[] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project(0, lon);
      lines.push(
        <line key={`v${lon}`} x1={x} y1={PAD} x2={x} y2={H - PAD}
          stroke="hsl(var(--primary))" strokeOpacity={0.06} strokeWidth={0.5} />,
      );
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      const [, y] = project(lat, 0);
      lines.push(
        <line key={`h${lat}`} x1={PAD} y1={y} x2={W - PAD} y2={y}
          stroke="hsl(var(--primary))" strokeOpacity={0.06} strokeWidth={0.5} />,
      );
    }
    return lines;
  }, []);

  /* Continent outlines */
  const continents = useMemo(() =>
    CONTINENTS.map((path, ci) => {
      const pts = path.map(([lon, lat]) => project(lat, lon).join(',')).join(' ');
      return (
        <polygon
          key={ci}
          points={pts}
          fill="hsl(var(--primary))"
          fillOpacity={0.06}
          stroke="hsl(var(--primary))"
          strokeOpacity={0.18}
          strokeWidth={0.6}
        />
      );
    }),
  []);

  /* Attack arcs */
  const arcs = useMemo(() =>
    filteredEvents.slice(0, 80).map(ev => {
      const [sx, sy] = project(ev.source.lat, ev.source.lon);
      const [tx, ty] = project(ev.target.lat, ev.target.lon);
      const mx = (sx + tx) / 2;
      const my = Math.min(sy, ty) - 20 - Math.abs(sx - tx) * 0.08;
      return (
        <path
          key={ev.id + '-a'}
          d={`M${sx},${sy} Q${mx},${my} ${tx},${ty}`}
          stroke={SEVERITY_COLORS[ev.severity]}
          strokeWidth={0.7}
          fill="none"
          opacity={0.2}
        />
      );
    }),
  [filteredEvents]);

  /* Event dots */
  const dots = useMemo(() =>
    filteredEvents.slice(0, 500).map(ev => {
      const [x, y] = project(ev.source.lat, ev.source.lon);
      const r = ev.severity === 'critical' ? 3.5 : 2.5;
      return (
        <circle
          key={ev.id}
          cx={x}
          cy={y}
          r={r}
          fill={SEVERITY_COLORS[ev.severity]}
          opacity={0.8}
          className="cursor-pointer transition-opacity hover:opacity-100"
          onClick={() => setSelectedEvent(ev)}
        />
      );
    }),
  [filteredEvents, setSelectedEvent]);

  return (
    <div className="w-full h-full bg-[#050a12] flex items-center justify-center overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect width={W} height={H} fill="#050a12" />
        {grid}
        {continents}
        {arcs}
        {dots}
      </svg>
    </div>
  );
}
