import { motion } from 'framer-motion';
import { Shield, Plus, Search, Database, Radio, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: 'shield' | 'plus' | 'search' | 'database' | 'radio' | 'file' | 'alert';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

const icons = {
  shield: Shield,
  plus: Plus,
  search: Search,
  database: Database,
  radio: Radio,
  file: FileText,
  alert: AlertTriangle,
};

export function EmptyState({ icon = 'database', title, description, actionLabel, onAction, secondaryLabel, onSecondary }: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 px-6"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse-glow" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-card">
          <Icon className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">{title}</h3>
      <p className="mb-6 max-w-md text-center text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="flex gap-3">
        {actionLabel && onAction && (
          <Button onClick={onAction} className="glow-cyan">
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        )}
        {secondaryLabel && onSecondary && (
          <Button variant="outline" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
