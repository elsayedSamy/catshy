import { X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFilters } from '@/hooks/useFilters';

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  multi?: boolean;
}

interface FilterBarProps {
  filterOptions: FilterOption[];
  showAssetMatchToggle?: boolean;
}

export function FilterBar({ filterOptions, showAssetMatchToggle }: FilterBarProps) {
  const { filters, setFilter, clearFilters, activeFilterCount } = useFilters();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      {filterOptions.map(opt => (
        <Select
          key={opt.key}
          value={(filters as any)[opt.key]?.[0] || ''}
          onValueChange={(v) => setFilter(opt.key, v === 'all' ? undefined : [v])}
        >
          <SelectTrigger className="h-8 w-auto min-w-[120px] border-border bg-secondary/50 text-xs">
            <SelectValue placeholder={opt.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {opt.label}</SelectItem>
            {opt.options.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {showAssetMatchToggle && (
        <Button
          variant={filters.asset_match_only ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setFilter('asset_match', !filters.asset_match_only)}
        >
          Company Match
        </Button>
      )}
      {activeFilterCount > 0 && (
        <>
          <Badge variant="secondary" className="text-xs">{activeFilterCount} active</Badge>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" /> Clear
          </Button>
        </>
      )}
    </div>
  );
}
