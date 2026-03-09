import { Search, Shield, Link, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Provider {
  provider: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  id: string | null;
}

const tierColor: Record<string, string> = {
  Free: 'bg-accent/20 text-accent',
  Premium: 'bg-primary/20 text-primary',
  Enterprise: 'bg-destructive/20 text-destructive',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Provider[];
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (provider: Provider) => void;
}

export function PickerDialog({ open, onOpenChange, providers, search, onSearchChange, onSelect }: Props) {
  const unconfigured = providers.filter(p => !p.id);
  const q = search.toLowerCase();
  const results = q
    ? unconfigured.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : unconfigured;

  const grouped = results.reduce<Record<string, Provider[]>>((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />Add Integration
          </DialogTitle>
          <DialogDescription>Choose a provider to connect and configure.</DialogDescription>
        </DialogHeader>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search providers…" className="pl-10 bg-secondary/30 h-9 text-sm" />
        </div>
        <ScrollArea className="h-[360px] pr-2">
          <div className="space-y-1">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {unconfigured.length === 0 ? 'All providers are already configured!' : 'No matching providers.'}
              </p>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 sticky top-0 bg-card z-10">{cat}</p>
                  {items.map(p => (
                    <button key={p.provider} className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors" onClick={() => onSelect(p)}>
                      <Shield className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{p.name}</span>
                          <Badge className={`text-[9px] ${tierColor[p.tier] || ''}`}>{p.tier}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                      </div>
                      <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
