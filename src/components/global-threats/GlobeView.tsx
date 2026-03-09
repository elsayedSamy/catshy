/**
 * GlobeView — Dark cyber-aesthetic 3D threat globe with grid wireframe Earth.
 */
import { useRef, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { useThreatContext } from './ThreatContext';
import { ThreatEvent, SEVERITY_COLORS } from './types';

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
  // Americas
  { name: 'United States', lat: 39, lon: -98, size: 'lg' },
  { name: 'Canada', lat: 56, lon: -106, size: 'md' },
  { name: 'Mexico', lat: 23, lon: -102, size: 'md' },
  { name: 'Brazil', lat: -14, lon: -51, size: 'lg' },
  { name: 'Argentina', lat: -38, lon: -63, size: 'md' },
  { name: 'Colombia', lat: 4, lon: -72, size: 'sm' },
  { name: 'Peru', lat: -10, lon: -76, size: 'sm' },
  { name: 'Chile', lat: -33, lon: -71, size: 'sm' },
  { name: 'Venezuela', lat: 8, lon: -66, size: 'sm' },
  // Europe
  { name: 'United Kingdom', lat: 54, lon: -2, size: 'md' },
  { name: 'France', lat: 46, lon: 2, size: 'md' },
  { name: 'Germany', lat: 51, lon: 10, size: 'md' },
  { name: 'Italy', lat: 42, lon: 12, size: 'sm' },
  { name: 'Spain', lat: 40, lon: -4, size: 'sm' },
  { name: 'Poland', lat: 52, lon: 20, size: 'sm' },
  { name: 'Ukraine', lat: 49, lon: 32, size: 'sm' },
  { name: 'Romania', lat: 46, lon: 25, size: 'sm' },
  { name: 'Netherlands', lat: 52, lon: 5, size: 'sm' },
  { name: 'Sweden', lat: 62, lon: 15, size: 'sm' },
  { name: 'Norway', lat: 65, lon: 13, size: 'sm' },
  { name: 'Finland', lat: 64, lon: 26, size: 'sm' },
  { name: 'Switzerland', lat: 47, lon: 8, size: 'sm' },
  { name: 'Greece', lat: 39, lon: 22, size: 'sm' },
  { name: 'Belarus', lat: 54, lon: 28, size: 'sm' },
  // Asia
  { name: 'Russia', lat: 61, lon: 105, size: 'lg' },
  { name: 'China', lat: 35, lon: 105, size: 'lg' },
  { name: 'India', lat: 21, lon: 78, size: 'lg' },
  { name: 'Japan', lat: 36, lon: 138, size: 'md' },
  { name: 'South Korea', lat: 36, lon: 128, size: 'sm' },
  { name: 'Indonesia', lat: -5, lon: 120, size: 'md' },
  { name: 'Philippines', lat: 13, lon: 122, size: 'sm' },
  { name: 'Vietnam', lat: 16, lon: 108, size: 'sm' },
  { name: 'Thailand', lat: 15, lon: 101, size: 'sm' },
  { name: 'Pakistan', lat: 30, lon: 69, size: 'md' },
  { name: 'Kazakhstan', lat: 48, lon: 68, size: 'md' },
  // Middle East
  { name: 'Turkey', lat: 39, lon: 35, size: 'md' },
  { name: 'Saudi Arabia', lat: 24, lon: 45, size: 'md' },
  { name: 'Iran', lat: 33, lon: 53, size: 'md' },
  { name: 'Iraq', lat: 33, lon: 44, size: 'sm' },
  { name: 'UAE', lat: 24, lon: 54, size: 'sm' },
  { name: 'Israel', lat: 31, lon: 35, size: 'sm' },
  // Africa
  { name: 'Egypt', lat: 27, lon: 30, size: 'md' },
  { name: 'Nigeria', lat: 10, lon: 8, size: 'md' },
  { name: 'South Africa', lat: -30, lon: 25, size: 'md' },
  { name: 'Kenya', lat: -1, lon: 38, size: 'sm' },
  { name: 'Ethiopia', lat: 9, lon: 40, size: 'sm' },
  { name: 'Morocco', lat: 32, lon: -5, size: 'sm' },
  { name: 'Algeria', lat: 28, lon: 2, size: 'sm' },
  { name: 'Libya', lat: 27, lon: 17, size: 'sm' },
  { name: 'Tanzania', lat: -6, lon: 35, size: 'sm' },
  { name: 'Angola', lat: -12, lon: 18, size: 'sm' },
  // Oceania
  { name: 'Australia', lat: -25, lon: 133, size: 'lg' },
  { name: 'New Zealand', lat: -41, lon: 174, size: 'sm' },
  // Central Asia
  { name: 'Afghanistan', lat: 33, lon: 65, size: 'sm' },
  { name: 'Uzbekistan', lat: 41, lon: 65, size: 'sm' },
  // Singapore
  { name: 'Singapore', lat: 1, lon: 104, size: 'sm' },
  { name: 'Taiwan', lat: 24, lon: 121, size: 'sm' },
  { name: 'N. Korea', lat: 40, lon: 127, size: 'sm' },
];

/* ── Realistic Earth with blue marble texture ── */
function RealisticEarth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const [colorMap, bumpMap] = useLoader(TextureLoader, [
    '/textures/earth-blue-marble.jpg',
    '/textures/earth-topology.png',
  ]);

  useEffect(() => {
    if (colorMap) {
      colorMap.colorSpace = THREE.SRGBColorSpace;
      colorMap.anisotropy = 8;
    }
  }, [colorMap]);

  // Subtle slow self-rotation
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.015;
    }
  });

  return (
    <group>
      {/* Main Earth sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[R, 128, 128]} />
        <meshPhongMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.04}
          shininess={15}
          specular={new THREE.Color('#1a3a5c')}
          emissive="#050d18"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Thin cloud/haze layer */}
      <mesh>
        <sphereGeometry args={[R * 1.003, 96, 96]} />
        <meshPhongMaterial
          color="#ffffff"
          transparent
          opacity={0.03}
          depthWrite={false}
        />
      </mesh>

      {/* Inner atmosphere — blue rim */}
      <mesh>
        <sphereGeometry args={[R * 1.02, 64, 64]} />
        <meshBasicMaterial
          color="#4d9eff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Mid atmosphere — softer blue */}
      <mesh>
        <sphereGeometry args={[R * 1.06, 64, 64]} />
        <meshBasicMaterial
          color="#3a7bd5"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outer atmosphere glow */}
      <mesh>
        <sphereGeometry args={[R * 1.12, 48, 48]} />
        <meshBasicMaterial
          color="#1e5bb8"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outermost subtle glow */}
      <mesh>
        <sphereGeometry args={[R * 1.2, 32, 32]} />
        <meshBasicMaterial
          color="#1048a0"
          transparent
          opacity={0.015}
          side={THREE.BackSide}
        />
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
                ? 'rgba(0,229,255,0.7)'
                : label.size === 'md'
                ? 'rgba(0,229,255,0.5)'
                : 'rgba(0,229,255,0.3)',
              textShadow: '0 0 10px rgba(0,229,255,0.4), 0 0 20px rgba(0,229,255,0.15)',
            }}
          >
            {label.name}
          </div>
        </Html>
      ))}
    </group>
  );
}

/* ── Event points with LARGER hit area for reliable clicking ── */
function EventPoints({ events, onSelect }: { events: ThreatEvent[]; onSelect: (e: ThreatEvent) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const hitRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visible = useMemo(() => events.slice(0, MAX_POINTS), [events]);
  const timeRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    const pulse = pulseRef.current;
    const hit = hitRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    const colors = new Float32Array(MAX_POINTS * 3);
    const pulseColors = new Float32Array(MAX_POINTS * 3);

    visible.forEach((ev, i) => {
      const pos = latLonTo3(ev.source.lat, ev.source.lon, R * 1.015);
      dummy.position.copy(pos);
      const scale = ev.severity === 'critical' ? 3.5 : ev.severity === 'high' ? 2.5 : 1.5;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (pulse) pulse.setMatrixAt(i, dummy.matrix);

      // Hit detection sphere — 4x larger
      if (hit) {
        dummy.scale.setScalar(scale * 4);
        dummy.updateMatrix();
        hit.setMatrixAt(i, dummy.matrix);
      }

      c.set(SEVERITY_COLORS[ev.severity]);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      pulseColors[i * 3] = c.r; pulseColors[i * 3 + 1] = c.g; pulseColors[i * 3 + 2] = c.b;
    });

    for (let i = visible.length; i < MAX_POINTS; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (pulse) pulse.setMatrixAt(i, dummy.matrix);
      if (hit) hit.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    if (pulse) {
      pulse.instanceMatrix.needsUpdate = true;
      pulse.instanceColor = new THREE.InstancedBufferAttribute(pulseColors, 3);
    }
    if (hit) {
      hit.instanceMatrix.needsUpdate = true;
    }
  }, [visible, dummy]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const pulse = pulseRef.current;
    if (!pulse) return;
    const t = timeRef.current;
    visible.forEach((ev, i) => {
      if (ev.severity !== 'critical' && ev.severity !== 'high') return;
      const pos = latLonTo3(ev.source.lat, ev.source.lon, R * 1.015);
      const pulseScale = 1.5 + Math.sin(t * 3 + i * 0.5) * 0.8;
      dummy.position.copy(pos);
      dummy.scale.setScalar(pulseScale * (ev.severity === 'critical' ? 3.5 : 2.5));
      dummy.updateMatrix();
      pulse.setMatrixAt(i, dummy.matrix);
    });
    pulse.instanceMatrix.needsUpdate = true;
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && visible[e.instanceId]) {
      onSelect(visible[e.instanceId]);
    }
  }, [visible, onSelect]);

  return (
    <group>
      {/* Pulse glow layer */}
      <instancedMesh ref={pulseRef} args={[undefined, undefined, MAX_POINTS]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial transparent opacity={0.12} toneMapped={false} />
      </instancedMesh>
      {/* Visible dots */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_POINTS]}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Invisible hit detection mesh — much larger for easy clicking */}
      <instancedMesh ref={hitRef} args={[undefined, undefined, MAX_POINTS]} onClick={handleClick}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

function AttackArcs({ events }: { events: ThreatEvent[] }) {
  const arcsData = useMemo(() =>
    events.slice(0, MAX_ARCS).map(ev => {
      const s = latLonTo3(ev.source.lat, ev.source.lon, R * 1.015);
      const e = latLonTo3(ev.target.lat, ev.target.lon, R * 1.015);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      const dist = s.distanceTo(e);
      mid.normalize().multiplyScalar(R + dist * 0.4);
      const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
      return {
        pts: curve.getPoints(48).map(p => [p.x, p.y, p.z] as [number, number, number]),
        color: SEVERITY_COLORS[ev.severity],
        id: ev.id,
        severity: ev.severity,
      };
    }),
  [events]);

  return (
    <group>
      {arcsData.map(a => (
        <group key={a.id}>
          <Line points={a.pts} color={a.color}
            lineWidth={a.severity === 'critical' ? 2.5 : a.severity === 'high' ? 1.5 : 0.6}
            transparent opacity={a.severity === 'critical' ? 0.75 : a.severity === 'high' ? 0.35 : 0.12} />
          {(a.severity === 'critical' || a.severity === 'high') && (
            <Line points={a.pts} color="#ffffff" lineWidth={0.3}
              transparent opacity={a.severity === 'critical' ? 0.18 : 0.06} />
          )}
        </group>
      ))}
    </group>
  );
}

function TargetMarkers({ events }: { events: ThreatEvent[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const targets = useMemo(() => {
    const seen = new Set<string>();
    return events.slice(0, MAX_ARCS).filter(ev => {
      const key = `${ev.target.lat.toFixed(1)}_${ev.target.lon.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color('#00e5ff');
    const colors = new Float32Array(100 * 3);
    targets.forEach((ev, i) => {
      if (i >= 100) return;
      const pos = latLonTo3(ev.target.lat, ev.target.lon, R * 1.012);
      dummy.position.copy(pos);
      dummy.scale.setScalar(1.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });
    for (let i = targets.length; i < 100; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [targets, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 100]}>
      <octahedronGeometry args={[0.014, 0]} />
      <meshBasicMaterial transparent opacity={0.85} toneMapped={false} />
    </instancedMesh>
  );
}

function SceneSetup() {
  const { gl } = useThree();
  useEffect(() => { gl.setClearColor('#020408'); }, [gl]);
  return null;
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
      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/30">
        <span className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }} />
        <span className="text-foreground font-mono">Target</span>
      </div>
    </div>
  );
}

export function GlobeView() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 45 }} gl={{ antialias: true, alpha: false }}>
        <SceneSetup />
        <ambientLight intensity={0.15} color="#c0e0ff" />
        <directionalLight position={[5, 3, 5]} intensity={0.8} color="#e0f0ff" />
        <directionalLight position={[-4, 1, -3]} intensity={0.3} color="#80b0e0" />
        <pointLight position={[-5, -3, -5]} intensity={0.1} color="#4080b0" />
        <Suspense fallback={null}>
          <Stars radius={200} depth={120} count={4000} factor={3.5} saturation={0.1} fade speed={0.08} />
          <CyberEarth />
          <CountryLabels />
          <EventPoints events={filteredEvents} onSelect={setSelectedEvent} />
          <AttackArcs events={filteredEvents} />
          <TargetMarkers events={filteredEvents} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.6}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.12}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>

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
    </div>
  );
}
