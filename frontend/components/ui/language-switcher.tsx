'use client';

import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLang === 'en' ? 'vi' : 'en';
    i18n.changeLanguage(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-language', newLang);
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
    >
      <Globe className="h-5 w-5" />
      <span className="font-medium uppercase">{currentLang}</span>
    </Button>
  );
}
