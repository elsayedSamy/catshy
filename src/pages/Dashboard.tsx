import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, Layers, Settings2, ArrowRight, Radio, Database, RefreshCw, FileText, History, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KpiCards } from '@/components/dashboard/KpiCards';
import { TriageQueue } from '@/components/dashboard/TriageQueue';
import { ThreatPulse } from '@/components/dashboard/ThreatPulse';
import { WhatChanged } from '@/components/dashboard/WhatChanged';
import { AssetHotlist } from '@/components/dashboard/AssetHotlist';
import { TopThreats } from '@/components/dashboard/TopThreats';
import { LiveFeedWidget } from '@/components/dashboard/LiveFeedWidget';
import { TopCountries } from '@/components/dashboard/TopCountries';
import { TopCves } from '@/components/dashboard/TopCves';
import { SeverityDistribution } from '@/components/dashboard/SeverityDistribution';
import { ThreatTimeline } from '@/components/dashboard/ThreatTimeline';
import { TopIOCs } from '@/components/dashboard/TopIOCs';
import { RiskScoreOverview } from '@/components/dashboard/RiskScoreOverview';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { FeedStatus } from '@/components/dashboard/FeedStatus';
import { MitreHeatmap } from '@/components/dashboard/MitreHeatmap';
import { AttackedAssets } from '@/components/dashboard/AttackedAssets';
import {
  useDashboardKpis, useDashboardFeed, useDashboardMapEvents,
  useDashboardPulse, useDashboardChanges,
  useDashboardSeverity, useDashboardTimeline, useDashboardTopIOCs,
  useDashboardRiskScore, useDashboardRecentAlerts, useDashboardFeedStatus,
  useDashboardMitre, useDashboardAttackedAssets,
} from '@/hooks/useApi';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDevMode } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('24h');

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useDashboardKpis(timeRange);
  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed } = useDashboardFeed(timeRange);
  const { data: mapData, isLoading: mapLoading, refetch: refetchMap } = useDashboardMapEvents(timeRange);
  const { data: pulseData, isLoading: pulseLoading } = useDashboardPulse(timeRange);
  const { data: changesData, isLoading: changesLoading } = useDashboardChanges(timeRange);
  const { data: severityData, isLoading: severityLoading } = useDashboardSeverity(timeRange);
  const { data: timelineData, isLoading: timelineLoading } = useDashboardTimeline(timeRange);
  const { data: topIOCs, isLoading: iocsLoading } = useDashboardTopIOCs(timeRange);
  const { data: riskData, isLoading: riskLoading } = useDashboardRiskScore(timeRange);
  const { data: recentAlerts, isLoading: alertsLoading } = useDashboardRecentAlerts(timeRange);
  const { data: feedStatus, isLoading: feedStatusLoading } = useDashboardFeedStatus(timeRange);
  const { data: mitreData, isLoading: mitreLoading } = useDashboardMitre(timeRange);
  const { data: attackedAssets, isLoading: attackedLoading } = useDashboardAttackedAssets(timeRange);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleRefreshAll = () => {
    refetchKpis();
    refetchFeed();
    refetchMap();
  };

  // Check if we have any real data at all
  const hasData = !isDevMode && (kpis || feedData || mapData || pulseData || severityData);
  const showEmptyDashboard = isDevMode || (!hasData && !kpisLoading);

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Top Bar */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 w-full min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search IOC, IP, Domain, CVE..." className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
          </div>
        </form>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px] h-9 text-xs bg-secondary/50 border-border">
              <Clock className="h-3 w-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleRefreshAll}>
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => navigate('/reports')}>
            <FileText className="h-3 w-3 mr-1" />Report
          </Button>
        </div>
      </motion.div>

      {/* Empty Dashboard State — unified view when no backend is connected */}
      {showEmptyDashboard && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
          {/* Hero CTA */}
          <Card className="border-primary/20 bg-card">
            <CardContent className="py-10 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <LayoutDashboard className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Welcome to CATSHY</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                {isDevMode
                  ? 'Dev Mode is active — connect a backend to see live threat intelligence data on your dashboard.'
                  : 'Add your assets and enable intelligence sources to populate this dashboard with real-time threat data.'}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button size="sm" variant="outline" onClick={() => navigate('/assets')}>
                  <Database className="mr-2 h-4 w-4" />Add Assets
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/sources')}>
                  <Radio className="mr-2 h-4 w-4" />Enable Sources
                </Button>
                <Button size="sm" onClick={() => navigate('/feed')}>
                  View Feed <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview grid — compact placeholder cards showing what will be here */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Critical Alerts', value: '—', sub: 'No data yet' },
              { label: 'New IOCs', value: '—', sub: 'No data yet' },
              { label: 'Assets Affected', value: '—', sub: 'No data yet' },
              { label: 'Active Campaigns', value: '—', sub: 'No data yet' },
            ].map(k => (
              <Card key={k.label} className="border-border bg-card/50">
                <CardContent className="p-4">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{k.label}</p>
                  <p className="text-2xl font-bold text-muted-foreground/30 font-mono mt-1">{k.value}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Compact widget previews */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            {['Severity Distribution', 'Threat Timeline', 'Risk Score'].map(name => (
              <Card key={name} className="border-border bg-card/50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{name}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">Connect backend to view</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {['Live Feed', 'Top IOCs', 'Top Countries', 'Top CVEs'].map(name => (
              <Card key={name} className="border-border bg-card/50">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-medium text-muted-foreground">{name}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">No data yet</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Full Dashboard — only shown when we have real data or loading */}
      {!showEmptyDashboard && (
        <>
          {/* KPI Row */}
          <KpiCards data={kpis} isLoading={kpisLoading} />

          {/* Threat Pulse */}
          <ThreatPulse data={pulseData} isLoading={pulseLoading} />

          {/* Charts Row */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            <SeverityDistribution data={severityData} isLoading={severityLoading} />
            <ThreatTimeline data={timelineData} isLoading={timelineLoading} />
            <RiskScoreOverview data={riskData} isLoading={riskLoading} />
          </div>

          {/* MITRE ATT&CK Heatmap */}
          <MitreHeatmap data={mitreData} isLoading={mitreLoading} />

          {/* Main Content: Triage + Side Panels */}
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1fr_minmax(280px,320px)]">
            <div className="space-y-4 min-w-0">
              <TriageQueue items={feedData?.items ?? []} isLoading={feedLoading} />
              <AttackedAssets items={attackedAssets} isLoading={attackedLoading} />
            </div>
            <div className="space-y-4 min-w-0">
              <WhatChanged data={changesData} isLoading={changesLoading} />
              <RecentAlerts items={recentAlerts} isLoading={alertsLoading} />
              <FeedStatus items={feedStatus} isLoading={feedStatusLoading} />
              <AssetHotlist items={mapData?.hotlist ?? []} isLoading={mapLoading} />
              <TopThreats items={mapData?.topThreats ?? []} isLoading={mapLoading} />
            </div>
          </div>

          {/* Feed + IOCs + Countries + CVEs */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            <LiveFeedWidget items={feedData?.items ?? []} isLoading={feedLoading} onRefresh={() => refetchFeed()} />
            <TopIOCs items={topIOCs} isLoading={iocsLoading} />
            <TopCountries items={mapData?.topCountries ?? []} isLoading={mapLoading} />
            <TopCves items={mapData?.topCves ?? []} isLoading={mapLoading} />
          </div>
        </>
      )}
    </div>
  );
}
