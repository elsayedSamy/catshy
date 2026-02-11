import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, Layers, Settings2, ArrowRight, Radio, Database, RefreshCw, FileText, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KpiCards, type KpiData } from '@/components/dashboard/KpiCards';
import { ThreatMapWidget } from '@/components/dashboard/ThreatMapWidget';
import { AssetHotlist, type HotlistItem } from '@/components/dashboard/AssetHotlist';
import { TopThreats, type ThreatTypeItem } from '@/components/dashboard/TopThreats';
import { LiveFeedWidget } from '@/components/dashboard/LiveFeedWidget';
import { TopCountries, type CountryRank } from '@/components/dashboard/TopCountries';
import { TopCves, type CveItem } from '@/components/dashboard/TopCves';
import { useDashboardKpis, useDashboardFeed, useDashboardMapEvents } from '@/hooks/useApi';
import { Card, CardContent } from '@/components/ui/card';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [myAssetsFirst, setMyAssetsFirst] = useState(false);

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useDashboardKpis(timeRange);
  const { data: feedData, isLoading: feedLoading, refetch: refetchFeed } = useDashboardFeed(timeRange);
  const { data: mapData, isLoading: mapLoading, refetch: refetchMap } = useDashboardMapEvents(timeRange);

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

  return (
    <div className="space-y-4">
      {/* Top Bar: Search + Time Range + Quick Actions */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search IOC, IP, Domain, CVE..."
              className="pl-10 bg-secondary/50 border-border h-9 text-sm"
            />
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
          <Select defaultValue="all">
            <SelectTrigger className="w-[130px] h-9 text-xs bg-secondary/50 border-border">
              <Layers className="h-3 w-3 mr-1" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              <SelectItem value="critical">Critical Only</SelectItem>
              <SelectItem value="domains">Domains</SelectItem>
              <SelectItem value="ips">IP Ranges</SelectItem>
            </SelectContent>
          </Select>
          {/* Quick actions */}
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleRefreshAll}>
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => navigate('/feed')}>
            <FileText className="h-3 w-3 mr-1" />Report
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => navigate('/history')}>
            <History className="h-3 w-3 mr-1" />History
          </Button>
        </div>
      </motion.div>

      {/* KPI Row */}
      <KpiCards data={kpis} isLoading={kpisLoading} />

      {/* Hero: Globe (dominant) + Side Panels */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <ThreatMapWidget
            events={mapData?.events ?? []}
            isLoading={mapLoading}
            myAssetsFirst={myAssetsFirst}
            onToggleMyAssets={setMyAssetsFirst}
          />
        </div>
        <div className="space-y-4">
          <AssetHotlist items={mapData?.hotlist ?? []} isLoading={mapLoading} />
          <TopThreats items={mapData?.topThreats ?? []} isLoading={mapLoading} />
        </div>
      </div>

      {/* Feed + Countries + CVEs */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LiveFeedWidget items={feedData?.items ?? []} isLoading={feedLoading} onRefresh={() => refetchFeed()} />
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
              <div className="flex gap-2">
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
