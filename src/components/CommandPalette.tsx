import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Home, Shield, Database, Radio, Rss, Globe, BarChart3,
  Bell, FileSearch, Briefcase, FileText, AlertTriangle, Map as MapIcon,
  Workflow, Settings, Command, History, ShieldAlert, Plug, Webhook
} from 'lucide-react';

const commands = [
  { label: 'Dashboard', path: '/dashboard', icon: Home, section: 'Navigate' },
  { label: 'Intel Feed', path: '/feed', icon: Rss, section: 'Navigate' },
  { label: 'History', path: '/history', icon: History, section: 'Navigate' },
  { label: 'Global Search', path: '/search', icon: Search, section: 'Navigate' },
  { label: 'Assets', path: '/assets', icon: Database, section: 'Navigate' },
  { label: 'Source Catalog', path: '/sources', icon: Radio, section: 'Navigate' },
  { label: 'Vulnerabilities', path: '/vulnerabilities', icon: ShieldAlert, section: 'Navigate' },
  { label: 'Leak Hub', path: '/leaks', icon: AlertTriangle, section: 'Navigate' },
  { label: 'Graph Explorer', path: '/graph', icon: Globe, section: 'Navigate' },
  { label: 'Global Threat Monitoring', path: '/global-threat-monitoring', icon: MapIcon, section: 'Navigate' },
  { label: 'Alerts & Rules', path: '/alerts', icon: Bell, section: 'Navigate' },
  { label: 'Investigations', path: '/investigations', icon: FileSearch, section: 'Navigate' },
  { label: 'Cases', path: '/cases', icon: Briefcase, section: 'Navigate' },
  { label: 'Reports', path: '/reports', icon: FileText, section: 'Navigate' },
  { label: 'Playbooks', path: '/playbooks', icon: Workflow, section: 'Navigate' },
  { label: 'Integrations', path: '/integrations', icon: Plug, section: 'Navigate' },
  { label: 'Outputs', path: '/outputs', icon: Webhook, section: 'Navigate' },
  { label: 'Admin Panel', path: '/admin', icon: Shield, section: 'Navigate' },
  { label: 'Settings', path: '/settings', icon: Settings, section: 'Navigate' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = commands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-center border-b border-border px-4">
              <Search className="mr-3 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search..."
                className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
              {filtered.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No results found.</p>
              )}
              {filtered.map(cmd => (
                <button
                  key={cmd.path}
                  onClick={() => handleSelect(cmd.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  <cmd.icon className="h-4 w-4 text-muted-foreground" />
                  {cmd.label}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
