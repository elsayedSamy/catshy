import { useState, useMemo } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Globe, Shield, Lock, RefreshCw, FileDown, Search, ExternalLink, Eye, ShieldAlert, Key, AtSign, Server, Skull } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { LeakItem, SeverityLevel } from '@/types';

const LEAK_CATEGORIES = [
  { key: 'credential', label: 'Org Credential Exposure', icon: Key, color: 'text-destructive' },
  { key: 'brand_mention', label: 'Org Brand Mentions', icon: AtSign, color: 'text-primary' },
  { key: 'typosquat', label: 'Org Asset Mentions', icon: Server, color: 'text-warning' },
  { key: 'breach', label: 'Data Breach Watch', icon: ShieldAlert, color: 'text-info' },
  { key: 'code_leak', label: 'Ransomware Watch', icon: Skull, color: 'text-destructive' },
  { key: 'paste', label: 'Paste Monitor', icon: Globe, color: 'text-muted-foreground' },
];

const DEMO_LEAKS: LeakItem[] = [
  { id: 'l1', type: 'credential', title: 'Credential leak on paste site — 12 company emails found', description: 'Multiple email:password pairs for company domain found in public paste.', severity: 'critical' as SeverityLevel, source_name: 'Paste Monitor', source_url: 'https://pastebin.com', discovered_at: new Date().toISOString(), matched_assets: ['company.com'], evidence_excerpt: 'john@company.com:P@ssw0rd123\nmary@company.com:Welcome2024!', provenance: 'Public paste site', is_tor_source: false },
  { id: 'l2', type: 'breach', title: 'Company domain found in BreachForums dump', description: '450 records from company domain found in recent breach compilation.', severity: 'high' as SeverityLevel, source_name: 'HIBP', source_url: 'https://haveibeenpwned.com', discovered_at: new Date(Date.now() - 86400000).toISOString(), matched_assets: ['company.com'], evidence_excerpt: 'Breach: "MegaCorp 2024" — 450 records matching company.com domain.', provenance: 'Have I Been Pwned API', is_tor_source: false },
  { id: 'l3', type: 'typosquat', title: 'Typosquatting domain registered: c0mpany.com', description: 'Suspicious domain registered mimicking company brand with character substitution.', severity: 'high' as SeverityLevel, source_name: 'Domain Monitor', source_url: '', discovered_at: new Date(Date.now() - 172800000).toISOString(), matched_assets: ['company.com'], evidence_excerpt: 'c0mpany.com registered 2 days ago, A record: 104.21.33.12, SSL cert issued by Let\'s Encrypt.', provenance: 'DNS monitoring', is_tor_source: false },
  { id: 'l4', type: 'brand_mention', title: 'Brand impersonation on social media', description: 'Fake customer support account created on Twitter using company logo and name.', severity: 'medium' as SeverityLevel, source_name: 'Brand Monitor', source_url: '', discovered_at: new Date(Date.now() - 259200000).toISOString(), matched_assets: ['Company Brand'], evidence_excerpt: '@CompanyHelpDesk — "Contact us for support" — Account created 3 days ago.', provenance: 'Social media monitoring', is_tor_source: false },
  { id: 'l5', type: 'code_leak', title: 'Internal API keys found in public GitHub repo', description: 'AWS access keys and internal API tokens found in public repository.', severity: 'critical' as SeverityLevel, source_name: 'GitHub Monitor', source_url: 'https://github.com', discovered_at: new Date(Date.now() - 345600000).toISOString(), matched_assets: ['company.com'], evidence_excerpt: 'AKIA...EXAMPLE found in config.yaml, repo: user/internal-tools, pushed 4 days ago.', provenance: 'GitHub code search', is_tor_source: false },
  { id: 'l6', type: 'paste', title: 'Company internal docs shared on paste site', description: 'Internal network diagram and credentials shared publicly.', severity: 'medium' as SeverityLevel, source_name: 'Paste Monitor', source_url: '', discovered_at: new Date(Date.now() - 432000000).toISOString(), matched_assets: [], evidence_excerpt: 'Network diagram mentioning internal subnets and server names.', provenance: 'Public paste monitoring', is_tor_source: false },
];

export default function Leaks() {
  return (
    <FeatureGate feature="leaks_center" moduleName="Leak Hub" description="Monitor for credential leaks, breach mentions, paste dumps, and brand impersonation using public OSINT sources.">
      <LeaksContent />
    </FeatureGate>
  );
}

function LeaksContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [items] = useState<LeakItem[]>(DEMO_LEAKS);
  const [selectedItem, setSelectedItem] = useState<LeakItem | null>(null);
  const { isEnabled, setFlag } = useFeatureFlags();
  const { hasRole } = useAuth();
  const torEnabled = isEnabled('leaks_tor');
  const [showTorWarning, setShowTorWarning] = useState(false);

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    return result;
  }, [items, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    LEAK_CATEGORIES.forEach(c => { counts[c.key] = items.filter(i => i.type === c.key).length; });
    return counts;
  }, [items]);

  const handleRefresh = () => toast.success('Leak data refreshed (Dev Mode)');
  const handleExport = () => {
    const csv = ['Title,Severity,Type,Source,Discovered,Matched Assets'].concat(
      items.map(i => `"${i.title}",${i.severity},${i.type},${i.source_name},${i.discovered_at},"${i.matched_assets.join('; ')}"`)
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'catshy-leaks-report.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Leak report exported — ${items.length} items`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leak Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor credential leaks, breaches, and brand threats</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Generate Report</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {LEAK_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <Card key={cat.key} className="border-border bg-card">
              <CardContent className="p-3 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${cat.color}`} />
                <p className="text-2xl font-bold text-foreground">{categoryCounts[cat.key] || 0}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-1">{cat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search leaks, organizations…" className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
      </div>

      {/* TOR notice */}
      <Card className={`border-border ${torEnabled ? 'bg-destructive/10 border-destructive/30' : 'bg-secondary/20'}`}>
        <CardContent className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <Shield className={`h-5 w-5 ${torEnabled ? 'text-destructive' : 'text-success'}`} />
            <div>
              <p className="text-xs font-medium">{torEnabled ? '⚠ TOR/Dark Web Sources Active' : 'Public Sources Only'}</p>
              <p className="text-[10px] text-muted-foreground">TOR/dark web connectors are {torEnabled ? 'enabled — use with caution' : 'disabled'}.</p>
            </div>
          </div>
          {hasRole(['system_owner']) && (
            torEnabled ? (
              <Button variant="destructive" size="sm" className="text-xs" onClick={() => { setFlag('leaks_tor', false); toast.success('TOR sources disabled'); }}>
                <Lock className="mr-1 h-3 w-3" />Disable TOR
              </Button>
            ) : showTorWarning ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-destructive font-medium">⚠ This enables dark web scanning</span>
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => { setFlag('leaks_tor', true); toast.success('TOR sources enabled'); }}>
                  Confirm Enable
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowTorWarning(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowTorWarning(true)}>
                <Lock className="mr-1 h-3 w-3" />Enable TOR
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Two-column leak cards */}
      {filtered.length === 0 ? (
        <EmptyState icon="alert" title="No Leaks Detected" description="Configure leak monitoring sources to detect credential exposures and brand threats." actionLabel="Configure Sources" onAction={() => window.location.href = '/sources'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(item => {
            const confidence = item.type === 'credential' ? 95 : item.type === 'breach' ? 88 : item.type === 'typosquat' ? 82 : 70;
            return (
              <Card key={item.id} className={`border-border bg-card hover:border-primary/20 transition-all ${item.matched_assets.length > 0 ? 'border-l-2 border-l-destructive' : ''}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={item.severity} />
                      <Badge variant="outline" className="text-[10px] capitalize">{item.type.replace('_', ' ')}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{item.source_name} • {new Date(item.discovered_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2">{item.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Confidence</span><span>{confidence}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${confidence}%` }} />
                    </div>
                  </div>
                  {item.matched_assets.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {item.matched_assets.map(a => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs h-7 flex-1" onClick={() => setSelectedItem(item)}><Eye className="mr-1 h-3 w-3" />View Details</Button>
                    {item.source_url && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>{selectedItem?.title}</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selectedItem.severity} />
                <Badge variant="outline" className="text-xs capitalize">{selectedItem.type.replace('_', ' ')}</Badge>
              </div>
              <p className="text-sm text-foreground">{selectedItem.description}</p>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Evidence</p>
                <pre className="text-xs font-mono bg-secondary/30 p-3 rounded-lg whitespace-pre-wrap text-foreground">{selectedItem.evidence_excerpt}</pre>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Source</span><p className="font-medium">{selectedItem.source_name}</p></div>
                <div><span className="text-muted-foreground">Provenance</span><p className="font-medium">{selectedItem.provenance}</p></div>
                <div><span className="text-muted-foreground">Discovered</span><p className="font-medium">{new Date(selectedItem.discovered_at).toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Matched Assets</span><p className="font-medium">{selectedItem.matched_assets.join(', ') || 'None'}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
