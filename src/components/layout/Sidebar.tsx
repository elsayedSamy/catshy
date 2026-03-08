import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home, Database, Radio, Rss, Search, Globe, Bell,
  FileSearch, Briefcase, FileText, AlertTriangle,
  Map as MapIcon, Workflow, Shield, Settings, ChevronLeft, Cat, History,
  Plug, ShieldAlert, Webhook, Brain
} from 'lucide-react';

const navSections = [
  {
    title: 'Core',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Intel Feed', path: '/feed', icon: Rss },
      { label: 'History', path: '/history', icon: History },
      { label: 'Global Search', path: '/search', icon: Search },
      { label: 'Assets', path: '/assets', icon: Database },
      { label: 'Sources', path: '/sources', icon: Radio },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Analysis', path: '/ai', icon: Brain },
      { label: 'Vulnerabilities', path: '/vulnerabilities', icon: ShieldAlert },
      { label: 'Leak Hub', path: '/leaks', icon: AlertTriangle },
      { label: 'Graph Explorer', path: '/graph', icon: Globe },
      { label: 'Global Threats', path: '/global-threat-monitoring', icon: MapIcon },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Alerts', path: '/alerts', icon: Bell },
      { label: 'Investigations', path: '/investigations', icon: FileSearch },
      { label: 'Cases', path: '/cases', icon: Briefcase },
      { label: 'Reports', path: '/reports', icon: FileText },
      { label: 'Playbooks', path: '/playbooks', icon: Workflow },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Integrations', path: '/integrations', icon: Plug },
      { label: 'Outputs', path: '/outputs', icon: Webhook },
      { label: 'Admin Panel', path: '/admin', icon: Shield },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )}>
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Cat className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground tracking-tight">
              CAT<span className="text-primary">SHY</span>
            </span>
          </div>
        )}
        {collapsed && <Cat className="mx-auto h-6 w-6 text-primary" />}
        <button onClick={onToggle} className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navSections.map(section => (
          <div key={section.title} className="mb-4">
            {!collapsed && <p className="mb-1 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">{section.title}</p>}
            {section.items.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink key={item.path} to={item.path} className={cn(
                  'flex items-center gap-3 mx-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                  isActive ? 'bg-sidebar-accent text-primary border-l-2 border-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border-l-2 border-transparent'
                )}>
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>
            <span>Command Palette</span>
          </div>
        </div>
      )}
    </aside>
  );
}
