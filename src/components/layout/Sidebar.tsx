import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home, Database, Radio, Rss, Search, Globe, Bell,
  FileSearch, Briefcase, FileText, AlertTriangle,
  Map as MapIcon, Workflow, Shield, Settings, ChevronLeft, Cat, History,
  Plug, ShieldAlert, Webhook, Brain, ChevronRight, GitMerge, VolumeX
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useApi';
import { motion, AnimatePresence } from 'framer-motion';

const navSections = [
  {
    title: 'Core',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Intel Feed', path: '/feed', icon: Rss },
      { label: 'History', path: '/history', icon: History },
      { label: 'Vulnerabilities', path: '/vulnerabilities', icon: ShieldAlert },
      { label: 'Global Search', path: '/search', icon: Search },
      { label: 'Assets', path: '/assets', icon: Database },
      { label: 'Sources', path: '/sources', icon: Radio },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Analysis', path: '/ai', icon: Brain },
      { label: 'Correlations', path: '/correlations', icon: GitMerge },
      { label: 'Noise Reduction', path: '/noise-reduction', icon: VolumeX },
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
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggle, isMobile, onNavigate }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { data: notifData } = useNotifications();
  const unreadCount = notifData?.unread_count ?? 0;

  // Badge map: path -> count
  const badges: Record<string, number> = {};
  if (unreadCount > 0) badges['/alerts'] = unreadCount;

  // In mobile mode, never show collapsed state
  const isCollapsed = isMobile ? false : collapsed;

  return (
    <TooltipProvider delayDuration={0}>
      {isMobile ? (
        // Mobile: render as normal div inside Sheet, no fixed positioning
        <div className="flex h-full flex-col bg-sidebar overflow-hidden">
          <SidebarContent
            isCollapsed={false}
            onToggle={onToggle}
            location={location}
            user={user}
            isMobile
            onNavigate={onNavigate}
            badges={badges}
          />
        </div>
      ) : (
        <motion.aside
          animate={{ width: isCollapsed ? 64 : 240 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar overflow-hidden"
        >
          <SidebarContent
            isCollapsed={isCollapsed}
            onToggle={onToggle}
            location={location}
            user={user}
            badges={badges}
          />
        </motion.aside>
      )}
    </TooltipProvider>
  );
}

interface SidebarContentProps {
  isCollapsed: boolean;
  onToggle: () => void;
  location: ReturnType<typeof useLocation>;
  user: any;
  isMobile?: boolean;
  onNavigate?: () => void;
  badges?: Record<string, number>;
}

function SidebarContent({ isCollapsed, onToggle, location, user, isMobile, onNavigate, badges = {} }: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        <AnimatePresence mode="wait">
          {!isCollapsed ? (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Cat className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">
                CAT<span className="text-primary">SHY</span>
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="mini"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Cat className="h-5 w-5 text-primary" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!isCollapsed && !isMobile && (
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && !isMobile && (
        <div className="flex justify-center py-2">
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {navSections.map(section => (
          <div key={section.title} className="mb-3">
            {!isCollapsed ? (
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                {section.title}
              </p>
            ) : (
              <div className="mx-auto my-1.5 h-px w-8 bg-sidebar-border" />
            )}
            {section.items.map(item => {
              const isActive = location.pathname === item.path;
              const badgeCount = badges[item.path];
              const linkContent = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex items-center gap-3 mx-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    isCollapsed && 'justify-center px-0 mx-1',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId={isMobile ? 'sidebar-active-mobile' : 'sidebar-active'}
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="truncate flex-1"
                    >
                      {item.label}
                    </motion.span>
                  )}
                  {/* Badge count */}
                  {badgeCount && badgeCount > 0 && (
                    <span className={cn(
                      'flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground',
                      isCollapsed && 'absolute -top-1 -right-1 h-4 min-w-4 text-[8px]'
                    )}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                  {/* Hover glow for active */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-lg bg-primary/5 pointer-events-none" />
                  )}
                </NavLink>
              );

              if (isCollapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return linkContent;
            })}
          </div>
        ))}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-sidebar-border">
        {!isCollapsed ? (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0">
                <span className="text-xs font-bold text-primary">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user?.name || user?.email || 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">
                  {user?.role || 'Analyst'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground/50">
              <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono">⌘K</kbd>
              <span>Command Palette</span>
              <span className="mx-1">·</span>
              <kbd className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono">?</kbd>
              <span>Shortcuts</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 cursor-default">
                  <span className="text-xs font-bold text-primary">
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {user?.name || user?.email || 'User'}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </>
  );
}