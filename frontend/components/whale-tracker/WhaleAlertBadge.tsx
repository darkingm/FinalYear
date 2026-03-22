'use client';

import { useWhaleTrackerStore } from '@/store/whale-tracker-store';

export function WhaleAlertBadge() {
    const unreadCount = useWhaleTrackerStore((s) => s.unreadCount());

    if (unreadCount === 0) return null;

    return (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-0.5 shadow-lg shadow-red-500/40 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
        </span>
    );
}
