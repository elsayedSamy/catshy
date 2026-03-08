import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch, Loader2, Sparkles, RefreshCw, AlertTriangle, ArrowRight, Shield, Network, Fingerprint } from 'lucide-react';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface Correlation {
  entities: string[];
  relationship_type: string;
  confidence: string;
  reasoning: string;
}

interface CorrelationResult {
  correlations: Correlation[];
  summary: string;
  mock?: boolean;
}

const CONFIDENCE_CONFIG: Record<string, { color: string; bg: string; width: string }> = {
  high: { color: 'text-destructive', bg: 'bg-destructive/20', width: 'w-full' },
  medium: { color: 'text-warning', bg: 'bg-warning/20', width: 'w-2/3' },
  low: { color: 'text-info', bg: 'bg-info/20', width: 'w-1/3' },
};

const RELATIONSHIP_ICONS: Record<string, typeof Shield> = {
  shared_infrastructure: Network,
  campaign_linkage: Shield,
  similar_ttps: Fingerprint,
};

export default function AICorrelation() {
  const [result, setResult] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('');
  const [scope, setScope] = useState('recent');
  const [confFilter, setConfFilter] = useState('all');

  const runCorrelation = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ correlation: string; item_count: number; provider: string }>('/ai/correlate', {
        item_ids: [],
        scope,
      });
      setProvider(data.provider);
      try {
        setResult(JSON.parse(data.correlation));
      } catch {
        setResult({ correlations: [], summary: data.correlation, mock: false });
      }
    } catch {
      setResult({
        correlations: [
          {
            entities: ['185.220.101.34', '185.220.101.45', 'Tor Exit Node'],
            relationship_type: 'shared_infrastructure',
            confidence: 'high',
            reasoning: 'Both IPs are known Tor exit nodes used in recent scanning campaigns targeting port 443/8443',
          },
          {
            entities: ['APT29', 'SolarWinds', 'SUNBURST'],
            relationship_type: 'campaign_linkage',
            confidence: 'high',
            reasoning: 'APT29 attributed campaign using SUNBURST backdoor via SolarWinds supply chain compromise',
          },
          {
            entities: ['CVE-2024-3400', 'PAN-OS', 'UTA0218'],
            relationship_type: 'similar_ttps',
            confidence: 'medium',
            reasoning: 'Critical command injection vulnerability actively exploited by threat actor UTA0218',
          },
        ],
        summary: 'Mock correlation engine detected 3 relationship clusters. Configure an AI provider in Settings for real-time analysis.',
        mock: true,
      });
      setProvider('mock');
    } finally {
      setLoading(false);
    }
  };

  const filteredCorrelations = result?.correlations.filter(
    c => confFilter === 'all' || c.confidence === confFilter
  ) || [];

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4 text-primary" />
          AI Correlation Engine
          {provider && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              {provider === 'mock' ? 'Mock' : provider}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="h-8 w-32 bg-secondary/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent (24h)</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={confFilter} onValueChange={setConfFilter}>
            <SelectTrigger className="h-8 w-32 bg-secondary/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">High Only</SelectItem>
              <SelectItem value="medium">Medium Only</SelectItem>
              <SelectItem value="low">Low Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence mode="wait">
          {!result && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <GitBranch className="h-10 w-10 text-primary/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Discover hidden relationships between IOCs, threats, and campaigns
              </p>
              <Button onClick={runCorrelation} className="glow-cyan">
                <Sparkles className="mr-2 h-4 w-4" />
                Run Correlation Analysis
              </Button>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 gap-3"
            >
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <GitBranch className="absolute inset-0 m-auto h-3.5 w-3.5 text-primary/50" />
              </div>
              <p className="text-sm text-muted-foreground">Analyzing correlations...</p>
              <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 4, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {result.mock && (
                <div className="flex items-center gap-2 p-2 rounded bg-warning/10 text-warning text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Mock mode — configure AI provider for real analysis
                </div>
              )}

              <p className="text-sm text-muted-foreground">{result.summary}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {['high', 'medium', 'low'].map(level => {
                  const count = result.correlations.filter(c => c.confidence === level).length;
                  const conf = CONFIDENCE_CONFIG[level];
                  return (
                    <div key={level} className={`rounded-lg p-3 ${conf.bg} text-center`}>
                      <div className={`text-lg font-bold ${conf.color}`}>{count}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{level}</div>
                    </div>
                  );
                })}
              </div>

              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {filteredCorrelations.map((c, i) => {
                    const conf = CONFIDENCE_CONFIG[c.confidence] || CONFIDENCE_CONFIG.low;
                    const Icon = RELATIONSHIP_ICONS[c.relationship_type] || GitBranch;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="border border-border rounded-lg p-3 space-y-2.5 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              {c.relationship_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.confidence === 'high' ? 'bg-destructive' : c.confidence === 'medium' ? 'bg-warning' : 'bg-info'} ${conf.width}`} />
                            </div>
                            <Badge className={`text-[10px] ${conf.bg} ${conf.color} border-0`}>
                              {c.confidence}
                            </Badge>
                          </div>
                        </div>

                        {/* Entity Chain */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.entities.map((e, j) => (
                            <div key={j} className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[11px] font-mono bg-secondary/30">{e}</Badge>
                              {j < c.entities.length - 1 && (
                                <ArrowRight className="h-3 w-3 text-primary/40" />
                              )}
                            </div>
                          ))}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">{c.reasoning}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={runCorrelation}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Re-analyze
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
