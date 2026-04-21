'use client';

import { useEffect, useCallback } from 'react';

/**
 * Detects when the browser is running a stale Next.js build and auto-reloads.
 *
 * HOW IT WORKS:
 * Next.js embeds a `buildId` in every page via `__NEXT_DATA__`. After a deploy,
 * the server's buildId changes but the browser may still run old JS from disk
 * cache. This component periodically fetches the server's buildId and compares
 * it with the one baked into the current page. On mismatch → hard reload.
 *
 * This solves the "dead click" problem where a user has an old tab open and
 * clicks a <Link> that silently fails because the client router tries to fetch
 * RSC payloads that no longer match the old bundle.
 *
 * Also triggers a check when the tab becomes visible (user switches back to it),
 * which is the most common scenario.
 */
export function BuildStalenessDetector() {
  const checkBuildId = useCallback(async () => {
    try {
      // Get the buildId that was baked into THIS page when it was served
      const currentBuildId = (window as any).__NEXT_DATA__?.buildId;
      if (!currentBuildId || currentBuildId === 'development') return;

      // Fetch a lightweight page from the server to get its current buildId
      // __nextjs_original-stack-frame is always available and lightweight
      const res = await fetch('/', {
        method: 'HEAD',
        cache: 'no-store',
        headers: { 'Purpose': 'build-check' },
      });

      // The server sends x-nextjs-build-id or we can check via RSC
      // Simpler: fetch the actual page and check __NEXT_DATA__
      const html = await (await fetch('/?_rsc=build-check', {
        cache: 'no-store',
      })).text();

      // Extract buildId from the response
      const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
      if (match && match[1] && match[1] !== currentBuildId) {
        console.info(
          `[BuildStalenessDetector] Build mismatch: running=${currentBuildId}, server=${match[1]}. Reloading...`
        );
        // Prevent infinite loop
        const key = '__build_staleness_reload';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
        }
      }
    } catch {
      // Network error — don't do anything, the user might be offline
    }
  }, []);

  useEffect(() => {
    // Check on visibility change (user switches back to stale tab)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkBuildId();
      }
    }

    // Check every 5 minutes while the tab is open
    const interval = setInterval(checkBuildId, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', onVisibilityChange);

    // Clear the reload flag when the new build loads successfully
    sessionStorage.removeItem('__build_staleness_reload');

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [checkBuildId]);

  return null;
}
