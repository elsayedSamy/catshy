import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from '@/components/StatusBadge';
import { Eye, AlertTriangle, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LeakItem } from '@/types';
import { STATUS_OPTIONS } from './constants';

interface Props {
  item: LeakItem;
  onViewDetails: (item: LeakItem) => void;
  onInvestigate: (id: string) => void;
  onCreateCase: (id: string) => void;
}

export function LeakCard({ item, onViewDetails, onInvestigate, onCreateCase }: Props) {
  const statusInfo = STATUS_OPTIONS.find(s => s.value === item.status) || STATUS_OPTIONS[0];
  const assets = item.matched_assets || item.matched_asset_ids || [];

  return (
    <Card className={cn(
      'border-border bg-card hover:border-primary/20 transition-all',
      assets.length > 0 && 'border-l-2 border-l-destructive'
    )}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={item.severity} />
            <Badge variant="outline" className="text-[10px] capitalize">{item.type.replace('_', ' ')}</Badge>
            <Badge variant="outline" className={cn('text-[10px]', statusInfo.color)}>{statusInfo.label}</Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{format(new Date(item.discovered_at), 'MMM d')}</span>
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-2">{item.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        {assets.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {assets.map(a => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
          </div>
        )}
        <div className="flex gap-1.5 pt-1 flex-wrap">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onViewDetails(item)}>
            <Eye className="mr-1 h-3 w-3" />Details
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onInvestigate(item.id)}>
            <AlertTriangle className="mr-1 h-3 w-3" />Investigate
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onCreateCase(item.id)}>
            <Briefcase className="mr-1 h-3 w-3" />Create Case
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
