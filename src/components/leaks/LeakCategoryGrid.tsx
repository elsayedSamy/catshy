import { Card, CardContent } from '@/components/ui/card';
import { Key, AtSign, Server, ShieldAlert, Skull, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeakItem } from '@/types';

const LEAK_CATEGORIES = [
  { key: 'credential', label: 'Credential Exposure', icon: Key, color: 'text-destructive' },
  { key: 'brand_mention', label: 'Brand Mentions', icon: AtSign, color: 'text-primary' },
  { key: 'typosquat', label: 'Asset Mentions', icon: Server, color: 'text-orange-400' },
  { key: 'breach', label: 'Data Breach Watch', icon: ShieldAlert, color: 'text-blue-400' },
  { key: 'code_leak', label: 'Ransomware Watch', icon: Skull, color: 'text-destructive' },
  { key: 'paste', label: 'Paste Monitor', icon: Globe, color: 'text-muted-foreground' },
] as const;

interface Props {
  items: LeakItem[];
  activeType: string;
  onToggleType: (type: string) => void;
}

export function LeakCategoryGrid({ items, activeType, onToggleType }: Props) {
  const counts: Record<string, number> = {};
  LEAK_CATEGORIES.forEach(c => {
    counts[c.key] = items.filter(i => i.type === c.key).length;
  });

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {LEAK_CATEGORIES.map(cat => {
        const Icon = cat.icon;
        return (
          <Card
            key={cat.key}
            className={cn(
              'border-border bg-card/50 cursor-pointer hover:border-primary/30 transition-colors',
              activeType === cat.key && 'border-primary/50 bg-primary/5'
            )}
            onClick={() => onToggleType(activeType === cat.key ? '' : cat.key)}
          >
            <CardContent className="p-3 text-center">
              <Icon className={cn('h-5 w-5 mx-auto mb-1', cat.color)} />
              <p className="text-2xl font-bold text-foreground">{counts[cat.key] || 0}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">{cat.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
