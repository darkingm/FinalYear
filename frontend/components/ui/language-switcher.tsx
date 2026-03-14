'use client';

import { useState, useEffect, useRef } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import i18n from '@/lib/i18n/config';

const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('preferred-language') : null;
    const initial = saved || i18n.language || 'en';
    setCurrentLang(initial);
    if (i18n.language !== initial) {
      i18n.changeLanguage(initial);
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const changeLanguage = async (code: string) => {
    await i18n.changeLanguage(code);
    setCurrentLang(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', code);
      window.dispatchEvent(new Event('languagechange'));
    }
    setOpen(false);
  };

  const current = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[1];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 border border-transparent hover:border-border transition-all text-sm font-medium"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="uppercase text-xs font-bold tracking-wider">{current.code}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/50 py-1.5 z-50 overflow-hidden animate-scale-in"
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                lang.code === currentLang
                  ? 'text-[#f0b90b] bg-[#f0b90b]/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
              }`}
            >
              <span className="text-xl leading-none">{lang.flag}</span>
              <span className="font-medium flex-1 text-left">{lang.label}</span>
              {lang.code === currentLang && (
                <Check className="w-3.5 h-3.5 text-[#f0b90b]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
