import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Asset, SourceTemplate, IntelItem, Entity, Relationship, AlertRule, Alert, Case, Report, LeakItem, AuditEntry, User } from '@/types';

const enabled = () => !api.getDevMode();

// Assets
export const useAssets = (type?: string) => useQuery({
  queryKey: ['assets', type], queryFn: () => api.get<Asset[]>(`/assets/${type ? `?type=${type}` : ''}`),
  enabled: enabled(), retry: 1,
});
export const useCreateAsset = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: Partial<Asset>) => api.post<{ id: string }>('/assets/', data), onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }) });
};
export const useDeleteAsset = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.del(`/assets/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }) });
};

// Sources
export const useSources = () => useQuery({
  queryKey: ['sources'], queryFn: () => api.get<SourceTemplate[]>('/sources/'),
  enabled: enabled(), retry: 1,
});
export const useInitializeSources = () => useMutation({ mutationFn: () => api.post('/sources/initialize') });
export const useEnableSource = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, url }: { id: string; url?: string }) => api.post(`/sources/${id}/enable${url ? `?resolved_url=${encodeURIComponent(url)}` : ''}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }) });
};
export const useDisableSource = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post(`/sources/${id}/disable`), onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] }) });
};

// Feed
export const useFeed = (params?: Record<string, string>) => {
  const sp = new URLSearchParams(params || {});
  return useQuery({ queryKey: ['feed', params], queryFn: () => api.get<IntelItem[]>(`/feed/?${sp.toString()}`), enabled: enabled(), retry: 1 });
};

// Search
export const useSearch = (query: string) => useQuery({
  queryKey: ['search', query],
  queryFn: () => api.get<{ intel_items: IntelItem[]; entities: Entity[]; total: number }>(`/search/?q=${encodeURIComponent(query)}`),
  enabled: enabled() && query.length > 0, retry: 1,
});

// Entities
export const useEntities = (type?: string) => useQuery({
  queryKey: ['entities', type], queryFn: () => api.get<Entity[]>(`/entities/${type ? `?type=${type}` : ''}`),
  enabled: enabled(), retry: 1,
});
export const useEntityRelationships = (entityId: string) => useQuery({
  queryKey: ['relationships', entityId], queryFn: () => api.get<Relationship[]>(`/entities/${entityId}/relationships`),
  enabled: enabled() && !!entityId, retry: 1,
});

// Alerts
export const useAlertRules = () => useQuery({ queryKey: ['alert-rules'], queryFn: () => api.get<AlertRule[]>('/alerts/rules'), enabled: enabled(), retry: 1 });
export const useCreateAlertRule = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { name: string; description: string; severity: string; conditions: unknown[] }) => api.post('/alerts/rules', data), onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }) });
};
export const useAlerts = (status?: string) => useQuery({ queryKey: ['alerts', status], queryFn: () => api.get<Alert[]>(`/alerts/${status ? `?status=${status}` : ''}`), enabled: enabled(), retry: 1 });

// Cases
export const useCases = () => useQuery({ queryKey: ['cases'], queryFn: () => api.get<Case[]>('/cases/'), enabled: enabled(), retry: 1 });
export const useCreateCase = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { title: string; description: string; priority?: string }) => api.post<{ id: string }>(`/cases/?title=${encodeURIComponent(data.title)}&description=${encodeURIComponent(data.description)}&priority=${data.priority || 'medium'}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['cases'] }) });
};

// Reports
export const useReports = () => useQuery({ queryKey: ['reports'], queryFn: () => api.get<Report[]>('/reports/'), enabled: enabled(), retry: 1 });
export const useGenerateReport = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: { case_id: string; format?: string }) => api.post(`/reports/generate?case_id=${data.case_id}&format=${data.format || 'technical_pdf'}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }) });
};

// Leaks
export const useLeaks = (type?: string) => useQuery({ queryKey: ['leaks', type], queryFn: () => api.get<LeakItem[]>(`/leaks/${type ? `?type=${type}` : ''}`), enabled: enabled(), retry: 1 });

// Admin
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/admin/users'), enabled: enabled(), retry: 1 });
export const useAuditLogs = (limit = 100) => useQuery({ queryKey: ['audit-logs', limit], queryFn: () => api.get<AuditEntry[]>(`/admin/audit-logs?limit=${limit}`), enabled: enabled(), retry: 1 });
export const useHealth = () => useQuery({ queryKey: ['health'], queryFn: () => api.get<{ status: string; service: string; version: string }>('/health'), enabled: enabled(), retry: 1, refetchInterval: 30000 });

// Dashboard Stats (legacy)
export const useDashboardStats = () => useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: async () => {
    const [assets, sources, alerts] = await Promise.all([
      api.get<Asset[]>('/assets/').catch(() => []),
      api.get<SourceTemplate[]>('/sources/').catch(() => []),
      api.get<Alert[]>('/alerts/').catch(() => []),
    ]);
    return {
      assetCount: assets.length,
      sourceCount: sources.filter(s => s.enabled).length,
      totalSources: sources.length,
      alertCount: alerts.length,
    };
  },
  enabled: enabled(), retry: 1,
});

// Dashboard KPIs
export const useDashboardKpis = (range: string) => useQuery({
  queryKey: ['dashboard-kpis', range],
  queryFn: () => api.get<{
    criticalAlerts: number; criticalAlertsDelta: number;
    newIocs: number; newIocsDelta: number;
    assetsAffected: number; topAssetGroup: string;
    activeCampaigns: number;
  }>(`/dashboard/kpis?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Live Feed
export const useDashboardFeed = (range: string) => useQuery({
  queryKey: ['dashboard-feed', range],
  queryFn: () => api.get<{ items: IntelItem[] }>(`/dashboard/live-feed?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Threat Feed (fresh < 24h)
export const useThreatFeed = (severity?: string) => {
  const params = new URLSearchParams();
  if (severity) params.set('severity', severity);
  return useQuery({
    queryKey: ['threat-feed', severity],
    queryFn: () => api.get<{ items: IntelItem[]; total: number }>(`/threats/feed?${params.toString()}`),
    enabled: enabled(), retry: 1,
  });
};

// Threat History (aged >= 24h, <= 30d)
export const useThreatHistory = (range: string, search?: string) => {
  const params = new URLSearchParams({ range });
  if (search) params.set('search', search);
  return useQuery({
    queryKey: ['threat-history', range, search],
    queryFn: () => api.get<{ items: IntelItem[]; total: number; queried_at: string }>(`/threats/history?${params.toString()}`),
    enabled: enabled(), retry: 1,
  });
};

// Dashboard Map Events
export const useDashboardMapEvents = (range: string) => useQuery({
  queryKey: ['dashboard-map', range],
  queryFn: () => api.get<{
    events: { source: string; target: string; severity: 'critical' | 'high' | 'medium' | 'low' }[];
    hotlist: { assetValue: string; assetType: string; threatCount: number; topSeverity: 'critical' | 'high' | 'medium' | 'low'; relevanceScore: number }[];
    topThreats: { type: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low'; weightedScore: number }[];
    topCountries: { code: string; name: string; score: number; eventCount: number }[];
    topCves: { id: string; cvss: number; summary: string; kev: boolean; patchAvailable: boolean }[];
  }>(`/map/summary?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Pulse
export const useDashboardPulse = (range: string) => useQuery({
  queryKey: ['dashboard-pulse', range],
  queryFn: () => api.get<{
    newIntel: number; criticalCves: number; leakItems: number;
    phishingSpikes: number; malwareSpikes: number;
  }>(`/dashboard/pulse?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Changes
export const useDashboardChanges = (range: string) => useQuery({
  queryKey: ['dashboard-changes', range],
  queryFn: () => api.get<{
    sourceSpikes: { name: string; count: number; delta: number }[];
    trendingKeywords: { keyword: string; count: number }[];
    mostTargetedAssets: { value: string; count: number }[];
  }>(`/dashboard/changes?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Severity Distribution
export const useDashboardSeverity = (range: string) => useQuery({
  queryKey: ['dashboard-severity', range],
  queryFn: () => api.get<{ critical: number; high: number; medium: number; low: number; info: number }>(`/dashboard/severity?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Threat Timeline
export const useDashboardTimeline = (range: string) => useQuery({
  queryKey: ['dashboard-timeline', range],
  queryFn: () => api.get<{ time: string; critical: number; high: number; medium: number; low: number }[]>(`/dashboard/timeline?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Top IOCs
export const useDashboardTopIOCs = (range: string) => useQuery({
  queryKey: ['dashboard-top-iocs', range],
  queryFn: () => api.get<{ value: string; type: string; hitCount: number; severity: 'critical' | 'high' | 'medium' | 'low' }[]>(`/dashboard/top-iocs?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Risk Score
export const useDashboardRiskScore = (range: string) => useQuery({
  queryKey: ['dashboard-risk', range],
  queryFn: () => api.get<{ overallScore: number; trend: 'up' | 'down' | 'stable'; factors: { label: string; score: number }[] }>(`/dashboard/risk-score?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Recent Alerts
export const useDashboardRecentAlerts = (range: string) => useQuery({
  queryKey: ['dashboard-recent-alerts', range],
  queryFn: () => api.get<{ id: string; title: string; severity: 'critical' | 'high' | 'medium' | 'low'; triggered_at: string; status: 'new' | 'acknowledged' | 'resolved' }[]>(`/dashboard/recent-alerts?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Feed Status
export const useDashboardFeedStatus = (range: string) => useQuery({
  queryKey: ['dashboard-feed-status', range],
  queryFn: () => api.get<{ id: string; name: string; health: 'healthy' | 'degraded' | 'error' | 'disabled'; lastFetch?: string; itemsToday: number }[]>(`/dashboard/feed-status?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard MITRE ATT&CK
export const useDashboardMitre = (range: string) => useQuery({
  queryKey: ['dashboard-mitre', range],
  queryFn: () => api.get<{ id: string; name: string; techniqueCount: number; severity: 'critical' | 'high' | 'medium' | 'low' | 'none' }[]>(`/dashboard/mitre?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Dashboard Attacked Assets
export const useDashboardAttackedAssets = (range: string) => useQuery({
  queryKey: ['dashboard-attacked-assets', range],
  queryFn: () => api.get<{ asset: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low' }[]>(`/dashboard/attacked-assets?range=${range}`),
  enabled: enabled(), retry: 1,
});

// Map Incidents (real geo data)
export const useMapIncidents = (params: {
  range?: string; severity?: string; relevant_only?: boolean; cluster?: boolean;
}) => useQuery({
  queryKey: ['map-incidents', params],
  queryFn: () => {
    const sp = new URLSearchParams();
    if (params.range) sp.set('range', params.range);
    if (params.severity) sp.set('severity', params.severity);
    if (params.relevant_only) sp.set('relevant_only', 'true');
    if (params.cluster !== undefined) sp.set('cluster', String(params.cluster));
    return api.get<{
      type: string; count: number;
      incidents?: { id: string; lat: number; lon: number; country?: string; country_name?: string; city?: string; title: string; severity: string; asset_match: boolean; confidence: number; risk: number; source_name: string; campaign?: string; timestamp: string }[];
      clusters?: { lat: number; lon: number; count: number; severity_max: string; has_asset_match: boolean; countries: string[]; sample_titles: string[] }[];
    }>(`/map/incidents?${sp.toString()}`);
  },
  enabled: enabled(), retry: 1,
});
