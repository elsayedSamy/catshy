import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FilterState } from '@/types';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterState = useMemo(() => {
    const f: FilterState = {};
    const severity = searchParams.getAll('severity');
    if (severity.length) f.severity = severity as any;
    const source = searchParams.getAll('source');
    if (source.length) f.source_id = source;
    const obsType = searchParams.getAll('type');
    if (obsType.length) f.observable_type = obsType as any;
    const dateFrom = searchParams.get('from');
    if (dateFrom) f.date_from = dateFrom;
    const dateTo = searchParams.get('to');
    if (dateTo) f.date_to = dateTo;
    const assetMatch = searchParams.get('asset_match');
    if (assetMatch === 'true') f.asset_match_only = true;
    const q = searchParams.get('q');
    if (q) f.search_query = q;
    const status = searchParams.getAll('status');
    if (status.length) f.status = status;
    const category = searchParams.getAll('category');
    if (category.length) f.category = category as any;
    const leakType = searchParams.getAll('leak_type');
    if (leakType.length) f.leak_type = leakType as any;
    return f;
  }, [searchParams]);

  const setFilter = useCallback((key: string, value: string | string[] | boolean | undefined) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      if (value === undefined || value === false) return next;
      if (typeof value === 'boolean') { next.set(key, 'true'); return next; }
      if (Array.isArray(value)) { value.forEach(v => next.append(key, v)); return next; }
      next.set(key, value);
      return next;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => setSearchParams({}), [setSearchParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const [, v] of Object.entries(filters)) {
      if (v !== undefined && v !== false && (!Array.isArray(v) || v.length > 0)) count++;
    }
    return count;
  }, [filters]);

  return { filters, setFilter, clearFilters, activeFilterCount };
}
