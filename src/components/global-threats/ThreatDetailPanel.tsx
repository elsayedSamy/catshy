/**
 * ThreatDetailPanel — right-side intelligence panel.
 *
 * Tabs: Summary, Geo, IOCs, Enrichment, Actions
 */
import { X, MapPin, Shield, Zap, Link2, ExternalLink, AlertTriangle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useThreatContext } from './ThreatContext';
import { SEVERITY_COLORS, CATEGORY_LABELS } from './types';

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className={`text-[11px] text-foreground text-right break-all ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function ThreatDetailPanel() {
  const { selectedEvent: e, setSelectedEvent } = useThreatContext();
  if (!e) return null;

  return (
    <div className="w-[370px] border-l border-border bg-card/95 backdrop-blur-sm flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: SEVERITY_COLORS[e.severity] }}
          />
          <span className="text-sm font-semibold truncate">{CATEGORY_LABELS[e.category]}</span>
          <Badge
            variant={e.severity === 'critical' ? 'destructive' : 'secondary'}
            className="text-[10px] shrink-0"
          >
            {e.severity.toUpperCase()}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedEvent(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4 pt-1">
            <TabsTrigger value="summary" className="text-[11px]">Summary</TabsTrigger>
            <TabsTrigger value="geo" className="text-[11px]">Geo</TabsTrigger>
            <TabsTrigger value="iocs" className="text-[11px]">IOCs</TabsTrigger>
            <TabsTrigger value="enrichment" className="text-[11px]">Enrichment</TabsTrigger>
            <TabsTrigger value="actions" className="text-[11px]">Actions</TabsTrigger>
          </TabsList>

          {/* ── Summary ── */}
          <TabsContent value="summary" className="px-4 py-3 space-y-2">
            <Row label="Event ID" value={e.id} mono />
            <Row label="Timestamp" value={new Date(e.timestamp).toLocaleString()} />
            <Row label="Severity" value={`${e.severity} · score ${e.severity_score}`} />
            <Row label="Confidence" value={`${e.confidence}%`} />
            <Row label="Category" value={CATEGORY_LABELS[e.category]} />
            <Row label="Source Type" value={e.source_type.replace(/_/g, ' ').toUpperCase()} />
            {e.mitre && (
              <>
                <Separator className="my-2" />
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">MITRE ATT&CK</p>
                <Row label="Tactic" value={e.mitre.tactic} />
                <Row label="Technique" value={`${e.mitre.technique_id} – ${e.mitre.technique_name}`} />
              </>
            )}
            {e.campaign_id && <Row label="Campaign" value={e.campaign_id} />}
            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {e.tags.map(t => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Geo ── */}
          <TabsContent value="geo" className="px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Source
            </p>
            <Row label="IP" value={e.source.ip} mono />
            <Row label="Port" value={String(e.source.port || '—')} />
            <Row label="Location" value={`${e.source.city}, ${e.source.country}`} />
            <Row label="Coords" value={`${e.source.lat.toFixed(2)}, ${e.source.lon.toFixed(2)}`} />
            {e.source.asn && <Row label="ASN" value={e.source.asn} />}
            {e.source.org && <Row label="Org" value={e.source.org} />}

            <Separator className="my-2" />

            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Target
            </p>
            <Row label="IP" value={e.target.ip} mono />
            <Row label="Port" value={String(e.target.port || '—')} />
            <Row label="Location" value={`${e.target.city}, ${e.target.country}`} />
            <Row label="Coords" value={`${e.target.lat.toFixed(2)}, ${e.target.lon.toFixed(2)}`} />
            {e.target.asn && <Row label="ASN" value={e.target.asn} />}
            {e.target.org && <Row label="Org" value={e.target.org} />}
          </TabsContent>

          {/* ── IOCs ── */}
          <TabsContent value="iocs" className="px-4 py-3 space-y-2">
            {e.indicators.domain && <Row label="Domain" value={e.indicators.domain} />}
            {e.indicators.url && <Row label="URL" value={e.indicators.url} />}
            {e.indicators.hash && <Row label="Hash" value={e.indicators.hash} mono />}
            {e.indicators.cve && <Row label="CVE" value={e.indicators.cve} />}
            {e.indicators.user_agent && <Row label="User Agent" value={e.indicators.user_agent} />}
            {e.indicators.port && <Row label="Port" value={String(e.indicators.port)} />}
            {e.indicators.protocol && <Row label="Protocol" value={e.indicators.protocol} />}
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
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
              <AlertTriangle className="h-3 w-3" /> Create Alert Rule
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
              <Shield className="h-3 w-3" /> Create Case
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
              <Zap className="h-3 w-3" /> Start Investigation
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
              <Link2 className="h-3 w-3" /> View in Graph Explorer
            </Button>
            <Separator className="my-1" />
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
              <FileDown className="h-3 w-3" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2">
              <ExternalLink className="h-3 w-3" /> Export CSV
            </Button>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
