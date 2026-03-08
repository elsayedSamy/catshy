import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';

export interface MitreTactic {
  id: string;
  name: string;
  techniqueCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

const MITRE_TACTICS: { id: string; name: string; short: string }[] = [
  { id: 'TA0001', name: 'Initial Access', short: 'Init' },
  { id: 'TA0002', name: 'Execution', short: 'Exec' },
  { id: 'TA0003', name: 'Persistence', short: 'Pers' },
  { id: 'TA0004', name: 'Privilege Escalation', short: 'Priv' },
  { id: 'TA0005', name: 'Defense Evasion', short: 'Evas' },
  { id: 'TA0006', name: 'Credential Access', short: 'Cred' },
  { id: 'TA0007', name: 'Discovery', short: 'Disc' },
  { id: 'TA0008', name: 'Lateral Movement', short: 'LatM' },
  { id: 'TA0009', name: 'Collection', short: 'Coll' },
  { id: 'TA0010', name: 'Exfiltration', short: 'Exfl' },
  { id: 'TA0011', name: 'Command & Control', short: 'C2' },
  { id: 'TA0040', name: 'Impact', short: 'Impt' },
];

const heatColors: Record<string, string> = {
  critical: 'bg-destructive/60',
  high: 'bg-orange-500/50',
  medium: 'bg-yellow-500/40',
  low: 'bg-primary/30',
  none: 'bg-secondary/20',
};

export function MitreHeatmap({ data, isLoading }: { data?: MitreTactic[]; isLoading: boolean }) {
  const tacticsMap = new Map((data ?? []).map(d => [d.id, d]));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4 text-primary" />MITRE ATT&CK Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {isLoading ? (
          <Skeleton className="h-[120px] w-full" />
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {MITRE_TACTICS.map(tactic => {
              const match = tacticsMap.get(tactic.id);
              const severity = match?.severity ?? 'none';
              const count = match?.techniqueCount ?? 0;
              return (
                <div
                  key={tactic.id}
                  className={`rounded-md p-1.5 text-center transition-all hover:ring-1 hover:ring-primary/30 cursor-default ${heatColors[severity]}`}
                  title={`${tactic.name}: ${count} techniques detected`}
                >
                  <p className="text-[9px] font-medium text-foreground truncate">{tactic.short}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{count}</p>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[9px] text-muted-foreground mt-2 text-center">
          MITRE ATT&CK Framework v14 — Tactics mapped from ingested intelligence
        </p>
      </CardContent>
    </Card>
  );
}
