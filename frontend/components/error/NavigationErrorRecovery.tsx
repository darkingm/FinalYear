'use client';

import { useEffect } from 'react';

/**
 * Catches uncaught chunk-load / navigation errors that happen OUTSIDE the React tree
 * (e.g. Next.js router trying to load a page whose JS chunk hash changed after deploy).
 *
 * These errors escape React ErrorBoundary because they occur in the router's
 * async import() before any component renders. Without this, the click simply
 * does nothing — no error, no navigation — creating a "dead click" UX.
 *
 * Fix: Listen on window.onerror + unhandledrejection, detect chunk errors,
 * and hard-reload (bypassing cache) to get the fresh bundle.
 */
export function NavigationErrorRecovery() {
  useEffect(() => {
    const RELOAD_KEY = '__nav_chunk_reload';

    function isChunkError(msg: string): boolean {
      return (
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('error loading dynamically imported module') ||
        // Next.js specific RSC fetch failure
        msg.includes('Failed to load') ||
        msg.includes('Load failed')
      );
    }

    function handleChunkError() {
      // Prevent infinite reload loop — only reload once per session
      if (sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.removeItem(RELOAD_KEY);
        return;
      }
      sessionStorage.setItem(RELOAD_KEY, '1');
      // Hard reload: bypass all caches
      window.location.reload();
    }

    // 1. Synchronous errors (window.onerror)
    function onError(event: ErrorEvent) {
      const msg = event.message || event.error?.message || '';
      if (isChunkError(msg)) {
        event.preventDefault();
        handleChunkError();
      }
    }

    // 2. Async errors (unhandled promise rejections from dynamic import())
    function onRejection(event: PromiseRejectionEvent) {
      const msg = String(event.reason?.message || event.reason || '');
      if (isChunkError(msg)) {
        event.preventDefault();
        handleChunkError();
      }
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
