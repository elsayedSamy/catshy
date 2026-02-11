import { motion } from 'framer-motion';
import { Database, Radio, Rss, Shield, AlertTriangle, ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { useState } from 'react';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [hasAssets] = useState(false);
  const [hasSources] = useState(false);
  const [hasIntel] = useState(false);

  // Onboarding stepper when nothing is configured
  if (!hasAssets && !hasSources && !hasIntel) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mission Control</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome to CATSHY. Let's get your threat intelligence platform running.</p>
        </div>

        <motion.div {...fadeIn} className="grid gap-6 md:grid-cols-3">
          {/* Step 1 */}
          <Card className="group relative overflow-hidden border-primary/20 bg-card transition-all hover:border-primary/40 hover:glow-cyan cursor-pointer"
                onClick={() => navigate('/assets')}>
            <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-primary/5" />
            <CardHeader className="pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 mb-2">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Step 1: Add Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Define your domains, IP ranges, brands, and keywords. These are the entities CATSHY monitors for threats.
              </p>
              <Button variant="ghost" size="sm" className="text-primary p-0 h-auto">
                Add assets <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          {/* Step 2 */}
          <Card className="group relative overflow-hidden border-border bg-card transition-all hover:border-accent/40 cursor-pointer"
                onClick={() => navigate('/sources')}>
            <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-accent/5" />
            <CardHeader className="pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 mb-2">
                <Radio className="h-5 w-5 text-accent" />
              </div>
              <CardTitle className="text-base">Step 2: Enable Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Browse 50 pre-configured threat intelligence sources. Enable the ones relevant to your organization.
              </p>
              <Button variant="ghost" size="sm" className="text-accent p-0 h-auto">
                Browse catalog <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          {/* Step 3 */}
          <Card className="group relative overflow-hidden border-border bg-card transition-all cursor-default opacity-60">
            <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-muted/10" />
            <CardHeader className="pb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary mb-2">
                <Rss className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Step 3: View Intel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Once sources are enabled and fetch their first data, your live intelligence feed will appear here.
              </p>
              <span className="text-xs text-muted-foreground">Complete steps 1 & 2 first</span>
            </CardContent>
          </Card>
        </motion.div>

        {/* Platform status */}
        <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Platform Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <StatusCard label="Assets Monitored" value="0" icon={Database} />
                <StatusCard label="Sources Active" value="0 / 50" icon={Radio} />
                <StatusCard label="Intel Items" value="0" icon={Rss} />
                <StatusCard label="Active Alerts" value="0" icon={AlertTriangle} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <EmptyState
      icon="shield"
      title="Mission Control"
      description="Your threat intelligence dashboard will show real-time data once assets and sources are configured."
      actionLabel="Add Assets"
      onAction={() => navigate('/assets')}
    />
  );
}

function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
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
