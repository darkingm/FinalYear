'use client';

import { useEffect, useRef } from 'react';
import { useWhaleTrackerStore } from '@/store/whale-tracker-store';
import { fetchAllWalletActivity } from '@/lib/whale-api';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/**
 * WhalePollingProvider — invisible client component that runs the background polling loop.
 * Mounted once in providers.tsx so it runs globally regardless of current page.
 */
export function WhalePollingProvider() {
    const store = useWhaleTrackerStore();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const poll = async () => {
        const { wallets, txHistory, setTxHistory, setLoading, setLastFetched, addAlert } = useWhaleTrackerStore.getState();
        for (const wallet of wallets) {
            try {
                setLoading(wallet.id, true);
                const newTxs = await fetchAllWalletActivity(wallet.address, wallet.chain);
                const prevTxHashes = new Set((txHistory[wallet.id] || []).map((t) => t.hash + t.tokenSymbol));

                // Find truly new transactions
                const brandNew = newTxs.filter((tx) => !prevTxHashes.has(tx.hash + tx.tokenSymbol));

                // Fire alerts for new txs above threshold
                for (const tx of brandNew) {
                    const isSignificant = tx.valueUSD >= wallet.minValueUSD || tx.type === 'SELL';
                    if (isSignificant) {
                        addAlert({
                            walletId: wallet.id,
                            walletLabel: wallet.label,
                            walletAddress: wallet.address,
                            chain: wallet.chain,
                            tx,
                        });
                    }
                }

                setTxHistory(wallet.id, newTxs);
                setLastFetched(wallet.id);
            } catch (err) {
                console.error('[WhalePollingProvider] Error polling wallet', wallet.address, err);
            } finally {
                setLoading(wallet.id, false);
            }

            // Small delay between wallets to avoid rate-limiting
            await new Promise((r) => setTimeout(r, 500));
        }
    };

    useEffect(() => {
        // Initial fetch immediately on mount
        poll();

        // Then poll every 30s
        intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return null; // Renders nothing
}
