import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuth } from '@/contexts/AuthContext';

export function TorToggle() {
  const { isEnabled, setFlag } = useFeatureFlags();
  const { hasRole } = useAuth();
  const torEnabled = isEnabled('leaks_tor');
  const [showWarning, setShowWarning] = useState(false);

  return (
    <Card className={cn('border-border', torEnabled ? 'bg-destructive/10 border-destructive/30' : 'bg-secondary/20')}>
      <CardContent className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Shield className={cn('h-5 w-5', torEnabled ? 'text-destructive' : 'text-accent')} />
          <div>
            <p className="text-xs font-medium">{torEnabled ? '⚠ TOR/Dark Web Sources Active' : 'Public Sources Only'}</p>
            <p className="text-[10px] text-muted-foreground">TOR/dark web connectors are {torEnabled ? 'enabled — use with caution' : 'disabled'}.</p>
          </div>
        </div>
        {hasRole(['system_owner']) && (
          torEnabled ? (
            <Button variant="destructive" size="sm" className="text-xs" onClick={() => { setFlag('leaks_tor', false); toast.success('TOR sources disabled'); }}>
              <Lock className="mr-1 h-3 w-3" />Disable TOR
            </Button>
          ) : showWarning ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-destructive font-medium">⚠ Legal warning: enables dark web scanning</span>
              <Button variant="destructive" size="sm" className="text-xs" onClick={() => { setFlag('leaks_tor', true); toast.success('TOR sources enabled'); setShowWarning(false); }}>Confirm</Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowWarning(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowWarning(true)}>
              <Lock className="mr-1 h-3 w-3" />Enable TOR
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
