import { CheckCircle2, AlertCircle, Shield, Settings, Link, Unlink, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const tierColor: Record<string, string> = {
  Free: 'bg-accent/20 text-accent',
  Premium: 'bg-primary/20 text-primary',
  Enterprise: 'bg-destructive/20 text-destructive',
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'active': return <CheckCircle2 className="h-3.5 w-3.5 text-accent" />;
    case 'error': return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    default: return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

interface Provider {
  provider: string;
  name: string;
  description: string;
  tier: string;
  id: string | null;
  enabled: boolean;
  status: string;
  masked_key: string | null;
  last_success: string | null;
  last_error: string | null;
}

interface Props {
  provider: Provider;
  onToggle: () => void;
  onConfig: () => void;
}

export function IntegrationCard({ provider: p, onToggle, onConfig }: Props) {
  return (
    <Card className={`border-border bg-card transition-all hover:border-primary/20 ${p.enabled ? 'border-l-2 border-l-accent' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusIcon status={p.status} />
            <h4 className="font-medium text-sm text-foreground truncate">{p.name}</h4>
          </div>
          <Badge className={`text-[10px] ${tierColor[p.tier] || ''}`}>{p.tier}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant={p.id ? 'default' : 'secondary'} className="text-[10px]">
              {p.id ? <><Check className="mr-1 h-2.5 w-2.5" />Connected</> : <><Unlink className="mr-1 h-2.5 w-2.5" />Not configured</>}
            </Badge>
            {p.masked_key && <span className="text-[10px] text-muted-foreground font-mono">{p.masked_key}</span>}
          </div>
          <div className="flex items-center gap-1">
            {p.id ? (
              <Switch checked={p.enabled} onCheckedChange={onToggle} />
            ) : (
              <Button size="sm" className="h-7 text-[10px]" onClick={onConfig}>
                <Link className="mr-1 h-3 w-3" />Connect
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onConfig}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {p.last_error && <p className="text-[10px] text-destructive mt-1 truncate">{p.last_error}</p>}
        {p.last_success && !p.last_error && <p className="text-[10px] text-muted-foreground mt-1">Last OK: {new Date(p.last_success).toLocaleDateString()}</p>}
      </CardContent>
    </Card>
  );
}
