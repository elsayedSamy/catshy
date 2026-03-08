/**
 * GlobeView — Premium 3D interactive threat globe.
 *
 * Features:
 *  • Multi-layer atmospheric glow with bloom
 *  • Continent outlines drawn on the sphere
 *  • InstancedMesh with animated pulse for critical events
 *  • Animated attack arcs with glowing trails
 *  • Starfield with nebula-like depth
 *  • Auto-rotate with damped orbit controls
 */
import { useRef, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useThreatContext } from './ThreatContext';
import { ThreatEvent, SEVERITY_COLORS } from './types';

const R = 2;
const MAX_POINTS = 500;
const MAX_ARCS = 80;

/* ── Helpers ── */
function latLonTo3(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

/* ── Continent outlines for sphere surface ── */
const CONTINENT_PATHS: [number, number][][] = [
  // North America
  [[-168,72],[-140,70],[-130,72],[-120,75],[-100,73],[-85,76],[-65,82],[-45,72],[-55,52],[-60,46],[-67,44],[-70,43],[-75,35],[-80,32],[-82,25],[-90,30],[-97,26],[-105,20],[-105,30],[-117,33],[-120,35],[-123,46],[-125,50],[-130,55],[-140,60],[-150,60],[-165,55],[-168,65],[-168,72]],
  // South America
  [[-80,10],[-77,7],[-73,4],[-70,2],[-65,-2],[-70,-4],[-75,-15],[-70,-18],[-65,-22],[-58,-22],[-48,-15],[-42,-23],[-38,-13],[-35,-6],[-35,-3],[-50,0],[-52,4],[-57,6],[-60,8],[-63,10],[-67,12],[-73,11],[-78,9],[-80,10]],
  // Europe
  [[-10,36],[-9,39],[-5,36],[0,38],[3,43],[0,46],[-4,48],[-8,44],[-10,44],[-9,46],[2,51],[5,54],[8,54],[10,56],[12,55],[14,54],[18,55],[22,55],[24,60],[20,65],[18,68],[15,69],[10,64],[5,62],[5,58],[8,58],[5,49],[-2,48],[-5,44],[-10,36]],
  // Africa
  [[-17,15],[-17,21],[-13,28],[-5,36],[-2,35],[10,37],[12,33],[25,32],[33,30],[35,32],[40,12],[50,12],[42,2],[40,-3],[42,-12],[40,-16],[35,-25],[33,-34],[28,-33],[25,-30],[20,-30],[18,-23],[15,-18],[12,-6],[10,0],[8,5],[5,5],[2,6],[-5,5],[-8,5],[-15,11],[-17,15]],
  // Asia
  [[26,41],[30,42],[35,42],[40,40],[44,42],[50,38],[53,37],[55,44],[60,42],[63,40],[66,38],[68,35],[72,30],[72,22],[78,8],[80,14],[85,20],[88,22],[92,20],[98,16],[100,14],[103,10],[105,15],[108,22],[110,20],[117,24],[120,24],[122,30],[127,35],[130,33],[131,35],[136,35],[140,40],[145,44],[143,50],[140,55],[135,55],[130,60],[125,60],[120,58],[110,55],[100,55],[90,48],[80,50],[75,55],[68,55],[60,55],[55,55],[50,52],[48,47],[45,48],[40,44],[35,42],[26,41]],
  // Australia
  [[114,-22],[116,-20],[121,-17],[129,-15],[133,-12],[136,-12],[140,-18],[145,-15],[150,-22],[153,-28],[153,-32],[150,-35],[148,-38],[145,-38],[142,-35],[140,-38],[135,-35],[131,-32],[128,-32],[124,-34],[118,-35],[115,-33],[114,-30],[114,-22]],
  // Antarctica (partial)
  [[-180,-78],[-150,-80],[-120,-75],[-90,-78],[-60,-75],[-30,-70],[0,-72],[30,-70],[60,-68],[90,-67],[120,-68],[150,-72],[180,-78]],
];

/* ── Sub-components ── */
function GlobeSphere() {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef}>
      {/* Main sphere */}
      <mesh>
        <sphereGeometry args={[R, 96, 96]} />
        <meshPhongMaterial
          color="#060e1a"
          shininess={5}
          specular={new THREE.Color('#0a2030')}
        />
      </mesh>

      {/* Wireframe grid - subtle */}
      <mesh>
        <sphereGeometry args={[R * 1.001, 48, 24]} />
        <meshBasicMaterial color="#0ea5e9" wireframe transparent opacity={0.04} />
      </mesh>

      {/* Inner glow layer */}
      <mesh>
        <sphereGeometry args={[R * 1.002, 64, 64]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.015} />
      </mesh>

      {/* Atmosphere glow - inner */}
      <mesh>
        <sphereGeometry args={[R * 1.06, 64, 64]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>

      {/* Atmosphere glow - mid */}
      <mesh>
        <sphereGeometry args={[R * 1.12, 48, 48]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.025} side={THREE.BackSide} />
      </mesh>

      {/* Atmosphere glow - outer */}
      <mesh>
        <sphereGeometry args={[R * 1.22, 32, 32]} />
        <meshBasicMaterial color="#0369a1" transparent opacity={0.012} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ── Continent Lines on Globe ── */
function ContinentOutlines() {
  const lines = useMemo(() => {
    return CONTINENT_PATHS.map((path, ci) => {
      const pts = path.map(([lon, lat]) => {
        const v = latLonTo3(lat, lon, R * 1.003);
        return [v.x, v.y, v.z] as [number, number, number];
      });
      return { pts, id: ci };
    });
  }, []);

  return (
    <group>
      {lines.map(l => (
        <Line key={l.id} points={l.pts} color="#0ea5e9" lineWidth={0.8} transparent opacity={0.25} />
      ))}
    </group>
  );
}

/* ── Event Points with Pulse ── */
function EventPoints({
  events,
  onSelect,
}: {
  events: ThreatEvent[];
  onSelect: (e: ThreatEvent) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visible = useMemo(() => events.slice(0, MAX_POINTS), [events]);
  const timeRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    const pulse = pulseRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    const colors = new Float32Array(MAX_POINTS * 3);
    const pulseColors = new Float32Array(MAX_POINTS * 3);

    visible.forEach((ev, i) => {
      const pos = latLonTo3(ev.source.lat, ev.source.lon, R * 1.008);
      dummy.position.copy(pos);
      const scale = ev.severity === 'critical' ? 2.5 : ev.severity === 'high' ? 1.8 : 1.2;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (pulse) pulse.setMatrixAt(i, dummy.matrix);

      c.set(SEVERITY_COLORS[ev.severity]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      pulseColors[i * 3] = c.r;
      pulseColors[i * 3 + 1] = c.g;
      pulseColors[i * 3 + 2] = c.b;
    });

    for (let i = visible.length; i < MAX_POINTS; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (pulse) pulse.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    if (pulse) {
      pulse.instanceMatrix.needsUpdate = true;
      pulse.instanceColor = new THREE.InstancedBufferAttribute(pulseColors, 3);
    }
  }, [visible, dummy]);

  // Animate pulse ring for critical events
  useFrame((_, delta) => {
    timeRef.current += delta;
    const pulse = pulseRef.current;
    if (!pulse) return;

    const t = timeRef.current;
    visible.forEach((ev, i) => {
      if (ev.severity !== 'critical' && ev.severity !== 'high') return;
      const pos = latLonTo3(ev.source.lat, ev.source.lon, R * 1.008);
      const pulseScale = 1.5 + Math.sin(t * 3 + i * 0.5) * 0.8;
      dummy.position.copy(pos);
      dummy.scale.setScalar(pulseScale * (ev.severity === 'critical' ? 2.5 : 1.8));
      dummy.updateMatrix();
      pulse.setMatrixAt(i, dummy.matrix);
    });
    pulse.instanceMatrix.needsUpdate = true;
  });

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined && visible[e.instanceId]) {
        onSelect(visible[e.instanceId]);
      }
    },
    [visible, onSelect],
  );

  return (
    <group>
      {/* Pulse rings (behind) */}
      <instancedMesh ref={pulseRef} args={[undefined, undefined, MAX_POINTS]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshBasicMaterial transparent opacity={0.15} toneMapped={false} />
      </instancedMesh>

      {/* Main dots */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_POINTS]} onClick={handleClick}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ── Animated Attack Arcs ── */
function AttackArcs({ events }: { events: ThreatEvent[] }) {
  const arcsData = useMemo(() => {
    return events.slice(0, MAX_ARCS).map(ev => {
      const s = latLonTo3(ev.source.lat, ev.source.lon, R * 1.008);
      const e = latLonTo3(ev.target.lat, ev.target.lon, R * 1.008);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      const dist = s.distanceTo(e);
      mid.normalize().multiplyScalar(R + dist * 0.3);
      const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
      return {
        pts: curve.getPoints(48).map(p => [p.x, p.y, p.z] as [number, number, number]),
        color: SEVERITY_COLORS[ev.severity],
        id: ev.id,
        severity: ev.severity,
      };
    });
  }, [events]);

  return (
    <group>
      {arcsData.map(a => (
        <group key={a.id}>
          {/* Glow arc */}
          <Line
            points={a.pts}
            color={a.color}
            lineWidth={a.severity === 'critical' ? 2 : 1.2}
            transparent
            opacity={a.severity === 'critical' ? 0.5 : 0.2}
          />
          {/* Core bright line */}
          <Line
            points={a.pts}
            color="#ffffff"
            lineWidth={0.5}
            transparent
            opacity={a.severity === 'critical' ? 0.15 : 0.05}
          />
        </group>
      ))}
    </group>
  );
}

/* ── Target dots (destination markers) ── */
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
    const c = new THREE.Color('#22d3ee');
    const colors = new Float32Array(100 * 3);

    targets.forEach((ev, i) => {
      if (i >= 100) return;
      const pos = latLonTo3(ev.target.lat, ev.target.lon, R * 1.006);
      dummy.position.copy(pos);
      dummy.scale.setScalar(1.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
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
      <meshBasicMaterial transparent opacity={0.7} toneMapped={false} />
    </instancedMesh>
  );
}

function SceneSetup() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor('#030810');
  }, [gl]);
  return null;
}

/* ── Legend Overlay ── */
function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-md border border-border rounded-lg px-3 py-2 text-[10px] space-y-1 z-10">
      <p className="text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Severity</p>
      {Object.entries(SEVERITY_COLORS).map(([k, c]) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
          <span className="text-foreground capitalize">{k}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border">
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="text-foreground">Target</span>
      </div>
    </div>
  );
}

/* ── Main export ── */
export function GlobeView() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();

  return (
    <div className="w-full h-full relative">
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 45 }}>
        <SceneSetup />
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 3, 5]} intensity={0.4} color="#e0f2fe" />
        <pointLight position={[-5, -3, -5]} intensity={0.15} color="#06b6d4" />
        <Suspense fallback={null}>
          <Stars radius={100} depth={60} count={2500} factor={3} saturation={0.1} fade speed={0.3} />
          <GlobeSphere />
          <ContinentOutlines />
          <EventPoints events={filteredEvents} onSelect={setSelectedEvent} />
          <AttackArcs events={filteredEvents} />
          <TargetMarkers events={filteredEvents} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.6}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.25}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
      <Legend />
    </div>
  );
}
