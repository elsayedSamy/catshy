import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/CommandPalette';
import { useState } from 'react';

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div
        className="flex flex-1 flex-col transition-all duration-300"
        style={{ paddingLeft: sidebarCollapsed ? '4rem' : '15rem' }}
      >
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
