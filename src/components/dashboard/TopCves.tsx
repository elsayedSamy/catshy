import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bug, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface CveItem {
  id: string;
  cvss: number;
  summary: string;
  kev: boolean;
  patchAvailable: boolean;
}

export function TopCves({ items = [], isLoading }: { items?: CveItem[]; isLoading: boolean }) {
  const cvssColor = (v: number) => v >= 9 ? 'text-destructive' : v >= 7 ? 'text-orange-400' : v >= 4 ? 'text-yellow-400' : 'text-primary';

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bug className="h-4 w-4 text-primary" />Top CVEs / KEV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No CVE data yet.</p>
        ) : (
          items.slice(0, 6).map((cve, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/10 px-2.5 py-1.5">
              <a href={`https://nvd.nist.gov/vuln/detail/${cve.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-primary hover:underline flex items-center gap-1 shrink-0">
                {cve.id}<ExternalLink className="h-2.5 w-2.5" />
              </a>
              <span className={`text-xs font-mono font-bold ${cvssColor(cve.cvss)}`}>{cve.cvss}</span>
              {cve.kev && <Badge variant="outline" className="text-[9px] px-1 py-0 border-destructive/30 text-destructive">KEV</Badge>}
              {cve.patchAvailable && <Badge variant="outline" className="text-[9px] px-1 py-0 border-accent/30 text-accent">PATCH</Badge>}
              <span className="text-[10px] text-muted-foreground truncate flex-1">{cve.summary}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
