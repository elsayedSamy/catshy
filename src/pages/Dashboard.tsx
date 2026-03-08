import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, Settings2, ArrowRight, Radio, Database, RefreshCw, FileText, History, Activity, BarChart3, Shield, Cpu, Zap, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { SourceHealthWidget } from '@/components/dashboard/SourceHealth';
import { IngestionRateWidget } from '@/components/dashboard/IngestionRate';
import { FailedIngestions } from '@/components/dashboard/FailedIngestions';
import { SectionHeader } from '@/components/dashboard/SectionHeader';
import {
  useDashboardKpis, useDashboardFeed, useDashboardMapEvents,
  useDashboardPulse, useDashboardChanges,
  useDashboardSeverity, useDashboardTimeline, useDashboardTopIOCs,
  useDashboardRiskScore, useDashboardRecentAlerts, useDashboardFeedStatus,
  useDashboardMitre, useDashboardAttackedAssets,
  useSourceHealth, useIngestionRate, useFailedIngestions,
  useRetryFailure, useResolveFailure,
} from '@/hooks/useApi';
import { Card, CardContent } from '@/components/ui/card';
import { downloadJSON } from '@/lib/export';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
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
  const { data: sourceHealth, isLoading: sourceHealthLoading } = useSourceHealth(timeRange);
  const { data: ingestionRate, isLoading: ingestionLoading } = useIngestionRate(timeRange);
  const { data: failedData, isLoading: failedLoading } = useFailedIngestions('failed');
  const retryMutation = useRetryFailure();
  const resolveMutation = useResolveFailure();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleRefreshAll = () => {
    refetchKpis();
    refetchFeed();
    refetchMap();
  };

  const hasNoSetup = !kpis && !kpisLoading;

  const { user } = useAuth();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  })();

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Welcome + Top Bar */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{greeting}, {user?.name || 'Analyst'}</h1>
            <p className="text-xs text-muted-foreground">Here's your threat intelligence overview</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 w-full min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search IOC, IP, Domain, CVE..." className="pl-10 bg-secondary/50 border-border h-9 text-sm" />
          </div>
        </form>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
            <span className="text-[10px] font-medium text-accent uppercase tracking-wider">Live</span>
          </div>
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
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => {
            const snapshot = { kpis, severityData, riskData, timeRange, exportedAt: new Date().toISOString() };
            downloadJSON(snapshot, `catshy-dashboard-${timeRange}`);
            toast.success('Dashboard snapshot exported');
          }}>
            <Download className="h-3 w-3 mr-1" />Export
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => navigate('/history')}>
            <History className="h-3 w-3 mr-1" />History
          </Button>
        </div>
        </div>
      </motion.div>

      {/* KPI Row */}
      <KpiCards data={kpis} isLoading={kpisLoading} />

      {/* ── Threat Pulse ── */}
      <SectionHeader icon={Zap} title="Threat Pulse" subtitle="Real-time threat signals" />
      <ThreatPulse data={pulseData} isLoading={pulseLoading} />

      {/* ── Analytics ── */}
      <SectionHeader icon={BarChart3} title="Analytics" subtitle="Severity, timeline & risk" />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <SeverityDistribution data={severityData} isLoading={severityLoading} />
        <ThreatTimeline data={timelineData} isLoading={timelineLoading} />
        <RiskScoreOverview data={riskData} isLoading={riskLoading} />
      </div>

      {/* ── MITRE ATT&CK ── */}
      <SectionHeader icon={Shield} title="MITRE ATT&CK" subtitle="Technique coverage heatmap" />
      <MitreHeatmap data={mitreData} isLoading={mitreLoading} />

      {/* ── Operational Health ── */}
      <SectionHeader icon={Cpu} title="Operational Health" subtitle="Sources, ingestion & failures" />
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <SourceHealthWidget items={sourceHealth?.items} isLoading={sourceHealthLoading} />
        <IngestionRateWidget data={ingestionRate} isLoading={ingestionLoading} />
      </div>

      {/* Failures + Feed + Changes */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <FailedIngestions
          items={failedData?.items}
          isLoading={failedLoading}
          onRetry={(id) => retryMutation.mutate(id)}
          onResolve={(id) => resolveMutation.mutate(id)}
        />
        <FeedStatus items={feedStatus} isLoading={feedStatusLoading} />
        <WhatChanged data={changesData} isLoading={changesLoading} />
      </div>

      {/* ── Intelligence ── */}
      <SectionHeader icon={Activity} title="Intelligence" subtitle="Triage, alerts & assets" />
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1fr_1fr]">
        <TriageQueue items={feedData?.items ?? []} isLoading={feedLoading} />
        <RecentAlerts items={recentAlerts} isLoading={alertsLoading} />
      </div>

      {/* Attacked Assets + Asset Hotlist + Top Threats — 3 cols */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <AttackedAssets items={attackedAssets} isLoading={attackedLoading} />
        <AssetHotlist items={mapData?.hotlist ?? []} isLoading={mapLoading} />
        <TopThreats items={mapData?.topThreats ?? []} isLoading={mapLoading} />
      </div>

      {/* Feed + IOCs + Countries + CVEs — 4 equal cols */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <LiveFeedWidget items={feedData?.items ?? []} isLoading={feedLoading} onRefresh={() => refetchFeed()} />
        <TopIOCs items={topIOCs} isLoading={iocsLoading} />
        <TopCountries items={mapData?.topCountries ?? []} isLoading={mapLoading} />
        <TopCves items={mapData?.topCves ?? []} isLoading={mapLoading} />
      </div>

      {/* Setup CTA */}
      {hasNoSetup && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <Card className="border-primary/20 bg-card">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Settings2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Get Started with CATSHY</p>
                  <p className="text-xs text-muted-foreground">Add your assets and enable intelligence sources to populate this dashboard.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => navigate('/assets')}>
                  <Database className="mr-1 h-3 w-3" />Add Assets
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/sources')}>
                  <Radio className="mr-1 h-3 w-3" />Enable Sources
                </Button>
                <Button size="sm" onClick={() => navigate('/feed')}>
                  View Feed <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
