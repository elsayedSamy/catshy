/**
 * GlobeView v2 — Premium cyber-aesthetic 3D threat globe.
 * 
 * Enhancements over v1:
 *  • Animated traveling particles along attack arcs (like tracers)
 *  • Hover tooltip on events with rich info card
 *  • Expanding pulse rings on critical/high events
 *  • Smoother spring camera with momentum
 *  • Better atmosphere with Fresnel-like multi-glow
 *  • Interactive hover glow on Earth surface
 *  • Auto-rotate pauses on interaction, resumes after idle
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
const MAX_PARTICLES = 300;
const MAX_PULSE_RINGS = 40;

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
      colorMap.anisotropy = 16;
    }
  }, [colorMap]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.012;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[R, 164, 164]} />
        <meshPhongMaterial
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.05}
          shininess={20}
          specular={new THREE.Color('#1a3a5c')}
          emissive="#060e1a"
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Cloud haze */}
      <mesh>
        <sphereGeometry args={[R * 1.003, 96, 96]} />
        <meshPhongMaterial color="#ffffff" transparent opacity={0.025} depthWrite={false} />
      </mesh>

      {/* Multi-layer atmosphere (Fresnel-like) */}
      <mesh>
        <sphereGeometry args={[R * 1.015, 64, 64]} />
        <meshBasicMaterial color="#4da6ff" transparent opacity={0.07} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.04, 64, 64]} />
        <meshBasicMaterial color="#3a7bd5" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.08, 48, 48]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.15, 32, 32]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.02} side={THREE.BackSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[R * 1.25, 32, 32]} />
        <meshBasicMaterial color="#1e40af" transparent opacity={0.012} side={THREE.BackSide} />
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
      const scale = ev.severity === 'critical' ? 4 : ev.severity === 'high' ? 3 : ev.severity === 'medium' ? 2 : 1.2;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (pulse) pulse.setMatrixAt(i, dummy.matrix);

      if (hit) {
        dummy.scale.setScalar(scale * 5);
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
    if (hit) hit.instanceMatrix.needsUpdate = true;
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
      dummy.scale.setScalar(pulseScale * (ev.severity === 'critical' ? 4 : 3));
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
      {/* Pulse glow layer */}
      <instancedMesh ref={pulseRef} args={[undefined, undefined, MAX_POINTS]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial transparent opacity={0.12} toneMapped={false} />
      </instancedMesh>
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

/* ── Animated Attack Arcs with traveling particles ── */
function AttackArcs({ events }: { events: ThreatEvent[] }) {
  const arcsData = useMemo(() =>
    events.slice(0, MAX_ARCS).map(ev => {
      const s = latLonTo3(ev.source.lat, ev.source.lon, R * 1.015);
      const e = latLonTo3(ev.target.lat, ev.target.lon, R * 1.015);
      const mid = s.clone().add(e).multiplyScalar(0.5);
      const dist = s.distanceTo(e);
      mid.normalize().multiplyScalar(R + dist * 0.4);
      const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
      return { curve, color: SEVERITY_COLORS[ev.severity], id: ev.id, severity: ev.severity };
    }),
  [events]);

  return (
    <group>
      {arcsData.map(a => (
        <ArcWithParticle key={a.id} curve={a.curve} color={a.color} severity={a.severity} />
      ))}
    </group>
  );
}

/* Single arc line + animated traveling particle */
function ArcWithParticle({ curve, color, severity }: { curve: THREE.QuadraticBezierCurve3; color: string; severity: string }) {
  const particleRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(Math.random()); // stagger start
  const pts = useMemo(() => curve.getPoints(48).map(p => [p.x, p.y, p.z] as [number, number, number]), [curve]);
  const lineWidth = severity === 'critical' ? 2.5 : severity === 'high' ? 1.5 : 0.6;
  const opacity = severity === 'critical' ? 0.7 : severity === 'high' ? 0.3 : 0.1;
  const speed = severity === 'critical' ? 0.6 : severity === 'high' ? 0.4 : 0.25;

  useFrame((_, delta) => {
    progressRef.current = (progressRef.current + delta * speed) % 1;
    const t = progressRef.current;
    const pos = curve.getPointAt(t);
    if (particleRef.current) {
      particleRef.current.position.copy(pos);
      const scale = severity === 'critical' ? 0.025 : severity === 'high' ? 0.018 : 0.012;
      particleRef.current.scale.setScalar(scale);
    }
    // Trail slightly behind
    if (trailRef.current) {
      const trailT = Math.max(0, t - 0.06);
      const trailPos = curve.getPointAt(trailT);
      trailRef.current.position.copy(trailPos);
      const trailScale = severity === 'critical' ? 0.018 : severity === 'high' ? 0.012 : 0.008;
      trailRef.current.scale.setScalar(trailScale);
    }
  });

  return (
    <group>
      {/* Static arc line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pts.length}
            array={new Float32Array(pts.flat())}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={1} />
      </line>
      {/* White inner glow for critical/high */}
      {(severity === 'critical' || severity === 'high') && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={pts.length}
              array={new Float32Array(pts.flat())}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" transparent opacity={severity === 'critical' ? 0.15 : 0.05} linewidth={1} />
        </line>
      )}
      {/* Traveling particle */}
      <mesh ref={particleRef}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Trail particle */}
      <mesh ref={trailRef}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ── Expanding Pulse Rings on critical events ── */
function PulseRings({ events }: { events: ThreatEvent[] }) {
  const ringEvents = useMemo(() =>
    events.filter(e => e.severity === 'critical' || e.severity === 'high').slice(0, MAX_PULSE_RINGS),
  [events]);

  return (
    <group>
      {ringEvents.map((ev, i) => (
        <PulseRing key={ev.id} event={ev} offset={i * 0.3} />
      ))}
    </group>
  );
}

function PulseRing({ event, offset }: { event: ThreatEvent; offset: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLonTo3(event.source.lat, event.source.lon, R * 1.012), [event]);
  const normal = useMemo(() => pos.clone().normalize(), [pos]);
  const color = SEVERITY_COLORS[event.severity];

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = ((clock.getElapsedTime() + offset) % 3) / 3; // 3s cycle
    const scale = 0.02 + t * 0.12;
    ringRef.current.scale.setScalar(scale);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.35;
  });

  return (
    <mesh ref={ringRef} position={pos} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
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

  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
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
      const breathe = 1 + Math.sin(timeRef.current * 1.5 + i * 0.3) * 0.15;
      const scale = (0.08 + intensity * 0.25) * breathe;
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
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_HOTSPOTS]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial transparent opacity={0.18} toneMapped={false} depthWrite={false} />
    </instancedMesh>
  );
}

/* ── Target Markers ── */
function TargetMarkers({ events }: { events: ThreatEvent[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const MAX_TARGETS = 100;
  const targets = useMemo(() => {
    const seen = new Set<string>();
    return events.slice(0, MAX_ARCS).filter(ev => {
      const key = `${ev.target.lat.toFixed(1)}_${ev.target.lon.toFixed(1)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [events]);

  const timeRef = useRef(0);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const c = new THREE.Color('#00e5ff');
    const colors = new Float32Array(MAX_TARGETS * 3);
    targets.forEach((ev, i) => {
      if (i >= MAX_TARGETS) return;
      const pos = latLonTo3(ev.target.lat, ev.target.lon, R * 1.012);
      dummy.position.copy(pos);
      dummy.scale.setScalar(1.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });
    for (let i = targets.length; i < MAX_TARGETS; i++) {
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  }, [targets, dummy]);

  // Gentle bob animation
  useFrame((_, delta) => {
    timeRef.current += delta;
    const mesh = meshRef.current;
    if (!mesh) return;
    targets.forEach((ev, i) => {
      if (i >= MAX_TARGETS) return;
      const bob = 1.3 + Math.sin(timeRef.current * 2 + i * 0.7) * 0.3;
      const pos = latLonTo3(ev.target.lat, ev.target.lon, R * 1.012);
      dummy.position.copy(pos);
      dummy.scale.setScalar(bob);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_TARGETS]}>
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

/* ── Camera zoom-to-event with spring dynamics ── */
function CameraController({ target }: { target: ThreatEvent | null }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 1.2, 4.2));
  const velocity = useRef(new THREE.Vector3());
  const isAnimating = useRef(false);

  useEffect(() => {
    if (target) {
      const pos = latLonTo3(target.source.lat, target.source.lon, R * 1.015);
      const dir = pos.clone().normalize();
      targetPos.current = dir.multiplyScalar(3.0);
      isAnimating.current = true;
      velocity.current.set(0, 0, 0);
    } else {
      targetPos.current = new THREE.Vector3(0, 1.2, 4.2);
      isAnimating.current = true;
      velocity.current.set(0, 0, 0);
    }
  }, [target]);

  useFrame((_, delta) => {
    if (!isAnimating.current) return;
    // Spring-damper system for smooth camera
    const stiffness = 4;
    const damping = 3;
    const diff = targetPos.current.clone().sub(camera.position);
    const springForce = diff.multiplyScalar(stiffness);
    const dampForce = velocity.current.clone().multiplyScalar(-damping);
    const acceleration = springForce.add(dampForce);
    velocity.current.add(acceleration.multiplyScalar(delta));
    camera.position.add(velocity.current.clone().multiplyScalar(delta));

    if (camera.position.distanceTo(targetPos.current) < 0.005 && velocity.current.length() < 0.01) {
      isAnimating.current = false;
    }
  });

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
          {event.campaign_id && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Campaign</span>
              <span className="text-primary">{event.campaign_id}</span>
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
      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/30">
        <span className="w-2.5 h-2.5 rotate-45" style={{ backgroundColor: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }} />
        <span className="text-foreground font-mono">Target</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: '#ffffff', boxShadow: '0 0 4px #ffffff' }} />
        <span className="text-foreground font-mono">Particle Trail</span>
      </div>
    </div>
  );
}

export function GlobeView() {
  const { filteredEvents, setSelectedEvent, selectedEvent, setZoomToEvent, zoomToEvent } = useThreatContext();
  const [hoveredEvent, setHoveredEvent] = useState<ThreatEvent | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleSelect = useCallback((ev: ThreatEvent) => {
    setSelectedEvent(ev);
    setZoomToEvent(ev);
    setHoveredEvent(null);
  }, [setSelectedEvent, setZoomToEvent]);

  const handleHover = useCallback((ev: ThreatEvent | null, pos?: { x: number; y: number }) => {
    setHoveredEvent(ev);
    setHoverPos(pos || null);
  }, []);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 1.2, 4.2], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <SceneSetup />
        <CameraController target={zoomToEvent} />
        <ambientLight intensity={0.12} color="#c0e0ff" />
        <directionalLight position={[5, 3, 5]} intensity={0.9} color="#e0f0ff" />
        <directionalLight position={[-4, 1, -3]} intensity={0.3} color="#80b0e0" />
        <pointLight position={[-5, -3, -5]} intensity={0.1} color="#4080b0" />
        <pointLight position={[3, -2, 4]} intensity={0.08} color="#2060a0" />
        <Suspense fallback={null}>
          <Stars radius={200} depth={120} count={5000} factor={3.5} saturation={0.1} fade speed={0.06} />
          <RealisticEarth />
          <CountryLabels />
          <EventPoints events={filteredEvents} onSelect={handleSelect} onHover={handleHover} />
          <AttackArcs events={filteredEvents} />
          <HeatmapGlow events={filteredEvents} />
          <TargetMarkers events={filteredEvents} />
          <PulseRings events={filteredEvents} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.5}
          maxDistance={12}
          autoRotate
          autoRotateSpeed={0.1}
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
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

      {/* Hover tooltip rendered in DOM outside Canvas */}
      <HoverTooltip event={hoveredEvent} position={hoverPos} />
    </div>
  );
}
