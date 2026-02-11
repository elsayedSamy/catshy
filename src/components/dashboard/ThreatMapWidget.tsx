import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Globe, Pause, Play, Maximize2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';

const COUNTRY_COORDS: Record<string, { lon: number; lat: number; name: string }> = {
  US: { lon: -98, lat: 38, name: 'United States' }, CN: { lon: 104, lat: 35, name: 'China' },
  RU: { lon: 90, lat: 60, name: 'Russia' }, DE: { lon: 10, lat: 51, name: 'Germany' },
  GB: { lon: -1, lat: 53, name: 'United Kingdom' }, FR: { lon: 2, lat: 47, name: 'France' },
  IN: { lon: 78, lat: 21, name: 'India' }, BR: { lon: -51, lat: -10, name: 'Brazil' },
  JP: { lon: 138, lat: 36, name: 'Japan' }, KR: { lon: 128, lat: 36, name: 'South Korea' },
  IR: { lon: 53, lat: 33, name: 'Iran' }, KP: { lon: 127, lat: 40, name: 'North Korea' },
  UA: { lon: 32, lat: 49, name: 'Ukraine' }, NL: { lon: 5, lat: 52, name: 'Netherlands' },
  AU: { lon: 134, lat: -25, name: 'Australia' }, SA: { lon: 45, lat: 24, name: 'Saudi Arabia' },
  EG: { lon: 30, lat: 27, name: 'Egypt' }, NG: { lon: 8, lat: 10, name: 'Nigeria' },
  ZA: { lon: 25, lat: -29, name: 'South Africa' }, IL: { lon: 35, lat: 31, name: 'Israel' },
  TR: { lon: 35, lat: 39, name: 'Turkey' }, PK: { lon: 70, lat: 30, name: 'Pakistan' },
  VN: { lon: 106, lat: 16, name: 'Vietnam' }, TW: { lon: 121, lat: 24, name: 'Taiwan' },
  SG: { lon: 104, lat: 1, name: 'Singapore' }, AE: { lon: 54, lat: 24, name: 'UAE' },
  CA: { lon: -106, lat: 56, name: 'Canada' }, MX: { lon: -102, lat: 23, name: 'Mexico' },
  AR: { lon: -64, lat: -34, name: 'Argentina' }, CL: { lon: -71, lat: -35, name: 'Chile' },
  CO: { lon: -74, lat: 4, name: 'Colombia' }, PE: { lon: -76, lat: -10, name: 'Peru' },
  SE: { lon: 18, lat: 62, name: 'Sweden' }, NO: { lon: 10, lat: 62, name: 'Norway' },
  FI: { lon: 26, lat: 64, name: 'Finland' }, PL: { lon: 20, lat: 52, name: 'Poland' },
  IT: { lon: 12, lat: 43, name: 'Italy' }, ES: { lon: -4, lat: 40, name: 'Spain' },
  PT: { lon: -8, lat: 39, name: 'Portugal' }, GR: { lon: 22, lat: 39, name: 'Greece' },
  TH: { lon: 101, lat: 15, name: 'Thailand' }, ID: { lon: 120, lat: -5, name: 'Indonesia' },
  PH: { lon: 122, lat: 13, name: 'Philippines' }, MY: { lon: 102, lat: 4, name: 'Malaysia' },
  KE: { lon: 38, lat: 1, name: 'Kenya' }, ET: { lon: 40, lat: 9, name: 'Ethiopia' },
  GH: { lon: -1, lat: 8, name: 'Ghana' }, MA: { lon: -8, lat: 32, name: 'Morocco' },
  NZ: { lon: 174, lat: -41, name: 'New Zealand' },
};

interface CountryDetail {
  code: string;
  name: string;
  threats: { critical: number; high: number; medium: number; low: number };
  topIocs: string[];
  topEventTypes: string[];
  assetsAffected: number;
}

interface MapEvent {
  source: string;
  target: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createArcCurve(src: THREE.Vector3, tgt: THREE.Vector3, radius: number): THREE.CubicBezierCurve3 {
  const mid = new THREE.Vector3().addVectors(src, tgt).multiplyScalar(0.5);
  const dist = src.distanceTo(tgt);
  mid.normalize().multiplyScalar(radius + dist * 0.3);
  const ctrl1 = new THREE.Vector3().lerpVectors(src, mid, 0.33).normalize().multiplyScalar(radius + dist * 0.2);
  const ctrl2 = new THREE.Vector3().lerpVectors(tgt, mid, 0.33).normalize().multiplyScalar(radius + dist * 0.2);
  return new THREE.CubicBezierCurve3(src, ctrl1, ctrl2, tgt);
}

export function ThreatMapWidget({
  events = [],
  isLoading,
  myAssetsFirst,
  onToggleMyAssets,
}: {
  events?: MapEvent[];
  isLoading: boolean;
  myAssetsFirst: boolean;
  onToggleMyAssets: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const [playing, setPlaying] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<CountryDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const animRef = useRef<number>();
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const rotationTarget = useRef({ x: 0.3, y: 0 });
  const navigate = useNavigate();
  const raycaster = useRef(new THREE.Raycaster());
  const countryMeshes = useRef<Map<string, THREE.Mesh>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const RADIUS = 1.8;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.z = 5.5;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0f1a, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Globe group
    const globeGroup = new THREE.Group();
    globeRef.current = globeGroup;
    scene.add(globeGroup);

    // Globe sphere (dark with wireframe feel)
    const sphereGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x0d1520,
      transparent: true,
      opacity: 0.95,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(sphere);

    // Wireframe grid on globe
    const wireGeo = new THREE.SphereGeometry(RADIUS + 0.005, 36, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    globeGroup.add(new THREE.Mesh(wireGeo, wireMat));

    // Latitude/longitude lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.08 });
    // Latitude lines
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        pts.push(latLonToVec3(lat, lon, RADIUS + 0.01));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      globeGroup.add(new THREE.Line(geo, lineMat));
    }
    // Longitude lines
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) {
        pts.push(latLonToVec3(lat, lon, RADIUS + 0.01));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      globeGroup.add(new THREE.Line(geo, lineMat));
    }

    // Atmosphere glow
    const glowGeo = new THREE.SphereGeometry(RADIUS * 1.15, 64, 64);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(0.024, 0.714, 0.831, 1.0) * intensity * 0.4;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    globeGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // Country dots + labels
    const countryMap = new Map<string, THREE.Mesh>();
    const labelSprites: THREE.Sprite[] = [];
    
    for (const [code, data] of Object.entries(COUNTRY_COORDS)) {
      const pos = latLonToVec3(data.lat, data.lon, RADIUS + 0.02);

      // Dot
      const dotGeo = new THREE.SphereGeometry(0.025, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData = { code, name: data.name };
      globeGroup.add(dot);
      countryMap.set(code, dot);

      // Pulse ring
      const ringGeo = new THREE.RingGeometry(0.03, 0.05, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.userData = { isPulse: true };
      globeGroup.add(ring);

      // Label
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const c = canvas.getContext('2d')!;
      c.fillStyle = 'rgba(6, 182, 212, 0.8)';
      c.font = 'bold 24px monospace';
      c.fillText(code, 4, 28);
      c.fillStyle = 'rgba(148, 163, 184, 0.6)';
      c.font = '16px monospace';
      c.fillText(data.name, 4, 52);
      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 });
      const sprite = new THREE.Sprite(spriteMat);
      const labelPos = pos.clone().normalize().multiplyScalar(RADIUS + 0.12);
      sprite.position.copy(labelPos);
      sprite.scale.set(0.4, 0.1, 1);
      globeGroup.add(sprite);
      labelSprites.push(sprite);
    }
    countryMeshes.current = countryMap;

    // Attack arcs
    const arcGroup = new THREE.Group();
    globeGroup.add(arcGroup);
    const arcDots: { curve: THREE.CubicBezierCurve3; mesh: THREE.Mesh; speed: number }[] = [];

    for (const ev of events) {
      const src = COUNTRY_COORDS[ev.source];
      const tgt = COUNTRY_COORDS[ev.target];
      if (!src || !tgt) continue;
      const srcV = latLonToVec3(src.lat, src.lon, RADIUS + 0.02);
      const tgtV = latLonToVec3(tgt.lat, tgt.lon, RADIUS + 0.02);
      const curve = createArcCurve(srcV, tgtV, RADIUS);
      const pts = curve.getPoints(50);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const col = ev.severity === 'critical' ? 0xef4444 : ev.severity === 'high' ? 0xf59e0b : 0x06b6d4;
      const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.3 });
      arcGroup.add(new THREE.Line(geo, mat));

      // Moving dot
      const dotGeo = new THREE.SphereGeometry(0.02, 6, 6);
      const dotMat = new THREE.MeshBasicMaterial({ color: col });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      arcGroup.add(dot);
      arcDots.push({ curve, mesh: dot, speed: 0.3 + Math.random() * 0.2 });
    }

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(3000);
    for (let i = 0; i < 3000; i++) {
      starPositions[i] = (Math.random() - 0.5) * 40;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x334155, size: 0.03 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Animation
    let time = 0;
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      if (playing) {
        time += 0.005;
        if (!isDragging.current) {
          rotationTarget.current.y += 0.001;
        }
      }

      // Smooth rotation
      globeGroup.rotation.x += (rotationTarget.current.x - globeGroup.rotation.x) * 0.05;
      globeGroup.rotation.y += (rotationTarget.current.y - globeGroup.rotation.y) * 0.05;

      // Pulse rings
      const pulse = Math.sin(time * 6) * 0.5 + 0.5;
      globeGroup.children.forEach(child => {
        if (child.userData?.isPulse && child instanceof THREE.Mesh) {
          child.scale.setScalar(1 + pulse * 0.5);
          (child.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.2;
        }
      });

      // Arc dots
      for (const ad of arcDots) {
        const t = (time * ad.speed) % 1;
        const p = ad.curve.getPoint(t);
        ad.mesh.position.copy(p);
      }

      // Labels always face camera
      for (const sprite of labelSprites) {
        sprite.quaternion.copy(camera.quaternion);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const obs = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    obs.observe(container);

    // Interaction
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      rotationTarget.current.y += dx * 0.005;
      rotationTarget.current.x += dy * 0.005;
      rotationTarget.current.x = Math.max(-1.2, Math.min(1.2, rotationTarget.current.x));
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging.current = false; };

    const canvasEl = renderer.domElement;
    canvasEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      obs.disconnect();
      canvasEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [playing, events]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!container || !camera || !scene) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(mouse, camera);

    const meshes = Array.from(countryMeshes.current.values());
    const intersects = raycaster.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const { code, name } = intersects[0].object.userData;
      setSelectedCountry({
        code, name,
        threats: { critical: 0, high: 0, medium: 0, low: 0 },
        topIocs: [], topEventTypes: [], assetsAffected: 0,
      });
      setDrawerOpen(true);
    }
  }, []);

  if (isLoading) return <Card className="border-border bg-card"><CardContent className="p-6"><Skeleton className="h-[400px] w-full" /></CardContent></Card>;

  return (
    <>
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-primary" />
            Global Threat Intelligence Map
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="my-assets" checked={myAssetsFirst} onCheckedChange={onToggleMyAssets} className="h-4 w-7" />
              <Label htmlFor="my-assets" className="text-xs text-muted-foreground cursor-pointer">My Assets First</Label>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlaying(!playing)}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/threat-map')}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="w-full h-[400px] cursor-grab active:cursor-grabbing"
            onClick={handleClick}
          />
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[480px] bg-card border-border overflow-y-auto">
          {selectedCountry && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground">{selectedCountry.name} ({selectedCountry.code})</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Threats by Severity</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                      <div key={s} className="rounded-lg border border-border bg-secondary/30 p-2 text-center">
                        <p className="text-lg font-mono font-bold text-foreground">{selectedCountry.threats[s]}</p>
                        <p className="text-xs text-muted-foreground capitalize">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedCountry.topIocs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Top IOCs</h4>
                    <div className="space-y-1">
                      {selectedCountry.topIocs.map((ioc, i) => (
                        <code key={i} className="block text-xs font-mono text-foreground bg-secondary/50 rounded px-2 py-1">{ioc}</code>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCountry.assetsAffected > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm text-primary font-medium">{selectedCountry.assetsAffected} of your assets affected</p>
                  </div>
                )}

                {selectedCountry.threats.critical === 0 && selectedCountry.threats.high === 0 && (
                  <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center">
                    <p className="text-sm text-muted-foreground">No threat data for this country yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Enable sources & add assets to start collecting intelligence.</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDrawerOpen(false); navigate(`/investigations`); }}>
                    Investigate
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDrawerOpen(false); navigate(`/alerts`); }}>
                    Create Alert Rule
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
