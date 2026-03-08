import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Brain, Key, TestTube, Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface AIConfig {
  provider: string;
  model: string;
  base_url: string;
  temperature: number;
  max_tokens: number;
  has_api_key: boolean;
  api_key_masked: string;
  status: string;
}

const PROVIDERS = [
  { value: 'mock', label: 'Mock (No AI)', description: 'Preview mode — no API key needed' },
  { value: 'openai', label: 'OpenAI', description: 'GPT-4o, GPT-4o-mini, etc.' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gemini 2.0 Flash, Pro, etc.' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Run AI locally — no API key needed' },
];

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fastest)' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1 (Recommended)' },
    { value: 'llama3.1:70b', label: 'Llama 3.1 70B (Powerful)' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'mixtral', label: 'Mixtral 8x7B' },
    { value: 'codellama', label: 'Code Llama' },
    { value: 'phi3', label: 'Phi-3' },
  ],
  mock: [],
};

export default function AIConfigPanel() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [provider, setProvider] = useState('mock');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(2048);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await api.get<AIConfig>('/ai/config');
      setConfig(data);
      setProvider(data.provider);
      setModel(data.model);
      setBaseUrl(data.base_url);
      setTemperature(data.temperature);
      setMaxTokens(data.max_tokens);
    } catch {
      // Dev mode fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      await api.put('/ai/config', {
        provider,
        api_key: apiKey || undefined,
        model: customModel || model || undefined,
        base_url: baseUrl || undefined,
        temperature,
        max_tokens: maxTokens,
      });
      toast.success('AI configuration saved');
      setApiKey('');
      await loadConfig();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save AI config');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; response?: string; error?: string }>('/ai/test');
      setTestResult({
        success: result.success,
        message: result.success ? result.response || 'Connected!' : result.error || 'Failed',
      });
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const needsApiKey = provider === 'openai' || provider === 'gemini';
  const showBaseUrl = provider === 'ollama';
  const models = MODEL_OPTIONS[provider] || [];

  if (loading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          AI Configuration
          <Badge variant={config?.status === 'active' ? 'default' : 'outline'} className="ml-auto text-[10px]">
            {config?.status === 'active' ? '● Active' : '○ Not Configured'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">AI Provider</label>
          <Select value={provider} onValueChange={(v) => { setProvider(v); setModel(''); setTestResult(null); }}>
            <SelectTrigger className="bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map(p => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex flex-col">
                    <span>{p.label}</span>
                    <span className="text-[10px] text-muted-foreground">{p.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key */}
        {needsApiKey && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Key className="h-3.5 w-3.5" />
              API Key
              {config?.has_api_key && (
                <Badge variant="outline" className="text-[10px] text-success">Configured: {config.api_key_masked}</Badge>
              )}
            </label>
            <Input
              type="password"
              placeholder={config?.has_api_key ? 'Leave empty to keep current key' : `Enter ${provider === 'openai' ? 'OpenAI' : 'Google'} API key`}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="bg-secondary/30 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              {provider === 'openai' ? 'Get key from platform.openai.com/api-keys' : 'Get key from aistudio.google.com/apikey'}
            </p>
          </div>
        )}

        {/* Base URL (Ollama) */}
        {showBaseUrl && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Ollama URL</label>
            <Input
              placeholder="http://localhost:11434"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              className="bg-secondary/30 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Default: http://localhost:11434 — Make sure Ollama is running
            </p>
          </div>
        )}

        {/* Model Selection */}
        {provider !== 'mock' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            {models.length > 0 ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              placeholder="Or enter custom model name"
              value={customModel}
              onChange={e => setCustomModel(e.target.value)}
              className="bg-secondary/30 font-mono text-xs"
            />
          </div>
        )}

        {/* Temperature */}
        {provider !== 'mock' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Temperature</label>
              <span className="text-sm font-mono text-muted-foreground">{temperature.toFixed(1)}</span>
            </div>
            <Slider
              value={[temperature * 100]}
              min={0} max={200} step={10}
              onValueChange={([v]) => setTemperature(v / 100)}
            />
            <p className="text-[10px] text-muted-foreground">
              Lower = more precise/deterministic, Higher = more creative
            </p>
          </div>
        )}

        {/* Max Tokens */}
        {provider !== 'mock' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Max Tokens</label>
              <span className="text-sm font-mono text-muted-foreground">{maxTokens}</span>
            </div>
            <Slider
              value={[maxTokens]}
              min={256} max={8192} step={256}
              onValueChange={([v]) => setMaxTokens(v)}
            />
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${testResult.success ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {testResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="text-xs">{testResult.message}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} size="sm" className="glow-cyan">
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}
            Save AI Config
          </Button>
          {provider !== 'mock' && (
            <Button onClick={handleTest} disabled={testing} variant="outline" size="sm">
              {testing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <TestTube className="mr-2 h-3.5 w-3.5" />}
              Test Connection
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
