import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Moon, Sun, User, LogOut, Command, Check, Trash2, AlertTriangle, CheckCircle2, Info, RefreshCw, Building2, ChevronRight, Settings, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import {
  useWorkspaces, useNotifications, useMarkNotificationRead,
  useMarkAllNotificationsRead, useClearNotifications,
  type WorkspaceInfo, type AppNotification,
} from '@/hooks/useApi';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const typeIcon = (type: AppNotification['type']) => {
  if (type === 'alert') return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
  if (type === 'system') return <RefreshCw className="h-4 w-4 text-warning shrink-0" />;
  return <Info className="h-4 w-4 text-primary shrink-0" />;
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Simple breadcrumb from current path
function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
          <span className={i === segments.length - 1 ? 'text-foreground font-medium capitalize' : 'capitalize'}>
            {seg.replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </div>
  );
}

interface TopBarProps {
  onMenuClick?: () => void;
  isMobile?: boolean;
}

export function TopBar({ onMenuClick, isMobile }: TopBarProps) {
  const { user, logout, workspaceId, switchWorkspace, isDevMode } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifData } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearAll = useClearNotifications();

  const notifications = notifData?.items ?? [];
  const unreadCount = notifData?.unread_count ?? 0;

  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.id === workspaceId);
  const allWorkspaces = workspaces || [];

  // toggleTheme is from useTheme hook

  const handleMarkAsRead = (id: string) => markRead.mutate(id);
  const handleMarkAllRead = () => markAllRead.mutate(undefined);
  const handleClearAll = () => clearAll.mutate(undefined);

  const handleSwitchWorkspace = async (wsId: string) => {
    if (wsId === workspaceId) return;
    try {
      await switchWorkspace(wsId);
      queryClient.invalidateQueries();
      const ws = allWorkspaces.find(w => w.id === wsId);
      toast.success(`Switched to ${ws?.name || 'workspace'}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to switch workspace');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border/50 bg-background/60 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        {isMobile && onMenuClick && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
        )}

        {allWorkspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-xs h-8 hover:bg-secondary/50">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[120px] truncate font-medium">{currentWorkspace?.name || allWorkspaces[0]?.name || 'Workspace'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allWorkspaces.map(ws => (
                <DropdownMenuItem key={ws.id} onClick={() => handleSwitchWorkspace(ws.id)} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-sm">{ws.name}</span>
                  </div>
                  {ws.id === workspaceId && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="h-4 w-px bg-border/50 hidden md:block" />
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-1">
        {/* Command search */}
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          className="hidden sm:flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground mr-1"
        >
          <Command className="h-3 w-3" />
          <span>Search...</span>
          <kbd className="rounded border border-border/50 bg-background/50 px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setDrawerOpen(true)}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>

        {/* Theme */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={toggleTheme}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-sm text-muted-foreground hover:text-foreground h-8 px-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                <span className="text-xs font-bold text-primary">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden md:inline text-xs font-medium">{user?.name || user?.email || 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs">
              <Settings className="mr-2 h-3.5 w-3.5" />Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive text-xs">
              <LogOut className="mr-2 h-3.5 w-3.5" />Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notifications Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[380px] sm:w-[420px] bg-card border-border p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Notifications</SheetTitle>
              <div className="flex gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                    <Check className="mr-1 h-3 w-3" />Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleClearAll}>
                    <Trash2 className="mr-1 h-3 w-3" />Clear
                  </Button>
                )}
              </div>
            </div>
            <SheetDescription className="text-xs">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bell className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs mt-1 text-muted-foreground/60">Alerts and system events will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-secondary/30 ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex gap-3">
                      {typeIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.timestamp)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </header>
  );
}
