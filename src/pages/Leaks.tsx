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
import { useLeaks } from '@/hooks/useApi';
import type { LeakItem } from '@/types';

export default function Leaks() {
  return (
    <FeatureGate feature="leaks_center" moduleName="Leaks Center" description="Monitor for credential leaks, breach mentions, paste dumps, and brand impersonation using public OSINT sources.">
      <LeaksContent />
    </FeatureGate>
  );
}

function LeaksContent() {
  const [view, setView] = useState<'company' | 'global'>('company');
  const { data: items = [] } = useLeaks();
  const { isEnabled } = useFeatureFlags();
  const { hasRole } = useAuth();
  const torEnabled = isEnabled('leaks_tor');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Leaks Center</h1><p className="text-sm text-muted-foreground mt-1">Monitor for leaked credentials, breach data, and brand mentions</p></div>
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

      {items.length === 0 ? (
        <EmptyState icon="alert" title="No Leak Data Yet" description={view === 'company' ? "No leaks matching your assets have been detected. Add assets and enable leak monitoring sources." : "No public leak data has been ingested yet. Enable leak monitoring sources in the Source Catalog."} actionLabel="Configure Sources" onAction={() => window.location.href = '/sources'} />
      ) : (
        <div className="space-y-2">{items.map((item: LeakItem) => (
          <Card key={item.id} className="border-border bg-card"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={item.severity} />
              <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
              {item.is_tor_source && <Badge className="bg-destructive/20 text-destructive text-xs">TOR Source</Badge>}
            </div>
            <p className="font-medium text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.evidence_excerpt}</p>
            <p className="text-xs text-muted-foreground mt-1">Source: {item.source_name}</p>
          </CardContent></Card>
        ))}</div>
      )}
    </div>
  );
}
