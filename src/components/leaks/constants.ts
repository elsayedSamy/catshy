export const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-destructive/20 text-destructive' },
  { value: 'false_positive', label: 'False Positive', color: 'bg-muted text-muted-foreground' },
  { value: 'resolved', label: 'Resolved', color: 'bg-accent/20 text-accent' },
] as const;
