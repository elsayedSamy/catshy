import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rss, ExternalLink, Building2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { IntelItem } from '@/types';

const severityOptions = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

const typeOptions = [
  { value: 'ip', label: 'IP' },
  { value: 'domain', label: 'Domain' },
  { value: 'url', label: 'URL' },
  { value: 'hash_sha256', label: 'Hash' },
  { value: 'cve', label: 'CVE' },
  { value: 'email', label: 'Email' },
];

export default function Feed() {
  const navigate = useNavigate();
  const [items] = useState<IntelItem[]>([]);
  const [companyFirst, setCompanyFirst] = useState(false);

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Intel Feed</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time threat intelligence from enabled sources</p>
          </div>
          <div className="flex gap-2">
            <Button variant={companyFirst ? 'default' : 'outline'} size="sm" onClick={() => setCompanyFirst(!companyFirst)}>
              <Building2 className="mr-2 h-4 w-4" />
              Company First
            </Button>
          </div>
        </div>
        <FilterBar
          filterOptions={[
            { key: 'severity', label: 'Severity', options: severityOptions },
            { key: 'type', label: 'Type', options: typeOptions },
          ]}
          showAssetMatchToggle
        />
        <EmptyState
          icon="radio"
          title="No Intelligence Data Yet"
          description="Enable sources in the Source Catalog to begin collecting threat intelligence. Items will appear here automatically after the first fetch."
          actionLabel="Enable Sources"
          onAction={() => navigate('/sources')}
          secondaryLabel="Add Assets First"
          onSecondary={() => navigate('/assets')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intel Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} items from enabled sources</p>
        </div>
        <div className="flex gap-2">
          <Button variant={companyFirst ? 'default' : 'outline'} size="sm" onClick={() => setCompanyFirst(!companyFirst)}>
            <Building2 className="mr-2 h-4 w-4" /> Company First
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>
      <FilterBar
        filterOptions={[
          { key: 'severity', label: 'Severity', options: severityOptions },
          { key: 'type', label: 'Type', options: typeOptions },
        ]}
        showAssetMatchToggle
      />
      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.id} className={`border-border bg-card transition-all hover:border-primary/20 ${item.asset_match ? 'border-l-2 border-l-primary' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={item.severity} />
                    <ObservableTypeBadge type={item.observable_type} />
                    {item.asset_match && <Badge className="bg-primary/20 text-primary text-xs">Asset Match</Badge>}
                    {item.dedup_count > 1 && <Badge variant="outline" className="text-xs">×{item.dedup_count}</Badge>}
                  </div>
                  <h3 className="font-medium text-sm text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{item.observable_value}</span>
                    <span>via {item.source_name}</span>
                    <span>{new Date(item.published_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                  <a href={item.original_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
