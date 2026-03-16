'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Drop-in replacement for useTranslation() that prevents React hydration
 * mismatch caused by i18n detecting browser language only on the client.
 *
 * On the server (SSR), i18n defaults to 'en'. On the client, it detects
 * the browser language (e.g., 'vi'). This causes a mismatch if t() returns
 * different strings on server vs client.
 *
 * This hook delays translation until after mount, returning a stable
 * identity function before mount so the server markup is preserved.
 *
 * Usage: Replace `const { t } = useTranslation()` with
 *        `const { t, isMounted } = useClientTranslation()`
 */
export function useClientTranslation(ns?: string) {
    const { t: rawT, i18n } = useTranslation(ns);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Before mount: return key itself (matches server output which uses 'en' defaults)
    // After mount: return the real translated string
    const t = (key: string, options?: any): string => {
        if (!isMounted) {
            // Return English fallback by using the 'en' namespace
            return String(rawT(key, { ...options, lng: 'en' }));
        }
        return String(rawT(key, options));
    };

    return { t, i18n, isMounted };
}
