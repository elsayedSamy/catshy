import { useState, useCallback } from 'react';
import { Search as SearchIcon, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { motion } from 'framer-motion';
import { useSearch } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { SeverityLevel, ObservableType, IntelItem, Entity } from '@/types';

interface SearchResult {
  id: string; title: string; severity: SeverityLevel; type: ObservableType;
  value: string; source: string; category: 'intel' | 'entity';
}

const DEMO_DATA: SearchResult[] = [
  { id: '1', title: 'CVE-2024-3400 - PAN-OS Command Injection', severity: 'critical', type: 'cve', value: 'CVE-2024-3400', source: 'CISA KEV', category: 'intel' },
  { id: '2', title: 'CVE-2024-21887 - Ivanti Auth Bypass', severity: 'critical', type: 'cve', value: 'CVE-2024-21887', source: 'NVD', category: 'intel' },
  { id: '3', title: 'Emotet C2 Infrastructure', severity: 'high', type: 'ip', value: '185.244.25.14', source: 'Feodo Tracker', category: 'intel' },
  { id: '4', title: 'LockBit 3.0 Ransomware Group', severity: 'high', type: 'actor', value: 'LockBit 3.0', source: 'The Hacker News', category: 'entity' },
  { id: '5', title: 'Phishing domain - secure-banklogin.com', severity: 'high', type: 'domain', value: 'secure-banklogin.com', source: 'OpenPhish', category: 'intel' },
  { id: '6', title: 'AgentTesla Stealer Distribution URL', severity: 'medium', type: 'url', value: 'https://malicious-downloads.xyz/update.exe', source: 'URLhaus', category: 'intel' },
];

const exampleQueries = [
  'CVE-2024-*', '192.168.0.0/16', 'APT29', 'emotet', 'ransomware',
  'example.com', 'sha256:*', 'cobalt strike',
];

export default function SearchPage() {
  const { isDevMode } = useAuth();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('catshy_recent_searches') || '[]'); }
    catch { return []; }
  });

  const { data, isLoading, isFetching } = useSearch(submittedQuery);

  const handleSearch = useCallback((q?: string) => {
    const searchQuery = (q || query).trim();
    if (!searchQuery) return;
    setQuery(searchQuery);
    setSubmittedQuery(searchQuery);

    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('catshy_recent_searches', JSON.stringify(updated));
  }, [query, recentSearches]);

  // Map API response to unified results
  const results: SearchResult[] = (() => {
    if (isDevMode && submittedQuery) {
      const lower = submittedQuery.toLowerCase();
      return DEMO_DATA.filter(d =>
        d.title.toLowerCase().includes(lower) || d.value.toLowerCase().includes(lower) ||
        d.source.toLowerCase().includes(lower) || d.type.toLowerCase().includes(lower)
      );
    }
    if (!data) return [];
    const items: SearchResult[] = [];
    (data.intel_items || []).forEach((i: IntelItem) => items.push({
      id: i.id, title: i.title, severity: i.severity, type: i.observable_type,
      value: i.observable_value, source: i.source_name, category: 'intel',
    }));
    (data.entities || []).forEach((e: Entity) => items.push({
      id: e.id, title: e.name, severity: 'medium' as SeverityLevel, type: 'actor' as ObservableType,
      value: e.name, source: 'Entity DB', category: 'entity',
    }));
    return items;
  })();

  const hasSearched = !!submittedQuery;
  const searching = isLoading || isFetching;
  const total = isDevMode ? results.length : (data?.total ?? results.length);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Global Search</h1>
        <p className="text-sm text-muted-foreground mt-1">Search across all intelligence data, entities, assets, and indicators</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search IOCs, CVEs, actors, domains, keywords..." className="h-12 pl-12 pr-24 text-base bg-card border-border focus:border-primary" />
        <Button onClick={() => handleSearch()} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9" disabled={searching}>
          {searching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching...</> : 'Search'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {exampleQueries.map(q => (
          <button key={q} onClick={() => handleSearch(q)}
            className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary font-mono">
            {q}
          </button>
        ))}
      </div>

      {!hasSearched && recentSearches.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground"><Clock className="h-4 w-4 text-muted-foreground" />Recent Searches</h3>
            <div className="space-y-1">
              {recentSearches.map((s, i) => (
                <button key={i} onClick={() => handleSearch(s)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <Clock className="h-3 w-3" /><span className="font-mono">{s}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasSearched && !searching && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{total} results for "<span className="text-foreground font-medium">{submittedQuery}</span>"</p>
          {results.map(r => (
            <Card key={r.id} className="border-border bg-card hover:border-primary/20 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={r.severity} />
                    <ObservableTypeBadge type={r.type} />
                    <span className="text-xs text-muted-foreground capitalize">{r.category}</span>
                  </div>
                  <p className="font-medium text-sm text-foreground">{r.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{r.value}</span>
                    <span>via {r.source}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasSearched && searching && (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Searching...</p>
        </div>
      )}

      {hasSearched && !searching && results.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16">
          <SearchIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No results found for "{submittedQuery}".</p>
          <p className="text-xs text-muted-foreground mt-1">Try searching for CVE IDs, IP addresses, domain names, or threat actor names.</p>
        </motion.div>
      )}

      {!hasSearched && recentSearches.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card mb-4">
            <SearchIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Search across all threat intelligence data using IOCs, CVEs, actor names, or keywords.</p>
          <p className="text-xs text-muted-foreground mt-1">Powered by PostgreSQL Full-Text Search (pluggable for OpenSearch)</p>
        </motion.div>
      )}
    </div>
  );
}
