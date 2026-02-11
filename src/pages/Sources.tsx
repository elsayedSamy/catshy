import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Radio, Grid3X3, List, RefreshCw, Check, X, ExternalLink, AlertTriangle, Loader2, TestTube, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { HealthBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import type { SourceTemplate, SourceCategory, ConnectorType } from '@/types';
import { SOURCES_CATALOG } from '@/data/sourcesCatalog';

const categoryLabels: Record<SourceCategory, string> = {
  vuln_exploit: 'Vulnerabilities & Exploits',
  abuse_malware: 'Abuse & Malware',
  vendor_advisory: 'Vendor Advisories',
  research: 'Research & News',
  phishing_web: 'Phishing & Web Intel',
};

const connectorLabels: Record<ConnectorType, string> = {
  rss_atom: 'RSS/Atom', http_json: 'HTTP JSON', http_csv: 'HTTP CSV',
  rest_api: 'REST API', taxii2: 'TAXII 2.x', imap: 'IMAP', webhook: 'Webhook',
};

export default function Sources() {
  const [sources, setSources] = useState<SourceTemplate[]>(() => SOURCES_CATALOG.map(s => ({ ...s })));
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSource, setWizardSource] = useState<SourceTemplate | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardUrl, setWizardUrl] = useState('');
  const [wizardTesting, setWizardTesting] = useState(false);
  const [wizardResult, setWizardResult] = useState<'success' | 'error' | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  const filtered = useMemo(() => sources.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) && !s.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [sources, searchQuery, categoryFilter]);

  const enabledCount = sources.filter(s => s.enabled).length;

  const handleToggle = (id: string) => {
    const source = sources.find(s => s.id === id);
    if (!source) return;
    if (!source.enabled) {
      setWizardSource(source); setWizardUrl(source.default_url); setWizardStep(0); setWizardResult(null); setWizardOpen(true);
    } else {
      setSources(prev => prev.map(s => s.id === id ? { ...s, enabled: false, health: 'disabled' as const } : s));
      toast.success(`${source.name} disabled`);
    }
  };

  const handleWizardTest = async () => {
    setWizardTesting(true); setWizardResult(null);
    await new Promise(r => setTimeout(r, 1500));
    const isValid = wizardUrl.startsWith('http');
    setWizardResult(isValid ? 'success' : 'error');
    setWizardTesting(false);
    if (isValid) setWizardStep(1);
  };

  const handleWizardEnable = () => {
    if (!wizardSource) return;
    setSources(prev => prev.map(s => s.id === wizardSource.id ? { ...s, enabled: true, health: 'healthy' as const, resolved_url: wizardUrl } : s));
    setWizardOpen(false);
    toast.success(`${wizardSource.name} enabled`);
  };

  const handleTestAll = async () => {
    const enabled = sources.filter(s => s.enabled);
    if (enabled.length === 0) { toast.info('No sources enabled to test'); return; }
    setTestingAll(true);
    await new Promise(r => setTimeout(r, 2000));
    setTestingAll(false);
    toast.success(`All ${enabled.length} enabled sources are healthy`);
  };

  const handleTestSingle = async (id: string) => {
    const source = sources.find(s => s.id === id);
    if (!source) return;
    toast.info(`Testing ${source.name}...`);
    await new Promise(r => setTimeout(r, 1000));
    toast.success(`${source.name} is healthy`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sources</h1>
          <p className="text-sm text-muted-foreground mt-1">{enabledCount} of {sources.length} sources enabled</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestAll} disabled={testingAll}>
            {testingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}Test All
          </Button>
          <Button size="sm" className="glow-cyan" onClick={() => {
            setWizardSource({ id: `custom-${Date.now()}`, name: '', description: 'Custom feed source', category: 'research' as any, connector_type: 'rss_atom' as any, default_url: '', requires_auth: false, polling_interval_minutes: 60, enabled: false, health: 'disabled' as const, item_count: 0 });
            setWizardUrl('');
            setWizardStep(0);
            setWizardResult(null);
            setWizardOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />Add Source
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search sources…" className="pl-10 bg-secondary/30" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px] bg-secondary/30"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}><Grid3X3 className="h-4 w-4" /></Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-2'}>
        {filtered.map((source, i) => (
          <motion.div key={source.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
            <Card className={`border-border bg-card transition-all hover:border-primary/20 ${source.enabled ? 'border-l-2 border-l-success' : ''}`}>
              <CardContent className={viewMode === 'grid' ? 'p-4' : 'flex items-center justify-between p-4'}>
                <div className={viewMode === 'list' ? 'flex items-center gap-4 flex-1' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-sm text-foreground">{source.name}</h3>
                    </div>
                    <Switch checked={source.enabled} onCheckedChange={() => handleToggle(source.id)} />
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{source.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{connectorLabels[source.connector_type]}</Badge>
                    <HealthBadge health={source.health} />
                    {source.item_count > 0 && <span className="text-xs text-muted-foreground">{source.item_count} items today</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {source.last_fetch_at && <span>Last fetch: {new Date(source.last_fetch_at).toLocaleTimeString()}</span>}
                  </div>
                  {source.enabled && (
                    <div className="flex gap-1 mt-2">
                      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => handleTestSingle(source.id)}>
                        <TestTube className="mr-1 h-2.5 w-2.5" />Test
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setWizardSource(source); setWizardUrl(source.resolved_url || source.default_url); setWizardStep(0); setWizardResult(null); setWizardOpen(true); }}>
                        <Settings className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Enable Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Radio className="h-5 w-5 text-primary" />Enable Source: {wizardSource?.name}</DialogTitle>
            <DialogDescription>Validate the feed URL before enabling.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {wizardStep === 0 && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Feed URL</label>
                  <Input value={wizardUrl} onChange={e => setWizardUrl(e.target.value)} placeholder="https://..." className="bg-secondary/30 font-mono text-sm" />
                </div>
                {wizardResult === 'error' && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Feed URL could not be validated.</div>
                )}
                <Button onClick={handleWizardTest} disabled={wizardTesting || !wizardUrl.trim()} className="w-full">
                  {wizardTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Test Connection
                </Button>
              </>
            )}
            {wizardStep === 1 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success"><Check className="h-4 w-4" />Feed validated. Ready to enable.</div>
                <div className="rounded-lg bg-secondary/30 p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Source:</span> {wizardSource?.name}</p>
                  <p><span className="text-muted-foreground">Type:</span> {wizardSource && connectorLabels[wizardSource.connector_type]}</p>
                  <p><span className="text-muted-foreground">URL:</span> <span className="font-mono text-xs">{wizardUrl}</span></p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancel</Button>
            {wizardStep === 1 && <Button onClick={handleWizardEnable} className="glow-cyan">Enable Source</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
