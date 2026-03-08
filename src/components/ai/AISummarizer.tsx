import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Sparkles, RefreshCw, Download, Copy, Check, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export default function AISummarizer() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [itemCount, setItemCount] = useState(0);
  const [provider, setProvider] = useState('');
  const [timeRange, setTimeRange] = useState('24h');
  const [severity, setSeverity] = useState('all');
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    setLoading(true);
    try {
      const result = await api.post<{ summary: string; item_count: number; provider: string }>('/ai/summarize', {
        item_ids: [],
        filters: { time_range: timeRange, severity: severity !== 'all' ? severity : undefined },
      });
      setSummary(result.summary);
      setItemCount(result.item_count);
      setProvider(result.provider);
    } catch {
      setSummary(`## 🔍 AI Threat Summary (Mock Mode)\n\n### Executive Summary\nAI analysis requires a running backend. Configure your AI provider in **Settings → AI Configuration**.\n\n### What This Feature Does:\n- **Auto-summarizes** all recent threats with severity breakdown\n- **Identifies patterns** across multiple intel sources\n- **Prioritizes** based on your asset context\n- **Generates citations** linking back to source items\n\n> Configure an AI provider to unlock real threat analysis.`);
      setItemCount(0);
      setProvider('mock');
    } finally {
      setLoading(false);
    }
  };

  const copySummary = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success('Summary copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSummary = () => {
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threat-summary-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Summary downloaded');
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
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-8 w-28 bg-secondary/30 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="6h">Last 6h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-8 w-28 bg-secondary/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence mode="wait">
          {!summary && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <Sparkles className="h-10 w-10 text-primary/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Generate an AI-powered summary of your latest threat intelligence
              </p>
              <Button onClick={generateSummary} className="glow-cyan">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Summary
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
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing threat data...</p>
              <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '80%' }}
                  transition={{ duration: 3, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}

          {summary && !loading && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <ScrollArea className="max-h-[500px]">
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_strong]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_code]:text-primary [&_code]:bg-secondary/80 [&_code]:px-1 [&_code]:rounded [&_ul]:pl-4">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copySummary}>
                    {copied ? <Check className="mr-1.5 h-3 w-3 text-success" /> : <Copy className="mr-1.5 h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadSummary}>
                    <Download className="mr-1.5 h-3 w-3" />
                    Download .md
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={generateSummary}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Regenerate
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
