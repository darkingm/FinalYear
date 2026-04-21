'use client';

import { GlobeBackground } from '@/components/ui/GlobeBackground';
import { CyberGrid } from '@/components/ui/CyberGrid';
import { AIChatBubble } from '@/components/ui/AIChatBubble';

export function ClientChrome() {
  return (
    <>
      <GlobeBackground />
      <CyberGrid />
      <AIChatBubble />
    </>
  );
}
