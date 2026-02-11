import { useState } from 'react';
import { Search as SearchIcon, Clock, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { SeverityBadge, ObservableTypeBadge } from '@/components/StatusBadge';
import { motion } from 'framer-motion';

const exampleQueries = [
  'CVE-2024-*', '192.168.0.0/16', 'APT29', 'emotet', 'ransomware',
  'example.com', 'sha256:*', 'cobalt strike',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results] = useState<any[]>([]);
  const [recentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('catshy_recent_searches') || '[]');
    } catch { return []; }
  });
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setHasSearched(true);
    // In production, this calls the backend search API
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
    localStorage.setItem('catshy_recent_searches', JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Global Search</h1>
        <p className="text-sm text-muted-foreground mt-1">Search across all intelligence data, entities, assets, and indicators</p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search IOCs, CVEs, actors, domains, keywords..."
          className="h-12 pl-12 pr-24 text-base bg-card border-border focus:border-primary"
        />
        <Button onClick={() => handleSearch()} className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9">
          Search
        </Button>
      </div>

      {/* Quick search chips */}
      <div className="flex flex-wrap gap-2">
        {exampleQueries.map(q => (
          <button
            key={q}
            onClick={() => handleSearch(q)}
            className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary font-mono"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Recent searches */}
      {!hasSearched && recentSearches.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <h3 className="flex items-center gap-2 mb-3 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Searches
            </h3>
            <div className="space-y-1">
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(s)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Clock className="h-3 w-3" />
                  <span className="font-mono">{s}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search results or empty state */}
      {hasSearched && results.length === 0 && (
        <EmptyState
          icon="search"
          title="No Results Found"
          description={`No intelligence data matches "${query}". Results will appear once sources are enabled and data is ingested.`}
          actionLabel="Enable Sources"
          onAction={() => window.location.href = '/sources'}
        />
      )}

      {!hasSearched && recentSearches.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center py-16"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card mb-4">
            <SearchIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Search across all threat intelligence data using IOCs, CVEs, actor names, or keywords.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Powered by PostgreSQL Full-Text Search (pluggable for OpenSearch)
          </p>
        </motion.div>
      )}
    </div>
  );
}
