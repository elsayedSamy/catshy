/**
 * GlobeView — 3D interactive threat globe using React Three Fiber.
 *
 * Features:
 *  • Dark sphere with wireframe grid overlay
 *  • InstancedMesh for up to 500 event points (colored by severity)
 *  • Animated attack arcs (QuadraticBezierCurve3)
 *  • Atmospheric glow, starfield backdrop
 *  • OrbitControls with auto-rotate
 *  • Click on event point → opens detail panel
 */
import { useRef, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useThreatContext } from './ThreatContext';
import { ThreatEvent, SEVERITY_COLORS } from './types';

const R = 2; // globe radius
const MAX_POINTS = 500;
const MAX_ARCS = 60;

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

/* ── Sub-components ── */
function GlobeSphere() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[R, 64, 64]} />
        <meshStandardMaterial color="#0a0f1a" roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.001, 36, 18]} />
        <meshBasicMaterial color="#1a3a4a" wireframe transparent opacity={0.12} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.12, 32, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function EventPoints({
  events,
  onSelect,
}: {
  events: ThreatEvent[];
  onSelect: (e: ThreatEvent) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const visible = useMemo(() => events.slice(0, MAX_POINTS), [events]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color();
    const colors = new Float32Array(MAX_POINTS * 3);

    visible.forEach((ev, i) => {
      const pos = latLonTo3(ev.source.lat, ev.source.lon, R * 1.008);
      dummy.position.copy(pos);
      dummy.scale.setScalar(ev.severity === 'critical' ? 2 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      c.set(SEVERITY_COLORS[ev.severity]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });

    for (let i = visible.length; i < MAX_POINTS; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [visible, dummy]);

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_POINTS]} onClick={handleClick}>
      <sphereGeometry args={[0.018, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function AttackArcs({ events }: { events: ThreatEvent[] }) {
  const arcs = useMemo(() => {
    return events.slice(0, MAX_ARCS).map(ev => {
      const s = latLonTo3(ev.source.lat, ev.source.lon, R * 1.008);
      const e = latLonTo3(ev.target.lat, ev.target.lon, R * 1.008);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      const dist = s.distanceTo(e);
      mid.normalize().multiplyScalar(R + dist * 0.25);
      const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
      return {
        pts: curve.getPoints(32).map(p => [p.x, p.y, p.z] as [number, number, number]),
        color: SEVERITY_COLORS[ev.severity],
        id: ev.id,
      };
    });
  }, [events]);

  return (
    <group>
      {arcs.map(a => (
        <Line key={a.id} points={a.pts} color={a.color} lineWidth={1} transparent opacity={0.3} />
      ))}
    </group>
  );
}

function SceneSetup() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor('#050a12');
  }, [gl]);
  return null;
}

/* ── Main export ── */
export function GlobeView() {
  const { filteredEvents, setSelectedEvent } = useThreatContext();

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 1.5, 4.5], fov: 45 }}>
        <SceneSetup />
        <ambientLight intensity={0.35} />
        <pointLight position={[10, 10, 10]} intensity={0.4} />
        <Suspense fallback={null}>
          <Stars radius={80} depth={40} count={1500} factor={3} saturation={0} fade speed={0.4} />
          <GlobeSphere />
          <EventPoints events={filteredEvents} onSelect={setSelectedEvent} />
          <AttackArcs events={filteredEvents} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.8}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
