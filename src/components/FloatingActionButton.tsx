import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search, AlertTriangle, FileText, Radio, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  { icon: Search, label: 'Search IOC', path: '/search', color: 'bg-primary text-primary-foreground' },
  { icon: AlertTriangle, label: 'New Alert', path: '/alerts', color: 'bg-destructive text-destructive-foreground' },
  { icon: FileText, label: 'New Report', path: '/reports', color: 'bg-accent text-accent-foreground' },
  { icon: Radio, label: 'Sources', path: '/sources', color: 'bg-secondary text-secondary-foreground' },
  { icon: Bug, label: 'Add CVE', path: '/vulnerabilities', color: 'bg-orange-500 text-white' },
];

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2">
      {/* Action items */}
      <AnimatePresence>
        {open && actions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ delay: i * 0.04, duration: 0.15 }}
            onClick={() => { setOpen(false); navigate(action.path); }}
            className="flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-lg border border-border bg-card hover:bg-secondary/50 transition-colors"
          >
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', action.color)}>
              <action.icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-medium text-foreground whitespace-nowrap">{action.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'glow-cyan'
        )}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.15 }}>
          {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </motion.div>
      </motion.button>
    </div>
  );
}
