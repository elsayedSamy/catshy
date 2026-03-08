import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/CommandPalette';
import { useState } from 'react';
import { motion } from 'framer-motion';

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <motion.div
        className="flex flex-1 flex-col min-w-0"
        animate={{ paddingLeft: sidebarCollapsed ? '4rem' : '15rem' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-5">
          <Outlet />
        </main>
      </motion.div>
    </div>
  );
}
