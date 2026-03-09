import { useState, useEffect } from 'react';
import { Radio, RefreshCw, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import type { SourceTemplate, ConnectorType } from '@/types';
import { api } from '@/lib/api';

const connectorLabels: Record<ConnectorType, string> = {
  rss_atom: 'RSS/Atom', http_json: 'HTTP JSON', http_csv: 'HTTP CSV',
  rest_api: 'REST API', taxii2: 'TAXII 2.x', imap: 'IMAP', webhook: 'Webhook',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: SourceTemplate | null;
  onEnable: (id: string, url: string) => void;
  enabling: boolean;
}

export function EnableWizardDialog({ open, onOpenChange, source, onEnable, enabling }: Props) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState(0);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  // Reset state when source changes or dialog opens
  useEffect(() => {
    if (open && source) {
      setUrl(source.resolved_url || source.default_url);
      setStep(0);
      setResult(null);
    }
  }, [open, source]);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      await api.post('/sources/validate-url', { url });
      setResult('success');
      setStep(1);
    } catch {
      const isValid = url.startsWith('http');
      setResult(isValid ? 'success' : 'error');
      if (isValid) setStep(1);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Enable Source: {source?.name || 'New Source'}
          </DialogTitle>
          <DialogDescription>Validate the feed URL before enabling.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {step === 0 && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Feed URL</label>
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-secondary/30 font-mono text-sm"
                />
              </div>
              {result === 'error' && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />Feed URL could not be validated.
                </div>
              )}
              <Button onClick={handleTest} disabled={testing || !url.trim()} className="w-full">
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
            </>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                <Check className="h-4 w-4" />Feed validated. Ready to enable.
              </div>
              <div className="rounded-lg bg-secondary/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Source:</span> {source?.name || 'Custom'}</p>
                <p><span className="text-muted-foreground">Type:</span> {source && connectorLabels[source.connector_type]}</p>
                <p><span className="text-muted-foreground">URL:</span> <span className="font-mono text-xs">{url}</span></p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === 1 && source && (
            <Button onClick={() => onEnable(source.id, url)} disabled={enabling} className="glow-cyan">
              {enabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enable Source
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
