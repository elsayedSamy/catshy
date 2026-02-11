import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/CommandPalette';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette />
      <Sidebar />
      <div className="flex flex-1 flex-col pl-60">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
