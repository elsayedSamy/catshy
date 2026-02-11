import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Pause, Play, Maximize2, RotateCcw, ZoomIn, ZoomOut, Tag } from 'lucide-react';
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

// Priority tiers for label density control
const LABEL_PRIORITY: Record<string, number> = {
  US: 1, CN: 1, RU: 1, GB: 1, DE: 1, FR: 1, IN: 1, BR: 1, JP: 1, AU: 1,
  KR: 2, IR: 2, KP: 2, UA: 2, IL: 2, TR: 2, SA: 2, CA: 2, EG: 2, NG: 2,
  ZA: 2, NL: 2, SE: 2, IT: 2, ES: 2, PK: 2, TW: 2, MX: 2,
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
  const [showLabels, setShowLabels] = useState(true);
  const [labelDensity, setLabelDensity] = useState<'high' | 'medium' | 'low'>('high');
  const [selectedCountry, setSelectedCountry] = useState<CountryDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const animRef = useRef<number>();
  const isDragging = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const rotationTarget = useRef({ x: 0.3, y: 0 });
  const zoomTarget = useRef(5.5);
  const navigate = useNavigate();
  const raycaster = useRef(new THREE.Raycaster());
  const countryMeshes = useRef<Map<string, THREE.Mesh>>(new Map());
  const labelSpritesRef = useRef<{ sprite: THREE.Sprite; worldPos: THREE.Vector3; code: string }[]>([]);

  const handleZoom = useCallback((delta: number) => {
    zoomTarget.current = Math.max(3.5, Math.min(10, zoomTarget.current + delta));
  }, []);

  const handleReset = useCallback(() => {
    rotationTarget.current = { x: 0.3, y: 0 };
    zoomTarget.current = 5.5;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const RADIUS = 2.0;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.z = zoomTarget.current;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0f1a, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const globeGroup = new THREE.Group();
    globeRef.current = globeGroup;
    scene.add(globeGroup);

    // Globe sphere
    const sphereGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x0d1520, transparent: true, opacity: 0.95 });
    globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

    // Wireframe
    const wireGeo = new THREE.SphereGeometry(RADIUS + 0.005, 36, 18);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true, transparent: true, opacity: 0.06 });
    globeGroup.add(new THREE.Mesh(wireGeo, wireMat));

    // Lat/lon lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.08 });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 5) pts.push(latLonToVec3(lat, lon, RADIUS + 0.01));
      globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 5) pts.push(latLonToVec3(lat, lon, RADIUS + 0.01));
      globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }

    // Atmosphere glow
    const glowGeo = new THREE.SphereGeometry(RADIUS * 1.15, 64, 64);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vNormal; void main() { float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1)), 3.0); gl_FragColor = vec4(0.024, 0.714, 0.831, 1.0) * intensity * 0.4; }`,
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true,
    });
    globeGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // Country dots + labels
    const countryMap = new Map<string, THREE.Mesh>();
    const labelEntries: { sprite: THREE.Sprite; worldPos: THREE.Vector3; code: string }[] = [];

    const densityMax = labelDensity === 'high' ? 3 : labelDensity === 'medium' ? 2 : 1;

    for (const [code, data] of Object.entries(COUNTRY_COORDS)) {
      const pos = latLonToVec3(data.lat, data.lon, RADIUS + 0.02);

      // Dot
      const dotGeo = new THREE.SphereGeometry(0.03, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.userData = { code, name: data.name };
      globeGroup.add(dot);
      countryMap.set(code, dot);

      // Pulse ring
      const ringGeo = new THREE.RingGeometry(0.04, 0.06, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.userData = { isPulse: true };
      globeGroup.add(ring);

      // Label sprite - bigger canvas for readability
      const priority = LABEL_PRIORITY[code] ?? 3;
      if (priority > densityMax) continue; // skip based on density

      const canvas = document.createElement('canvas');
      const scale = 2; // for crisp text
      canvas.width = 512 * scale;
      canvas.height = 80 * scale;
      const c = canvas.getContext('2d')!;
      c.scale(scale, scale);
      // Background pill for readability
      c.fillStyle = 'rgba(10, 15, 26, 0.7)';
      c.roundRect(0, 0, 512, 80, 8);
      c.fill();
      // Country code
      c.fillStyle = '#06b6d4';
      c.font = 'bold 32px "JetBrains Mono", monospace';
      c.fillText(code, 12, 36);
      // Country name
      c.fillStyle = '#94a3b8';
      c.font = '22px "Inter", sans-serif';
      c.fillText(data.name, 12, 64);

      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(spriteMat);
      const labelPos = pos.clone().normalize().multiplyScalar(RADIUS + 0.18);
      sprite.position.copy(labelPos);
      sprite.scale.set(0.7, 0.11, 1);
      sprite.userData = { isLabel: true, code };
      globeGroup.add(sprite);
      labelEntries.push({ sprite, worldPos: labelPos.clone(), code });
    }
    countryMeshes.current = countryMap;
    labelSpritesRef.current = labelEntries;

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
      arcGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.3 })));
      const dotGeo = new THREE.SphereGeometry(0.025, 6, 6);
      const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: col }));
      arcGroup.add(dot);
      arcDots.push({ curve, mesh: dot, speed: 0.3 + Math.random() * 0.2 });
    }

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(3000);
    for (let i = 0; i < 3000; i++) starPositions[i] = (Math.random() - 0.5) * 40;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x334155, size: 0.03 })));

    // Animation
    let time = 0;
    const camDir = new THREE.Vector3();

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      if (playing) {
        time += 0.005;
        if (!isDragging.current) rotationTarget.current.y += 0.001;
      }

      globeGroup.rotation.x += (rotationTarget.current.x - globeGroup.rotation.x) * 0.05;
      globeGroup.rotation.y += (rotationTarget.current.y - globeGroup.rotation.y) * 0.05;

      // Smooth zoom
      camera.position.z += (zoomTarget.current - camera.position.z) * 0.08;

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
        ad.mesh.position.copy(ad.curve.getPoint(t));
      }

      // Label occlusion: hide labels on back side of globe
      camera.getWorldDirection(camDir);
      for (const entry of labelEntries) {
        if (!showLabels) {
          entry.sprite.visible = false;
          continue;
        }
        // Get world position of label after globe rotation
        const worldPos = entry.sprite.getWorldPosition(new THREE.Vector3());
        const toLabel = worldPos.clone().sub(camera.position).normalize();
        const dotProduct = toLabel.dot(camDir);
        // Also check if the label's surface normal faces camera
        const surfaceNormal = worldPos.clone().normalize();
        const cameraPos = camera.position.clone().normalize();
        const facing = surfaceNormal.dot(cameraPos);

        if (facing > 0.05) {
          entry.sprite.visible = true;
          // Fade based on angle - more facing = more opaque
          const opacity = Math.min(1, Math.max(0.15, facing * 1.5));
          (entry.sprite.material as THREE.SpriteMaterial).opacity = opacity;
        } else {
          entry.sprite.visible = false;
        }

        // Always face camera
        entry.sprite.quaternion.copy(camera.quaternion);
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

    // Mouse interaction
    const onMouseDown = (e: MouseEvent) => { isDragging.current = true; prevMouse.current = { x: e.clientX, y: e.clientY }; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      rotationTarget.current.y += dx * 0.005;
      rotationTarget.current.x = Math.max(-1.2, Math.min(1.2, rotationTarget.current.x + dy * 0.005));
      prevMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { isDragging.current = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTarget.current = Math.max(3.5, Math.min(10, zoomTarget.current + e.deltaY * 0.005));
    };

    const canvasEl = renderer.domElement;
    canvasEl.addEventListener('mousedown', onMouseDown);
    canvasEl.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      obs.disconnect();
      canvasEl.removeEventListener('mousedown', onMouseDown);
      canvasEl.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [playing, events, showLabels, labelDensity]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

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

  if (isLoading) return <Card className="border-border bg-card"><CardContent className="p-6"><Skeleton className="h-[500px] w-full" /></CardContent></Card>;

  return (
    <>
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-primary" />
            Global Threat Intelligence Map
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Label density */}
            <div className="flex items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <Select value={labelDensity} onValueChange={(v) => setLabelDensity(v as 'high' | 'medium' | 'low')}>
                <SelectTrigger className="h-7 w-[80px] text-[10px] bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">All</SelectItem>
                  <SelectItem value="medium">Major</SelectItem>
                  <SelectItem value="low">Top 10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Toggle labels */}
            <div className="flex items-center gap-1.5">
              <Switch id="labels-toggle" checked={showLabels} onCheckedChange={setShowLabels} className="h-4 w-7" />
              <Label htmlFor="labels-toggle" className="text-[10px] text-muted-foreground cursor-pointer">Labels</Label>
            </div>
            {/* My assets */}
            <div className="flex items-center gap-1.5">
              <Switch id="my-assets" checked={myAssetsFirst} onCheckedChange={onToggleMyAssets} className="h-4 w-7" />
              <Label htmlFor="my-assets" className="text-[10px] text-muted-foreground cursor-pointer">My Assets</Label>
            </div>
            <div className="flex items-center gap-0.5 border-l border-border pl-2 ml-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleZoom(-0.5)} title="Zoom in">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleZoom(0.5)} title="Zoom out">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Reset view">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlaying(!playing)} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/threat-map')} title="Full screen">
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="w-full h-[550px] cursor-grab active:cursor-grabbing"
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
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDrawerOpen(false); navigate('/investigations'); }}>Investigate</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDrawerOpen(false); navigate('/alerts'); }}>Create Alert Rule</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
