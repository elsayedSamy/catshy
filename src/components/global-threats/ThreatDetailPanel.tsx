/**
 * ThreatDetailPanel — Premium right-side intelligence panel with animated entry,
 * severity-themed header, confidence gauge, MITRE badges, and rich actions.
 */
import { useEffect, useRef } from 'react';
import {
  X, MapPin, Shield, Zap, Link2, ExternalLink,
  AlertTriangle, FileDown, Copy, Globe, Clock, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS } from './types';
import { toast } from 'sonner';

function Row({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="flex justify-between items-start gap-2 group">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-[11px] text-foreground text-right break-all ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
        {copyable && (
          <button onClick={handleCopy} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Copy className="h-2.5 w-2.5 text-muted-foreground hover:text-primary" />
          </button>
        )}
      </div>
    </div>
  );
}

function ConfidenceGauge({ value }: { value: number }) {
  const color = value >= 80 ? SEVERITY_COLORS.critical : value >= 60 ? SEVERITY_COLORS.high : value >= 40 ? SEVERITY_COLORS.medium : SEVERITY_COLORS.low;
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <svg width="44" height="44" className="transform -rotate-90">
        <circle cx="22" cy="22" r="18" fill="none" stroke="hsl(var(--border))" strokeWidth="3" opacity="0.3" />
        <circle
          cx="22" cy="22" r="18" fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
        />
      </svg>
      <div>
        <div className="text-lg font-mono font-bold text-foreground leading-none">{value}%</div>
        <div className="text-[9px] font-mono text-muted-foreground uppercase">confidence</div>
      </div>
    </div>
  );
}

function SeverityHeader({ severity, score }: { severity: string; score: number }) {
  const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '#888';

  return (
    <div
      className="px-4 py-2.5 flex items-center gap-3"
      style={{
        background: `linear-gradient(90deg, ${color}15, transparent)`,
        borderBottom: `1px solid ${color}30`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{
          backgroundColor: `${color}20`,
          boxShadow: `0 0 12px ${color}30`,
        }}
      >
        <AlertTriangle className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color }}>
          {severity} SEVERITY
        </div>
        <div className="text-[9px] font-mono text-muted-foreground">
          Score: {score}/100
        </div>
      </div>
      <div className="ml-auto flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-6 rounded-sm transition-all"
            style={{
              backgroundColor: i < (severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1)
                ? color
                : `${color}15`,
              boxShadow: i < (severity === 'critical' ? 4 : severity === 'high' ? 3 : 2)
                ? `0 0 4px ${color}40`
                : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ThreatDetailPanel() {
  const { selectedEvent: e, setSelectedEvent } = useThreatContext();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.transform = 'translateX(100%)';
      panelRef.current.style.opacity = '0';
      requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.style.transition = 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease';
          panelRef.current.style.transform = 'translateX(0)';
          panelRef.current.style.opacity = '1';
        }
      });
    }
  }, [e?.id]);

  if (!e) return null;

  const sevColor = SEVERITY_COLORS[e.severity];
  const timeAgo = (() => {
    const diff = Date.now() - new Date(e.timestamp).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  })();

  return (
    <div
      ref={panelRef}
      className="w-[380px] border-l border-border bg-card/95 backdrop-blur-xl flex flex-col h-full shrink-0"
      style={{ borderLeftColor: `${sevColor}30` }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: sevColor, boxShadow: `0 0 8px ${sevColor}` }}
          />
          <span className="text-sm font-semibold truncate">{CATEGORY_LABELS[e.category]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />{timeAgo}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSelectedEvent(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <SeverityHeader severity={e.severity} score={e.severity_score} />

      <ScrollArea className="flex-1">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-transparent px-4 pt-1 h-9">
            <TabsTrigger value="summary" className="text-[10px] px-2.5">Summary</TabsTrigger>
            <TabsTrigger value="geo" className="text-[10px] px-2.5">Geo</TabsTrigger>
            <TabsTrigger value="iocs" className="text-[10px] px-2.5">IOCs</TabsTrigger>
            <TabsTrigger value="enrichment" className="text-[10px] px-2.5">Enrichment</TabsTrigger>
            <TabsTrigger value="actions" className="text-[10px] px-2.5">Actions</TabsTrigger>
          </TabsList>

          {/* ── Summary ── */}
          <TabsContent value="summary" className="px-4 py-3 space-y-3">
            <ConfidenceGauge value={e.confidence} />

            <div className="space-y-1.5">
              <Row label="Event ID" value={e.id.slice(0, 12) + '…'} mono copyable />
              <Row label="Timestamp" value={new Date(e.timestamp).toLocaleString()} />
              <Row label="Category" value={CATEGORY_LABELS[e.category]} />
              <Row label="Source Type" value={e.source_type.replace(/_/g, ' ').toUpperCase()} />
            </div>

            {e.mitre && (
              <>
                <Separator className="my-2" />
                <div className="space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono flex items-center gap-1">
                    <Shield className="h-3 w-3 text-primary" /> MITRE ATT&CK
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono border-primary/30 bg-primary/5"
                    >
                      {e.mitre.tactic}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono border-destructive/30 bg-destructive/5"
                    >
                      {e.mitre.technique_id}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{e.mitre.technique_name}</p>
                </div>
              </>
            )}

            {e.campaign_id && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                <Target className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-mono text-primary">{e.campaign_id}</span>
              </div>
            )}

            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {e.tags.map(t => (
                  <Badge key={t} variant="outline" className="text-[9px] bg-accent/5">{t}</Badge>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Geo ── */}
          <TabsContent value="geo" className="px-4 py-3 space-y-3">
            {[
              { label: 'Source', icon: Globe, data: e.source, color: sevColor },
              { label: 'Target', icon: MapPin, data: e.target, color: '#00e5ff' },
            ].map(({ label, icon: Icon, data, color }) => (
              <div key={label} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Icon className="h-3 w-3" style={{ color }} /> {label}
                </p>
                <div
                  className="rounded-lg p-2.5 space-y-1 border"
                  style={{ borderColor: `${color}20`, backgroundColor: `${color}05` }}
                >
                  <Row label="IP" value={data.ip} mono copyable />
                  <Row label="Port" value={String(data.port || '—')} />
                  <Row label="Location" value={`${data.city}, ${data.country}`} />
                  <Row label="Coords" value={`${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}`} />
                  {data.asn && <Row label="ASN" value={data.asn} />}
                  {data.org && <Row label="Org" value={data.org} />}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* ── IOCs ── */}
          <TabsContent value="iocs" className="px-4 py-3 space-y-2">
            {[
              { label: 'Domain', value: e.indicators.domain },
              { label: 'URL', value: e.indicators.url },
              { label: 'Hash', value: e.indicators.hash, mono: true },
              { label: 'CVE', value: e.indicators.cve },
              { label: 'User Agent', value: e.indicators.user_agent },
              { label: 'Port', value: e.indicators.port ? String(e.indicators.port) : undefined },
              { label: 'Protocol', value: e.indicators.protocol },
            ].filter(item => item.value).map(item => (
              <Row key={item.label} label={item.label} value={item.value!} mono={item.mono} copyable />
            ))}
            {!e.indicators.domain && !e.indicators.url && !e.indicators.hash && !e.indicators.cve && (
              <p className="text-xs text-muted-foreground italic">No indicators extracted.</p>
            )}
          </TabsContent>

          {/* ── Enrichment ── */}
          <TabsContent value="enrichment" className="px-4 py-3 space-y-2">
            {e.enrichment && Object.keys(e.enrichment).length > 0 ? (
              Object.entries(e.enrichment).map(([k, v]) => (
                <Row key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
              ))
            ) : (
              <p className="text-xs text-muted-foreground italic">No enrichment data available.</p>
            )}
          </TabsContent>

          {/* ── Actions ── */}
          <TabsContent value="actions" className="px-4 py-3 space-y-2">
            {[
              { icon: AlertTriangle, label: 'Create Alert Rule', variant: 'destructive' as const },
              { icon: Shield, label: 'Create Case', variant: 'outline' as const },
              { icon: Zap, label: 'Start Investigation', variant: 'outline' as const },
              { icon: Link2, label: 'View in Graph Explorer', variant: 'outline' as const },
            ].map(({ icon: Icon, label, variant }) => (
              <Button key={label} variant={variant === 'destructive' ? 'outline' : 'outline'} size="sm" className={`w-full text-xs justify-start gap-2 ${
                variant === 'destructive' ? 'border-destructive/30 text-destructive hover:bg-destructive/10' : ''
              }`}>
                <Icon className="h-3 w-3" /> {label}
              </Button>
            ))}
            <Separator className="my-1" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5">
                <FileDown className="h-3 w-3" /> JSON
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5">
                <ExternalLink className="h-3 w-3" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5">
                <Copy className="h-3 w-3" /> STIX
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
