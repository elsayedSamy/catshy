import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, FileText, GitBranch, Bot, Sparkles, Cpu, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import AISummarizer from '@/components/ai/AISummarizer';
import AICorrelation from '@/components/ai/AICorrelation';
import AIChat from '@/components/ai/AIChat';

const stats = [
  { label: 'AI Analyses Today', value: '—', icon: Brain, color: 'text-primary' },
  { label: 'Correlations Found', value: '—', icon: GitBranch, color: 'text-warning' },
  { label: 'Threats Summarized', value: '—', icon: FileText, color: 'text-info' },
  { label: 'AI Provider', value: 'Mock', icon: Cpu, color: 'text-accent' },
];

export default function AICenter() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Analysis Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered threat analysis, correlation, and interactive assistant
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span>Engine Active</span>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {stats.map((s, i) => (
          <Card key={i} className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center">
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="chat" className="gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="summarize" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Threat Summary
            </TabsTrigger>
            <TabsTrigger value="correlate" className="gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              Correlation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <AIChat />
          </TabsContent>

          <TabsContent value="summarize">
            <AISummarizer />
          </TabsContent>

          <TabsContent value="correlate">
            <AICorrelation />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
