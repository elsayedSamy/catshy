import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Moon, Sun, User, LogOut, Command, Check, Trash2, AlertTriangle, CheckCircle2, Info, RefreshCw, Building2 } from 'lucide-react';
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

export function TopBar() {
  const { user, logout, workspaceId, switchWorkspace, isDevMode } = useAuth();
  const [darkMode, setDarkMode] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  // Backend notifications
  const { data: notifData } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const clearAll = useClearNotifications();

  const notifications = notifData?.items ?? [];
  const unreadCount = notifData?.unread_count ?? 0;

  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.id === workspaceId);
  const allWorkspaces = workspaces || [];

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('light', darkMode);
  };

  const handleMarkAsRead = (id: string) => {
    if (isDevMode) {
      setDevNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      markRead.mutate(id);
    }
  };

  const handleMarkAllRead = () => {
    if (isDevMode) {
      setDevNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } else {
      markAllRead.mutate(undefined);
    }
  };

  const handleClearAll = () => {
    if (isDevMode) {
      setDevNotifications([]);
    } else {
      clearAll.mutate(undefined);
    }
  };

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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {allWorkspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 text-xs h-8 border-border bg-secondary/30 hover:bg-secondary/60">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[140px] truncate">{currentWorkspace?.name || allWorkspaces[0]?.name || 'Workspace'}</span>
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

        <button
          onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); }}
          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Command className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search or jump to...</span>
          <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs sm:inline">⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => setDrawerOpen(true)}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={toggleTheme}>
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 text-sm text-muted-foreground hover:text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="hidden md:inline">{user?.name || user?.email || 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Role: <span className="capitalize text-foreground">{user?.role || 'N/A'}</span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />Sign Out
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
                <Bell className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No notifications</p>
                <p className="text-xs mt-1">Alerts and system events will appear here.</p>
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
                        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.timestamp)}</p>
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
