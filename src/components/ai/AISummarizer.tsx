import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AISummarizer() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [provider, setProvider] = useState('');

  const generateSummary = async () => {
    setLoading(true);
    try {
      const result = await api.post<{ summary: string; item_count: number; provider: string }>('/ai/summarize', {
        item_ids: [],
        filters: {},
      });
      setSummary(result.summary);
      setItemCount(result.item_count);
      setProvider(result.provider);
    } catch (e: any) {
      // Dev mode mock
      setSummary(`## 🔍 AI Threat Summary (Mock Mode)\n\n### Executive Summary\nAI analysis requires a running backend. Configure your AI provider in **Settings → AI Configuration**.\n\n### What This Feature Does:\n- **Auto-summarizes** all recent threats with severity breakdown\n- **Identifies patterns** across multiple intel sources\n- **Prioritizes** based on your asset context\n- **Generates citations** linking back to source items\n\n> Configure an AI provider to unlock real threat analysis.`);
      setItemCount(0);
      setProvider('mock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          AI Threat Summary
          {provider && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              {provider === 'mock' ? 'Mock' : provider} • {itemCount} items
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!summary && !loading && (
          <div className="text-center py-8">
            <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Generate an AI-powered summary of your latest threat intelligence
            </p>
            <Button onClick={generateSummary} className="glow-cyan">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Summary
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing threat data...</p>
          </div>
        )}

        {summary && !loading && (
          <div className="space-y-3">
            <ScrollArea className="max-h-[500px]">
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                {summary.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-foreground mt-4 mb-2">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('- **')) {
                    const match = line.match(/^- \*\*(.*?)\*\*(.*)/);
                    if (match) return <p key={i} className="text-sm ml-3"><strong className="text-foreground">{match[1]}</strong>{match[2]}</p>;
                  }
                  if (line.startsWith('- ')) return <p key={i} className="text-sm ml-3 text-muted-foreground">• {line.slice(2)}</p>;
                  if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-primary/50 pl-3 text-xs text-muted-foreground italic mt-2">{line.slice(2)}</blockquote>;
                  if (line.trim() === '') return <div key={i} className="h-2" />;
                  return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
                })}
              </div>
            </ScrollArea>
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={generateSummary}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
