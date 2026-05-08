'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Inline dual-language helper for components that have many short labels.
 *
 * Usage:
 *   const tr = useDualText();
 *   <span suppressHydrationWarning>{tr('Mua sắm', 'Shopping')}</span>
 *
 * SSR-safe: returns the English string before client mount, then switches
 * to whichever language i18n is currently set to. Subscribes to
 * `useTranslation()` so the component re-renders when LanguageSwitcher
 * toggles `i18n.language`.
 */
export function useDualText(): (vi: string, en: string) => string {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (vi: string, en: string) => {
    if (!mounted) return en;
    return i18n.language?.startsWith('vi') ? vi : en;
  };
}
