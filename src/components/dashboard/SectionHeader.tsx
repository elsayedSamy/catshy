import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ icon: Icon, title, subtitle, className }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn('flex items-center gap-2.5 pt-3 pb-1', className)}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shadow-sm">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-sm font-semibold text-foreground tracking-wide">{title}</h2>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {subtitle}
        </span>
      )}
      <div className="flex-1 h-px bg-gradient-to-r from-border/60 to-transparent ml-2" />
    </motion.div>
  );
}
