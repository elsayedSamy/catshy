import type { SeverityLevel, SourceHealthState } from '@/types';
import { cn } from '@/lib/utils';

const severityConfig: Record<SeverityLevel, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  high: { label: 'High', className: 'bg-warning/20 text-warning border-warning/30' },
  medium: { label: 'Medium', className: 'bg-info/20 text-info border-info/30' },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground border-border' },
  info: { label: 'Info', className: 'bg-secondary text-secondary-foreground border-border' },
};

export function SeverityBadge({ severity, className }: { severity: SeverityLevel; className?: string }) {
  const config = severityConfig[severity];
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  );
}

const healthConfig: Record<SourceHealthState, { label: string; dotClass: string; textClass: string }> = {
  healthy: { label: 'Healthy', dotClass: 'bg-success', textClass: 'text-success' },
  degraded: { label: 'Degraded', dotClass: 'bg-warning', textClass: 'text-warning' },
  error: { label: 'Error', dotClass: 'bg-destructive', textClass: 'text-destructive' },
  disabled: { label: 'Disabled', dotClass: 'bg-muted-foreground', textClass: 'text-muted-foreground' },
  unknown: { label: 'Unknown', dotClass: 'bg-muted-foreground', textClass: 'text-muted-foreground' },
};

export function HealthBadge({ health, className }: { health: SourceHealthState; className?: string }) {
  const config = healthConfig[health];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.textClass, className)}>
      <span className={cn('h-2 w-2 rounded-full', config.dotClass, health === 'healthy' && 'animate-pulse-glow')} />
      {config.label}
    </span>
  );
}

export function ObservableTypeBadge({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary', className)}>
      {type.toUpperCase()}
    </span>
  );
}
