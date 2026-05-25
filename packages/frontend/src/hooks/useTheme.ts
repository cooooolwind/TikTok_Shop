import { useState, useEffect } from 'react';
import { useUIStore } from '../stores/useAppStore';

export function useTheme() {
  const themeMode = useUIStore((s) => s.themeMode);
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    if (themeMode === 'dark') {
      setIsDark(true);
      return;
    }
    if (themeMode === 'light') {
      setIsDark(false);
      return;
    }

    // system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeMode]);

  // Sync with document body for global CSS usage
  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  return { isDark, themeMode };
}
