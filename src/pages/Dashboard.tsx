import { motion } from 'framer-motion';
import { Database, Radio, Rss, Shield, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboardStats } from '@/hooks/useApi';

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();

  const assetCount = stats?.assetCount ?? 0;
  const sourceCount = stats?.sourceCount ?? 0;
  const totalSources = stats?.totalSources ?? 50;
  const alertCount = stats?.alertCount ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mission Control</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome to CATSHY. Your threat intelligence command center.</p>
      </div>

      <motion.div {...fadeIn} className="grid gap-6 md:grid-cols-3">
        <Card className="group relative overflow-hidden border-primary/20 bg-card transition-all hover:border-primary/40 cursor-pointer" onClick={() => navigate('/assets')}>
          <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-primary/5" />
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 mb-2">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base">{assetCount > 0 ? `${assetCount} Assets Monitored` : 'Step 1: Add Assets'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {assetCount > 0 ? 'Manage your monitored domains, IPs, brands, and keywords.' : 'Define your domains, IP ranges, brands, and keywords to monitor.'}
            </p>
            <Button variant="ghost" size="sm" className="text-primary p-0 h-auto">
              {assetCount > 0 ? 'Manage' : 'Add assets'} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-border bg-card transition-all hover:border-accent/40 cursor-pointer" onClick={() => navigate('/sources')}>
          <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-accent/5" />
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 mb-2">
              <Radio className="h-5 w-5 text-accent" />
            </div>
            <CardTitle className="text-base">{sourceCount > 0 ? `${sourceCount} Sources Active` : 'Step 2: Enable Sources'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {sourceCount > 0 ? `${sourceCount} of ${totalSources} sources enabled and collecting intelligence.` : 'Browse 50 pre-configured threat intelligence sources.'}
            </p>
            <Button variant="ghost" size="sm" className="text-accent p-0 h-auto">
              {sourceCount > 0 ? 'Manage' : 'Browse catalog'} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-border bg-card transition-all cursor-pointer" onClick={() => navigate('/feed')}>
          <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-muted/10" />
          <CardHeader className="pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary mb-2">
              <Rss className="h-5 w-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">Step 3: View Intel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Once sources are enabled, your live intelligence feed will appear here.
            </p>
            <Button variant="ghost" size="sm" className="text-muted-foreground p-0 h-auto">
              View feed <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />Platform Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatusCard label="Assets Monitored" value={String(assetCount)} icon={Database} />
              <StatusCard label="Sources Active" value={`${sourceCount} / ${totalSources}`} icon={Radio} />
              <StatusCard label="Intel Items" value="0" icon={Rss} />
              <StatusCard label="Active Alerts" value={String(alertCount)} icon={AlertTriangle} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-card">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
