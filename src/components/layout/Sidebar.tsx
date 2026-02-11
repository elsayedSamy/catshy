import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home, Database, Radio, Rss, Search, Globe, Bell,
  FileSearch, Briefcase, FileText, AlertTriangle,
  Map as MapIcon, Workflow, Shield, Settings, ChevronLeft, Cat
} from 'lucide-react';
import { useState } from 'react';

const navSections = [
  {
    title: 'Core',
    items: [
      { label: 'Mission Control', path: '/dashboard', icon: Home },
      { label: 'Assets', path: '/assets', icon: Database },
      { label: 'Source Catalog', path: '/sources', icon: Radio },
      { label: 'Intel Feed', path: '/feed', icon: Rss },
      { label: 'Global Search', path: '/search', icon: Search },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'Graph Explorer', path: '/graph', icon: Globe },
      { label: 'Alerts & Rules', path: '/alerts', icon: Bell },
      { label: 'Investigations', path: '/investigations', icon: FileSearch },
      { label: 'Cases', path: '/cases', icon: Briefcase },
      { label: 'Reports', path: '/reports', icon: FileText },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { label: 'Leaks Center', path: '/leaks', icon: AlertTriangle },
      { label: '3D Threat Map', path: '/threat-map', icon: MapIcon },
      { label: 'Playbooks', path: '/playbooks', icon: Workflow },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Admin Panel', path: '/admin', icon: Shield },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
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
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navSections.map(section => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="mb-1 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                {section.title}
              </p>
            )}
            {section.items.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 mx-2 rounded-md px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-sidebar-accent text-primary border-l-2 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border-l-2 border-transparent'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
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
