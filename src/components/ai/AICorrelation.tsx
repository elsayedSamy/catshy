import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GitBranch, Loader2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

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

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-destructive/20 text-destructive',
  medium: 'bg-warning/20 text-warning',
  low: 'bg-info/20 text-info',
};

export default function AICorrelation() {
  const [result, setResult] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('');

  const runCorrelation = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ correlation: string; item_count: number; provider: string }>('/ai/correlate', {
        item_ids: [],
        scope: 'recent',
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
            entities: ['Example IOC-A', 'Example IOC-B'],
            relationship_type: 'shared_infrastructure',
            confidence: 'medium',
            reasoning: 'Mock correlation — configure AI provider in Settings for real analysis',
          },
          {
            entities: ['Example Campaign-X', 'Example Malware-Y'],
            relationship_type: 'campaign_linkage',
            confidence: 'high',
            reasoning: 'Mock example — AI will detect real patterns across your threat data',
          },
        ],
        summary: 'AI correlation running in mock mode. Configure a provider to analyze real threat data.',
        mock: true,
      });
      setProvider('mock');
    } finally {
      setLoading(false);
    }
  };

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
        {!result && !loading && (
          <div className="text-center py-8">
            <GitBranch className="h-10 w-10 text-primary/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Discover hidden relationships between IOCs, threats, and campaigns
            </p>
            <Button onClick={runCorrelation} className="glow-cyan">
              <Sparkles className="mr-2 h-4 w-4" />
              Run Correlation Analysis
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing correlations...</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {result.mock && (
              <div className="flex items-center gap-2 p-2 rounded bg-warning/10 text-warning text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Mock mode — configure AI provider for real analysis
              </div>
            )}

            <p className="text-sm text-muted-foreground">{result.summary}</p>

            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {result.correlations.map((c, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {c.relationship_type.replace(/_/g, ' ')}
                      </span>
                      <Badge className={`text-[10px] ${CONFIDENCE_COLORS[c.confidence] || ''}`}>
                        {c.confidence} confidence
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.entities.map((e, j) => (
                        <Badge key={j} variant="outline" className="text-[11px] font-mono">{e}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.reasoning}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={runCorrelation}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Re-analyze
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
