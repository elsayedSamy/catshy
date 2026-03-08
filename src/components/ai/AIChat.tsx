import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Sparkles, Trash2, User } from 'lucide-react';
import { api } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "👋 I'm **CATSHY AI Assistant**. I can help you analyze threats, investigate IOCs, and make security decisions.\n\nTry asking me:\n- \"Summarize recent critical threats\"\n- \"What is APT29?\"\n- \"Analyze this IP: 192.168.1.1\"\n- \"Explain CVE-2024-1234\"",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsStreaming(true);

    // Try streaming first, fall back to non-streaming
    try {
      const chatMessages = allMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      // Try non-streaming endpoint
      const result = await api.post<{ response: string; provider: string }>('/ai/chat', {
        messages: chatMessages,
        include_context: true,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      // Dev mode fallback
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm running in **mock mode**. Configure an AI provider in Settings → AI Configuration to enable real analysis.\n\n*Your question:* " + userMsg.content,
        timestamp: new Date(),
      }]);
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Chat cleared. How can I help you?",
      timestamp: new Date(),
    }]);
  };

  return (
    <Card className="border-border bg-card flex flex-col h-[600px]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          AI Assistant
          <Badge variant="outline" className="ml-auto text-[10px]">
            <Sparkles className="h-2.5 w-2.5 mr-1" />
            Threat Intel
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden p-3">
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary/50'
                }`}>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {msg.content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                      }
                      if (part.startsWith('*') && part.endsWith('*')) {
                        return <em key={j}>{part.slice(1, -1)}</em>;
                      }
                      return <span key={j}>{part}</span>;
                    })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {isStreaming && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t border-border mt-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about threats, IOCs, CVEs..."
            className="bg-secondary/30 text-sm"
            disabled={isStreaming}
          />
          <Button size="icon" onClick={sendMessage} disabled={!input.trim() || isStreaming} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
