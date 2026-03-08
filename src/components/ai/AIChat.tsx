import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, Sparkles, Trash2, User, Copy, Check, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  { icon: '🔍', text: 'Summarize recent critical threats' },
  { icon: '🛡️', text: 'What is APT29 and how to defend against it?' },
  { icon: '🌐', text: 'Analyze top IOCs from the last 24 hours' },
  { icon: '⚠️', text: 'List the most exploited CVEs this month' },
  { icon: '📊', text: 'Give me a threat landscape overview' },
  { icon: '🔐', text: 'What are the latest ransomware trends?' },
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "👋 I'm **CATSHY AI Assistant**. I can help you analyze threats, investigate IOCs, and make security decisions.\n\nPick a suggestion below or type your question:",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || isStreaming) return;
    const userMsg: Message = { role: 'user', content: msgText, timestamp: new Date() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsStreaming(true);

    try {
      const chatMessages = allMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      const result = await api.post<{ response: string; provider: string }>('/ai/chat', {
        messages: chatMessages,
        include_context: true,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm running in **mock mode**. Configure an AI provider in Settings → AI Configuration to enable real analysis.\n\n*Your question:* " + msgText,
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

  const showSuggestions = messages.length <= 1;

  return (
    <Card className="border-border bg-card flex flex-col h-[650px]">
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
            <AnimatePresence mode="popLayout">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`group flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`relative max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose-sm prose-invert max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-1.5 [&_strong]:text-foreground [&_em]:text-muted-foreground [&_li]:text-sm [&_code]:text-primary [&_code]:bg-secondary/80 [&_code]:px-1 [&_code]:rounded [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_ul]:pl-4 [&_ol]:pl-4">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words leading-relaxed">
                        {msg.content}
                      </div>
                    )}
                    {msg.role === 'assistant' && i > 0 && (
                      <button
                        onClick={() => copyMessage(msg.content, i)}
                        className="absolute -bottom-3 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-full p-1"
                      >
                        {copiedIdx === i ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isStreaming && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2"
              >
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="bg-secondary/50 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground ml-1">Analyzing...</span>
                </div>
              </motion.div>
            )}

            {/* Suggested Prompts */}
            {showSuggestions && !isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 gap-2 pt-2"
              >
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt.text)}
                    className="flex items-center gap-2 text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-all text-xs group"
                  >
                    <span className="text-base">{prompt.icon}</span>
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">{prompt.text}</span>
                    <Zap className="h-3 w-3 text-primary/0 group-hover:text-primary/60 transition-colors shrink-0 ml-auto" />
                  </button>
                ))}
              </motion.div>
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
          <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || isStreaming} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
