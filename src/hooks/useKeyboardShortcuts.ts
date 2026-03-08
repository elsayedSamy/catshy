import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

/**
 * Global keyboard shortcuts that actually perform actions.
 * Sequence shortcuts (G then D) use a 800ms timeout window.
 */
export function useKeyboardShortcuts(options?: {
  onToggleSidebar?: () => void;
}) {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    // Don't interfere with Ctrl/Meta combos (except ⌘K which CommandPalette handles)
    if (e.ctrlKey || e.metaKey) return;

    const key = e.key.toLowerCase();

    // Handle second key of a sequence
    if (pendingRef.current === 'g') {
      pendingRef.current = null;
      clearTimeout(timerRef.current);
      e.preventDefault();

      const navMap: Record<string, string> = {
        d: '/dashboard',
        f: '/feed',
        s: '/search',
        a: '/assets',
        o: '/sources',
        v: '/vulnerabilities',
        l: '/leaks',
        g: '/graph',
        t: '/global-threat-monitoring',
        i: '/investigations',
        c: '/cases',
        r: '/reports',
        p: '/playbooks',
        n: '/integrations',
        x: '/outputs',
        e: '/settings',
        m: '/admin',
        h: '/history',
        k: '/alerts',
      };

      if (navMap[key]) {
        navigate(navMap[key]);
      }
      return;
    }

    // Single-key shortcuts
    if (key === 'g') {
      pendingRef.current = 'g';
      timerRef.current = setTimeout(() => { pendingRef.current = null; }, 800);
      return;
    }

    if (key === 't' && !e.shiftKey) {
      e.preventDefault();
      toggleTheme();
      return;
    }

    if (key === '[' && options?.onToggleSidebar) {
      e.preventDefault();
      options.onToggleSidebar();
      return;
    }
    if (key === ']' && options?.onToggleSidebar) {
      e.preventDefault();
      options.onToggleSidebar();
      return;
    }
  }, [navigate, toggleTheme, options]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [handleKeyDown]);
}