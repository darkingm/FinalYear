'use client';

import { useEffect, useState } from 'react';

export function useDesktopLightMode(minWidth = 1024) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const viewportQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
    const pointerQuery = window.matchMedia('(pointer: fine)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setEnabled(!isDark && viewportQuery.matches && pointerQuery.matches && !motionQuery.matches);
    };

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    viewportQuery.addEventListener('change', update);
    pointerQuery.addEventListener('change', update);
    motionQuery.addEventListener('change', update);
    update();

    return () => {
      observer.disconnect();
      viewportQuery.removeEventListener('change', update);
      pointerQuery.removeEventListener('change', update);
      motionQuery.removeEventListener('change', update);
    };
  }, [minWidth]);

  return enabled;
}
