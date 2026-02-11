import { useState } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { SeverityBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Globe, Shield, Lock } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/contexts/AuthContext';
import type { LeakItem, LeakType, SeverityLevel } from '@/types';

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
    <FeatureGate feature="leaks_center" moduleName="Leaks Center" description="Monitor for credential leaks, breach mentions, paste dumps, and brand impersonation using public OSINT sources.">
      <LeaksContent />
    </FeatureGate>
  );
}

function LeaksContent() {
  const [view, setView] = useState<'company' | 'global'>('company');
  const [items] = useState<LeakItem[]>(DEMO_LEAKS);
  const { isEnabled } = useFeatureFlags();
  const { hasRole } = useAuth();
  const torEnabled = isEnabled('leaks_tor');

  const displayItems = view === 'company' ? items.filter(i => i.matched_assets.length > 0) : items;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Leaks Center</h1><p className="text-sm text-muted-foreground mt-1">{items.length} leak items detected</p></div>
        <div className="flex gap-2">
          <Button variant={view === 'company' ? 'default' : 'outline'} size="sm" onClick={() => setView('company')}><Building2 className="mr-2 h-4 w-4" />Company First</Button>
          <Button variant={view === 'global' ? 'default' : 'outline'} size="sm" onClick={() => setView('global')}><Globe className="mr-2 h-4 w-4" />Global</Button>
        </div>
      </div>

      <FilterBar filterOptions={[
        { key: 'severity', label: 'Severity', options: [{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }] },
        { key: 'leak_type', label: 'Type', options: [{ value: 'credential', label: 'Credential' }, { value: 'paste', label: 'Paste' }, { value: 'breach', label: 'Breach' }, { value: 'brand_mention', label: 'Brand' }, { value: 'typosquat', label: 'Typosquat' }] },
      ]} showAssetMatchToggle />

      <Card className="border-border bg-secondary/20">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm font-medium">Strict Mode: Public Sources Only</p>
              <p className="text-xs text-muted-foreground">Only legal, public OSINT sources are active. TOR/dark web connectors are {torEnabled ? 'enabled' : 'disabled'}.</p>
            </div>
          </div>
          {!torEnabled && hasRole(['admin']) && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => window.location.href = '/admin'}><Lock className="mr-1 h-3 w-3" />Enable TOR (Admin)</Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">{displayItems.map((item: LeakItem) => (
        <Card key={item.id} className={`border-border bg-card ${item.matched_assets.length > 0 ? 'border-l-2 border-l-destructive' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={item.severity} />
              <Badge variant="outline" className="text-xs capitalize">{item.type.replace('_', ' ')}</Badge>
              {item.is_tor_source && <Badge className="bg-destructive/20 text-destructive text-xs">TOR Source</Badge>}
              {item.matched_assets.length > 0 && <Badge className="bg-primary/20 text-primary text-xs">Asset Match</Badge>}
            </div>
            <p className="font-medium text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            <div className="mt-2 rounded bg-secondary/30 p-2">
              <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{item.evidence_excerpt}</p>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>Source: {item.source_name}</span>
              <span>{new Date(item.discovered_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}</div>
    </div>
  );
}