import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'catshy_theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Apply on load before React hydrates
applyTheme(getInitialTheme());

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Listen for changes from other components
    const handler = () => {
      const t = (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
      setThemeState(t);
      applyTheme(t);
    };
    window.addEventListener('storage', handler);
    window.addEventListener('theme-change', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('theme-change', handler);
    };
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
    window.dispatchEvent(new Event('theme-change'));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const isDark = theme === 'dark';

  return { theme, setTheme, toggleTheme, isDark };
}