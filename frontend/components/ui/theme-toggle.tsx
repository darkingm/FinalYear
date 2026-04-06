'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 animate-pulse" />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setTheme(isDark ? 'light' : 'dark'); }}
      title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 group border ${isDark
          ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
          : 'bg-black/5 border-black/10 hover:bg-black/10 hover:border-black/20'
        }`}
    >
      {isDark ? (
        <Sun
          className="text-yellow-400 group-hover:text-yellow-300 transition-all duration-200 group-hover:rotate-12"
          style={{ width: '16px', height: '16px' }}
        />
      ) : (
        <Moon
          className="text-gray-600 group-hover:text-gray-800 transition-all duration-200 group-hover:-rotate-12"
          style={{ width: '16px', height: '16px' }}
        />
      )}
      <span className="sr-only">{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
