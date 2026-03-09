import { Shield, TestTube, Loader2, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface Provider {
  provider: string;
  name: string;
  description: string;
  id: string | null;
  masked_key: string | null;
}

interface Props {
  provider: Provider | null;
  onClose: () => void;
  apiKey: string;
  onApiKeyChange: (v: string) => void;
  baseUrl: string;
  onBaseUrlChange: (v: string) => void;
  testResult: 'success' | 'error' | null;
  testing: boolean;
  saving: boolean;
  onTest: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export function ConfigDialog({ provider, onClose, apiKey, onApiKeyChange, baseUrl, onBaseUrlChange, testResult, testing, saving, onTest, onSave, onDelete }: Props) {
  return (
    <Dialog open={!!provider} onOpenChange={() => onClose()}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {provider?.id ? 'Settings' : 'Connect'}: {provider?.name}
          </DialogTitle>
          <DialogDescription>{provider?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">API Key / Token</label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => onApiKeyChange(e.target.value)}
              placeholder={provider?.masked_key ? `Current: ${provider.masked_key}` : 'Enter API key...'}
              className="bg-secondary/30 font-mono text-sm"
            />
          </div>
          {provider && ['opencti', 'misp', 'ms-easm'].includes(provider.provider) && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Base URL (optional)</label>
              <Input value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)} placeholder="https://api.vendor.com/v1" className="bg-secondary/30 font-mono text-sm" />
            </div>
          )}
          {testResult === 'success' && (
            <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
              <Check className="h-4 w-4" /> Connection verified successfully
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Connection failed. Check credentials.
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={onTest} disabled={testing || !apiKey.trim()}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
            Test Connection
          </Button>
          <p className="text-xs text-muted-foreground">Secrets encrypted at rest. Never exposed in browser or logs.</p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {provider?.id && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1 h-3 w-3" />Remove
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onSave} disabled={!apiKey.trim() || saving} className="glow-cyan">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {provider?.id ? 'Update' : 'Save & Enable'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
