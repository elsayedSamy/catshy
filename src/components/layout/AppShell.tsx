import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';
import { useState } from 'react';

export function AppShell() {
  const { isDevMode } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div
        className="flex flex-1 flex-col transition-all duration-300"
        style={{ paddingLeft: sidebarCollapsed ? '4rem' : '15rem' }}
      >
        {isDevMode && (
          <div className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/5 px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs font-medium text-warning">Dev Mode — No backend connected. Data is stored locally and will reset on reload.</span>
          </div>
        )}
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
