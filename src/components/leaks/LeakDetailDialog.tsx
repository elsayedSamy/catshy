import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from '@/components/StatusBadge';
import { AlertTriangle, X, Shield } from 'lucide-react';
import { format } from 'date-fns';
import type { LeakItem } from '@/types';

interface Props {
  item: LeakItem | null;
  onClose: () => void;
  onTriage: (id: string, status: string) => void;
}

export function LeakDetailDialog({ item, onClose, onTriage }: Props) {
  if (!item) return null;
  const assets = item.matched_assets || item.matched_asset_ids || [];

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader><DialogTitle className="text-foreground">{item.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={item.severity} />
            <Badge variant="outline" className="text-xs capitalize">{item.type.replace('_', ' ')}</Badge>
          </div>
          <p className="text-sm text-foreground">{item.description}</p>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Evidence (masked)</p>
            <pre className="text-xs font-mono bg-secondary/30 p-3 rounded-lg whitespace-pre-wrap text-foreground">{item.evidence_excerpt}</pre>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Source</span><p className="font-medium">{item.source_name}</p></div>
            <div><span className="text-muted-foreground">Provenance</span><p className="font-medium">{item.provenance}</p></div>
            <div><span className="text-muted-foreground">Discovered</span><p className="font-medium">{format(new Date(item.discovered_at), 'MMM d, yyyy HH:mm')}</p></div>
            <div><span className="text-muted-foreground">Matched Assets</span><p className="font-medium">{assets.join(', ') || 'None'}</p></div>
          </div>
          <div className="flex gap-1.5 flex-wrap pt-2 border-t border-border">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { onTriage(item.id, 'confirmed'); onClose(); }}>
              <AlertTriangle className="mr-1 h-3 w-3" />Confirm
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { onTriage(item.id, 'false_positive'); onClose(); }}>
              <X className="mr-1 h-3 w-3" />False Positive
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { onTriage(item.id, 'resolved'); onClose(); }}>
              <Shield className="mr-1 h-3 w-3" />Resolved
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
