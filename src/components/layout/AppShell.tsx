import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/CommandPalette';
import { KeyboardShortcutsModal } from '@/components/KeyboardShortcutsModal';
import { PageTransition } from '@/components/PageTransition';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppShell() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) setMobileSidebarOpen(false);
  }, [isMobile]);

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette />
      <KeyboardShortcutsModal />

      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      )}

      {/* Mobile sidebar sheet */}
      {isMobile && (
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-sidebar-border">
            <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} isMobile onNavigate={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <motion.div
        className="flex flex-1 flex-col min-w-0"
        animate={{ paddingLeft: isMobile ? 0 : sidebarCollapsed ? '4rem' : '15rem' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <TopBar onMenuClick={() => setMobileSidebarOpen(true)} isMobile={isMobile} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-5">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
        </main>
      </motion.div>
    </div>
  );
}