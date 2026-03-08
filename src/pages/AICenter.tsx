import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, FileText, GitBranch, Bot } from 'lucide-react';
import AISummarizer from '@/components/ai/AISummarizer';
import AICorrelation from '@/components/ai/AICorrelation';
import AIChat from '@/components/ai/AIChat';

export default function AICenter() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          AI Analysis Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered threat analysis, correlation, and interactive assistant
        </p>
      </div>

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
    </div>
  );
}
