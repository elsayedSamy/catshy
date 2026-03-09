/**
 * GlobeView v3 — Clean, clear cyber globe. No traveling particles.
 * Better zoom, brighter earth, smooth interactions.
 */
import { useRef, useMemo, useEffect, useCallback, useState, Suspense } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { useThreatContext } from './ThreatContext';
import { ThreatEvent, SEVERITY_COLORS, CATEGORY_LABELS } from './types';
import { format } from 'date-fns';

const R = 2;
const MAX_POINTS = 600;
const MAX_ARCS = 120;

function latLonTo3(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ── Country labels ── */
const COUNTRY_LABELS: { name: string; lat: number; lon: number; size?: 'lg' | 'md' | 'sm' }[] = [
  { name: 'United States', lat: 39, lon: -98, size: 'lg' },
  { name: 'Canada', lat: 56, lon: -106, size: 'md' },
  { name: 'Mexico', lat: 23, lon: -102, size: 'md' },
  { name: 'Brazil', lat: -14, lon: -51, size: 'lg' },
  { name: 'Argentina', lat: -38, lon: -63, size: 'md' },
  { name: 'Colombia', lat: 4, lon: -72, size: 'sm' },
  { name: 'Peru', lat: -10, lon: -76, size: 'sm' },
  { name: 'Chile', lat: -33, lon: -71, size: 'sm' },
  { name: 'United Kingdom', lat: 54, lon: -2, size: 'md' },
  { name: 'France', lat: 46, lon: 2, size: 'md' },
  { name: 'Germany', lat: 51, lon: 10, size: 'md' },
  { name: 'Italy', lat: 42, lon: 12, size: 'sm' },
  { name: 'Spain', lat: 40, lon: -4, size: 'sm' },
  { name: 'Poland', lat: 52, lon: 20, size: 'sm' },
  { name: 'Ukraine', lat: 49, lon: 32, size: 'sm' },
  { name: 'Sweden', lat: 62, lon: 15, size: 'sm' },
  { name: 'Norway', lat: 65, lon: 13, size: 'sm' },
  { name: 'Russia', lat: 61, lon: 105, size: 'lg' },
  { name: 'China', lat: 35, lon: 105, size: 'lg' },
  { name: 'India', lat: 21, lon: 78, size: 'lg' },
  { name: 'Japan', lat: 36, lon: 138, size: 'md' },
  { name: 'South Korea', lat: 36, lon: 128, size: 'sm' },
  { name: 'Indonesia', lat: -5, lon: 120, size: 'md' },
  { name: 'Turkey', lat: 39, lon: 35, size: 'md' },
  { name: 'Saudi Arabia', lat: 24, lon: 45, size: 'md' },
  { name: 'Iran', lat: 33, lon: 53, size: 'md' },
  { name: 'Egypt', lat: 27, lon: 30, size: 'md' },
  { name: 'Nigeria', lat: 10, lon: 8, size: 'md' },
  { name: 'South Africa', lat: -30, lon: 25, size: 'md' },
  { name: 'Australia', lat: -25, lon: 133, size: 'lg' },
  { name: 'Palestine', lat: 31, lon: 35, size: 'sm' },
  { name: 'N. Korea', lat: 40, lon: 127, size: 'sm' },
  { name: 'Singapore', lat: 1, lon: 104, size: 'sm' },
  { name: 'Taiwan', lat: 24, lon: 121, size: 'sm' },
];

/* ── Realistic Earth ── */
function RealisticEarth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [colorMap, bumpMap] = useLoader(TextureLoader, [
    '/textures/earth-blue-marble.jpg',
    '/textures/earth-topology.png',
  ]);

  useEffect(() => {
    if (colorMap) {
      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.anisotropy = 16;
    }
  }, [colorMap]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[R, 164, 164]} />
        <meshStandardMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.04}
          roughness={0.65}
          metalness={0.1}
          emissive="#0a1628"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Atmosphere layers */}
      <mesh>
        <sphereGeometry args={[R * 1.012, 64, 64]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.035, 64, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.07, 48, 48]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.025} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ── Country Labels ── */
function CountryLabels() {
  const labels = useMemo(() =>
    COUNTRY_LABELS.map(c => ({
      pos: latLonTo3(c.lat, c.lon, R * 1.025),
      name: c.name,
      size: c.size || 'sm',
    })),
  []);

  return (
    <group>
      {labels.map((label) => (
        <Html
          key={label.name}
          position={[label.pos.x, label.pos.y, label.pos.z]}
          center
          distanceFactor={6}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`
              whitespace-nowrap select-none font-mono uppercase tracking-[0.15em]
              ${label.size === 'lg' ? 'text-[9px] font-bold' : ''}
              ${label.size === 'md' ? 'text-[7px] font-semibold' : ''}
              ${label.size === 'sm' ? 'text-[5.5px] font-medium' : ''}
            `}
            style={{
              color: label.size === 'lg'
                ? 'rgba(255,255,255,0.85)'
                : label.size === 'md'
                ? 'rgba(220,235,255,0.65)'
                : 'rgba(200,220,255,0.4)',
              textShadow: '0 0 6px rgba(30,91,184,0.6), 0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {label.name}
          </div>
        </Html>
      ))}
    </group>
  );
}

/* ── Event points with hover detection ── */
function EventPoints({
  events,
  onSelect,
  onHover,
}: {
  events: ThreatEvent[];
  onSelect: (e: ThreatEvent) => void;
  onHover: (e: ThreatEvent | null, pos?: { x: number; y: number }) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visible = useMemo(() => events.slice(0, MAX_POINTS), [events]);

  useEffect(() => {
    const mesh = meshRef.current;
    const hit = hitRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    const colors = new Float32Array(MAX_POINTS * 3);

    visible.forEach((ev, i) => {
      const pos = latLonTo3(ev.source.lat, ev.source.lon, R * 1.015);
      dummy.position.copy(pos);
      const scale = ev.severity === 'critical' ? 4.5 : ev.severity === 'high' ? 3.5 : ev.severity === 'medium' ? 2.5 : 1.5;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (hit) {
        dummy.scale.setScalar(scale * 5);
        dummy.updateMatrix();
        hit.setMatrixAt(i, dummy.matrix);
      }

      c.set(SEVERITY_COLORS[ev.severity]);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });

    for (let i = visible.length; i < MAX_POINTS; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (hit) hit.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    if (hit) hit.instanceMatrix.needsUpdate = true;
  }, [visible, dummy]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && visible[e.instanceId]) {
      onSelect(visible[e.instanceId]);
    }
  }, [visible, onSelect]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && visible[e.instanceId]) {
      const { clientX, clientY } = e.nativeEvent;
      onHover(visible[e.instanceId], { x: clientX, y: clientY });
    }
  }, [visible, onHover]);

  const handlePointerOut = useCallback(() => {
    onHover(null);
  }, [onHover]);

  return (
    <group>
      {/* Visible dots */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_POINTS]}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Hit detection mesh */}
      <instancedMesh
        ref={hitRef}
        args={[undefined, undefined, MAX_POINTS]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

/* ── Static Attack Arcs (no particles) ── */
function AttackArcs({ events }: { events: ThreatEvent[] }) {
  const arcsData = useMemo(() =>
    events.slice(0, MAX_ARCS).map(ev => {
      const s = latLonTo3(ev.source.lat, ev.source.lon, R * 1.015);
      const e = latLonTo3(ev.target.lat, ev.target.lon, R * 1.015);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      const dist = s.distanceTo(e);
      mid.normalize().multiplyScalar(R + dist * 0.35);
      const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
      const pts = curve.getPoints(40);
      return { pts, color: SEVERITY_COLORS[ev.severity], id: ev.id, severity: ev.severity };
    }),
  [events]);

  return (
    <group>
      {arcsData.map(a => {
        const positions = new Float32Array(a.pts.flatMap(p => [p.x, p.y, p.z]));
        const opacity = a.severity === 'critical' ? 0.6 : a.severity === 'high' ? 0.25 : 0.1;
        return (
          <line key={a.id}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={a.pts.length}
                array={positions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={a.color} transparent opacity={opacity} linewidth={1} />
          </line>
        );
      })}
    </group>
  );
}

/* ── Heatmap Glow ── */
function HeatmapGlow({ events }: { events: ThreatEvent[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const MAX_HOTSPOTS = 80;

  const hotspots = useMemo(() => {
    const grid = new Map<string, { lat: number; lon: number; count: number; maxSev: number }>();
    events.forEach(ev => {
      const gLat = Math.round(ev.source.lat / 5) * 5;
      const gLon = Math.round(ev.source.lon / 5) * 5;
      const key = `${gLat}_${gLon}`;
      const existing = grid.get(key);
      const sevScore = ev.severity === 'critical' ? 4 : ev.severity === 'high' ? 3 : ev.severity === 'medium' ? 2 : 1;
      if (existing) {
        existing.count++;
        existing.maxSev = Math.max(existing.maxSev, sevScore);
      } else {
        grid.set(key, { lat: gLat, lon: gLon, count: 1, maxSev: sevScore });
      }
    });
    return Array.from(grid.values()).sort((a, b) => b.count - a.count).slice(0, MAX_HOTSPOTS);
  }, [events]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const c = new THREE.Color();
    const colors = new Float32Array(MAX_HOTSPOTS * 3);
    const maxCount = Math.max(...hotspots.map(h => h.count), 1);

    hotspots.forEach((spot, i) => {
      const pos = latLonTo3(spot.lat, spot.lon, R * 1.005);
      dummy.position.copy(pos);
      dummy.lookAt(0, 0, 0);
      const intensity = spot.count / maxCount;
      const scale = 0.08 + intensity * 0.25;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (spot.maxSev >= 4) c.set('#ff2d55');
      else if (spot.maxSev >= 3) c.set('#ff9500');
      else if (spot.maxSev >= 2) c.set('#ffcc00');
      else c.set('#30d158');
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });

    for (let i = hotspots.length; i < MAX_HOTSPOTS; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [hotspots, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_HOTSPOTS]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial transparent opacity={0.18} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}

function SceneSetup() {
  const { gl } = useThree();
  useEffect(() => { gl.setClearColor('#0a1220'); }, [gl]);
  return null;
}

/* ── Hover Tooltip ── */
function HoverTooltip({ event, position }: { event: ThreatEvent | null; position: { x: number; y: number } | null }) {
  if (!event || !position) return null;

  const sevColor = SEVERITY_COLORS[event.severity];

  return (
    <div
      className="fixed z-50 pointer-events-none animate-fade-in"
      style={{
        left: position.x + 16,
        top: position.y - 8,
        maxWidth: '280px',
      }}
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-lg px-3 py-2.5 shadow-2xl">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: sevColor, boxShadow: `0 0 8px ${sevColor}` }}
          />
          <span className="text-[10px] font-mono uppercase font-bold text-foreground tracking-wide">
            {event.severity} — {(CATEGORY_LABELS as any)[event.category] || event.category}
          </span>
        </div>

        <div className="space-y-1 text-[9px] font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source</span>
            <span className="text-foreground">{event.source.city}, {event.source.country}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target</span>
            <span className="text-foreground">{event.target.city}, {event.target.country}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IP</span>
            <span className="text-foreground">{event.source.ip} → {event.target.ip}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Confidence</span>
            <span className="text-foreground">{event.confidence}%</span>
          </div>
          {event.indicators.cve && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">CVE</span>
              <span className="text-destructive font-bold">{event.indicators.cve}</span>
            </div>
          )}
          <div className="text-[8px] text-muted-foreground/60 pt-1 border-t border-border/30">
            {format(new Date(event.timestamp), 'HH:mm:ss')} · Click to inspect
          </div>
        </div>
      </div>
    </div>
  );
}

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

export function GlobeView() {
  const { filteredEvents, setSelectedEvent, zoomToEvent, setZoomToEvent } = useThreatContext();
  const [hoveredEvent, setHoveredEvent] = useState<ThreatEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const controlsRef = useRef<any>(null);

  const handleSelect = useCallback((ev: ThreatEvent) => {
    setSelectedEvent(ev);
    setZoomToEvent(ev);
    setHoveredEvent(null);
  }, [setSelectedEvent, setZoomToEvent]);

  const handleHover = useCallback((ev: ThreatEvent | null, pos?: { x: number; y: number }) => {
    setHoveredEvent(ev);
    setHoverPos(pos || null);
  }, []);

  // Zoom to event via OrbitControls target
  useEffect(() => {
    if (!zoomToEvent || !controlsRef.current) return;
    const pos = latLonTo3(zoomToEvent.source.lat, zoomToEvent.source.lon, R * 1.015);
    const dir = pos.clone().normalize();
    // Move camera to look at the point from outside
    const camTarget = dir.clone().multiplyScalar(3.2);
    const controls = controlsRef.current;

    // Animate smoothly
    const startPos = controls.object.position.clone();
    const startTarget = controls.target.clone();
    const endTarget = pos.clone().multiplyScalar(0.3); // slightly toward center
    let t = 0;

    const animate = () => {
      t += 0.03;
      if (t > 1) t = 1;
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      controls.object.position.lerpVectors(startPos, camTarget, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      controls.update();
      if (t < 1) requestAnimationFrame(animate);
      else setZoomToEvent(null);
    };
    requestAnimationFrame(animate);
  }, [zoomToEvent, setZoomToEvent]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 1.2, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <SceneSetup />
        <ambientLight intensity={0.25} color="#e0f0ff" />
        <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-4, 1, -3]} intensity={0.4} color="#93c5fd" />
        <pointLight position={[0, 5, 0]} intensity={0.15} color="#60a5fa" />
        <Suspense fallback={null}>
          {/* No stars - clean calm background */}
          <RealisticEarth />
          <CountryLabels />
          <EventPoints events={filteredEvents} onSelect={handleSelect} onHover={handleHover} />
          <AttackArcs events={filteredEvents} />
          <HeatmapGlow events={filteredEvents} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={2.8}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.06}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.8}
          zoomSpeed={0.8}
          mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
        />
      </Canvas>

      {/* Title badge */}
      <div className="absolute top-3 left-3 z-10">
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl px-3 py-2 shadow-lg">
          <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-primary font-semibold">
            CATSHY THREAT GLOBE
          </div>
          <div className="text-[9px] font-mono text-muted-foreground mt-0.5">
            {filteredEvents.length} ACTIVE THREATS · REAL-TIME
          </div>
        </div>
      </div>

      <Legend />
      <HoverTooltip event={hoveredEvent} position={hoverPos} />
    </div>
  );
}
