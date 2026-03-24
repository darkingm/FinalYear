'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { SupportedChain, TokenPair } from '@/store/whale-tracker-store';
import { TokenSearchPanel } from '@/components/whale-tracker/TokenSearchPanel';
import { TokenInfoPanel } from '@/components/whale-tracker/TokenInfoPanel';
import { LiveTxFeed } from '@/components/whale-tracker/LiveTxFeed';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function WhaleTrackerPage() {
    const [selectedPair, setSelectedPair] = useState<{
        chain: SupportedChain;
        tokenAddress: string;
        pairAddress: string;
        tokenSymbol: string;
        quoteSymbol: string;
    } | null>({
        chain: 'BSC',
        tokenAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
        pairAddress: '0xF45cd219aEF8618A92BAa7aD848364a158a24F33',   // PancakeSwap V2 BTCB/WBNB
        tokenSymbol: 'BTCB',
        quoteSymbol: 'WBNB',
    });

    const handleSelectPair = (pair: TokenPair) => {
        setSelectedPair({
            chain: pair.chain,
            tokenAddress: pair.baseToken.address,
            pairAddress: pair.pairAddress,
            tokenSymbol: pair.baseToken.symbol,
            quoteSymbol: pair.quoteToken.symbol,
        });
    };

    return (
        <>
            <Header />
            <div className="min-h-screen bg-[#060612] text-white flex flex-col">

                {/* ── Top bar ─────────────────────────────── */}
                <div className="border-b border-white/8 bg-black/20 backdrop-blur-sm sticky top-0 z-20">
                    <div className="max-w-[1800px] mx-auto px-4 py-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Activity className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white leading-none">On-Chain Tracker</h1>
                            <p className="text-[9px] text-white/30 mt-0.5">Live · BSC · ETH · Polygon</p>
                        </div>
                        {selectedPair && (
                            <div className="ml-4 flex items-center gap-2">
                                <span className="text-sm font-black text-white">
                                    {selectedPair.tokenSymbol}
                                    <span className="text-white/30 font-normal">/{selectedPair.quoteSymbol}</span>
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                        color: CHAIN_LABELS[selectedPair.chain].color,
                                        background: `${CHAIN_LABELS[selectedPair.chain].color}20`,
                                        border: `1px solid ${CHAIN_LABELS[selectedPair.chain].color}40`,
                                    }}>
                                    {selectedPair.chain}
                                </span>
                                <span className="flex items-center gap-1 text-[9px] text-emerald-400/80">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    LIVE
                                </span>
                                <span className="text-[8px] font-mono text-white/15">
                                    {selectedPair.pairAddress.slice(0, 8)}…{selectedPair.pairAddress.slice(-6)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Main layout: 2-col ───────────────────── */}
                <div className="flex-1 flex overflow-hidden max-w-[1800px] mx-auto w-full">

                    {/* LEFT: Token search + info (fixed width) */}
                    <div className="w-72 xl:w-80 flex-shrink-0 border-r border-white/8 flex flex-col overflow-hidden">
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-3">

                                <div>
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                                        🔍 Tìm Token / Pool
                                    </p>
                                    <TokenSearchPanel
                                        compact
                                        onSelectForWallet={handleSelectPair}
                                        onSelectRow={handleSelectPair}
                                        selectedPairAddress={selectedPair?.pairAddress}
                                    />
                                </div>

                                {selectedPair && (
                                    <div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                                            📋 Token Info
                                        </p>
                                        <TokenInfoPanel
                                            tokenAddress={selectedPair.tokenAddress}
                                            tokenSymbol={selectedPair.tokenSymbol}
                                            chain={selectedPair.chain}
                                        />
                                    </div>
                                )}

                                {!selectedPair && (
                                    <div className="rounded-xl border border-dashed border-white/10 p-5 text-center space-y-2">
                                        <Activity className="w-7 h-7 text-white/15 mx-auto" />
                                        <p className="text-[10px] text-white/25">
                                            Tìm và chọn token để xem giao dịch live
                                        </p>
                                        <p className="text-[9px] text-white/15">Ví dụ: SIREN, CAKE, BNB…</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT: Full-width TX Feed */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {selectedPair ? (
                            <LiveTxFeed
                                chain={selectedPair.chain}
                                tokenAddress={selectedPair.tokenAddress}
                                pairAddress={selectedPair.pairAddress}
                                tokenSymbol={selectedPair.tokenSymbol}
                                quoteSymbol={selectedPair.quoteSymbol}
                                pollSeconds={8}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-white/15">
                                <Activity className="w-14 h-14 opacity-20" />
                                <div className="text-center">
                                    <p className="text-base font-bold">Live Transaction Feed</p>
                                    <p className="text-sm mt-1 text-white/10">
                                        Chọn token ở bên trái để xem giao dịch realtime
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
