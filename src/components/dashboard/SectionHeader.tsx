import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ icon: Icon, title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 pt-2', className)}>
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-sm font-semibold text-foreground tracking-wide">{title}</h2>
      {subtitle && <span className="text-[10px] text-muted-foreground">— {subtitle}</span>}
      <div className="flex-1 h-px bg-border/50 ml-2" />
    </div>
  );
}
