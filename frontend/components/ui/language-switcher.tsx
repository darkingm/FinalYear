'use client';

import { useState, useEffect } from 'react';
import { Languages } from 'lucide-react';
import i18n from '@/lib/i18n/config';

/**
 * One-tap language toggle (VI ↔ EN).
 *
 * Click swaps to the OTHER language and persists to localStorage. The
 * label intentionally shows the language you'll switch TO so users see
 * the next state, not the current one — matches the "EN" / "VI" pattern
 * common on dual-language sites.
 *
 * `i18n.changeLanguage` triggers re-render of any component using
 * `useTranslation()` / `useClientTranslation()`. We also dispatch a
 * `languagechange` window event for older non-react listeners.
 */
const LANG_META = {
  vi: { flag: '🇻🇳', label: 'Tiếng Việt', code: 'VI' },
  en: { flag: '🇺🇸', label: 'English',     code: 'EN' },
} as const;

type LangCode = keyof typeof LANG_META;

export function LanguageSwitcher() {
  // Default to 'en' on SSR — actual choice is hydrated from localStorage on mount.
  const [lang, setLang] = useState<LangCode>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('preferred-language') : null) as LangCode | null;
    const initial: LangCode = saved === 'vi' || saved === 'en' ? saved : ((i18n.language as LangCode) || 'en');
    setLang(initial);
    if (i18n.language !== initial) i18n.changeLanguage(initial);
    setMounted(true);
  }, []);

  const toggle = async () => {
    const next: LangCode = lang === 'vi' ? 'en' : 'vi';
    await i18n.changeLanguage(next);
    setLang(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', next);
      window.dispatchEvent(new Event('languagechange'));
    }
  };

  // SSR-safe placeholder so hydration sees the same DOM the server emitted.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle language"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground border border-transparent text-sm font-medium"
      >
        <Languages className="w-4 h-4" />
        <span className="text-xs font-bold tracking-wider">EN</span>
      </button>
    );
  }

  const current = LANG_META[lang];
  const next = LANG_META[lang === 'vi' ? 'en' : 'vi'];

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Đang dùng ${current.label} — bấm để chuyển sang ${next.label}`}
      aria-label={`Switch to ${next.label}`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 border border-transparent hover:border-border transition-all text-sm font-medium"
    >
      <Languages className="w-4 h-4" />
      <span className="text-base leading-none" aria-hidden>{current.flag}</span>
      <span className="text-xs font-bold tracking-wider">{current.code}</span>
    </button>
  );
}
