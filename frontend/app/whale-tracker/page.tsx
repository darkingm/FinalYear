'use client';

import { useState } from 'react';
import { Activity, Menu, Info } from 'lucide-react';
import { CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { SupportedChain, TokenPair } from '@/store/whale-tracker-store';
import { DexLeftSidebar } from '@/components/whale-tracker/DexLeftSidebar';
import { DexRightSidebar } from '@/components/whale-tracker/DexRightSidebar';
import { DexChart } from '@/components/whale-tracker/DexChart';
import { TrendingTicker } from '@/components/whale-tracker/TrendingTicker';
import { LiveTxFeed } from '@/components/whale-tracker/LiveTxFeed';
import { Header } from '@/components/layout/Header';

export default function WhaleTrackerPage() {
    const [selectedPair, setSelectedPair] = useState<{
        chain: SupportedChain;
        tokenAddress: string;
        pairAddress: string;
        tokenSymbol: string;
        quoteSymbol: string;
        chainId: string;
        pair: TokenPair;
    } | null>(null);

    // Mobile sidebar states
    const [leftOpen, setLeftOpen] = useState(false);
    const [rightOpen, setRightOpen] = useState(false);

    const handleSelectPair = (pair: TokenPair) => {
        setSelectedPair({
            chain: pair.chain,
            tokenAddress: pair.baseToken.address,
            pairAddress: pair.pairAddress,
            tokenSymbol: pair.baseToken.symbol,
            quoteSymbol: pair.quoteToken.symbol,
            chainId: pair.chainId,
            pair,
        });
        setLeftOpen(false); // Close mobile sidebar after selection
    };

    return (
        <>
            <Header />
            <div className="h-[calc(100vh-64px)] flex flex-col bg-[#0b0b12] text-white overflow-hidden">

                {/* ── Trending Ticker ── */}
                <TrendingTicker onSelectPair={handleSelectPair} />

                {/* ── Mobile Top Bar ── */}
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] lg:hidden flex-shrink-0">
                    <button onClick={() => setLeftOpen(true)} className="flex items-center gap-1.5 text-white/50 text-xs">
                        <Menu className="w-4 h-4" /> Search
                    </button>
                    {selectedPair && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{selectedPair.tokenSymbol}</span>
                            <span className="text-[9px] text-white/25">/{selectedPair.quoteSymbol}</span>
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded"
                                style={{ color: CHAIN_LABELS[selectedPair.chain].color, backgroundColor: CHAIN_LABELS[selectedPair.chain].color + '20' }}>
                                {selectedPair.chain}
                            </span>
                        </div>
                    )}
                    <button onClick={() => setRightOpen(true)} className="flex items-center gap-1 text-white/50 text-xs">
                        <Info className="w-4 h-4" /> Info
                    </button>
                </div>

                {/* ── Main 3-Column Layout ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT SIDEBAR — Desktop: always visible, Mobile: overlay */}
                    <div className={`
                        w-60 xl:w-64 flex-shrink-0 
                        hidden lg:flex lg:flex-col
                    `}>
                        <DexLeftSidebar
                            onSelectPair={handleSelectPair}
                            selectedPairAddress={selectedPair?.pairAddress}
                        />
                    </div>

                    {/* Mobile Left Sidebar Overlay */}
                    {leftOpen && (
                        <div className="fixed inset-0 z-50 lg:hidden flex">
                            <div className="w-72 max-w-[85vw] h-full">
                                <DexLeftSidebar
                                    onSelectPair={handleSelectPair}
                                    selectedPairAddress={selectedPair?.pairAddress}
                                    isOpen={true}
                                    onClose={() => setLeftOpen(false)}
                                />
                            </div>
                            <div onClick={() => setLeftOpen(false)} className="flex-1 bg-black/60 backdrop-blur-sm" />
                        </div>
                    )}

                    {/* CENTER — Chart + TX Feed */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        {selectedPair ? (
                            <>
                                {/* Chart area */}
                                <div className="h-[300px] lg:h-[380px] xl:h-[420px] flex-shrink-0 border-b border-white/[0.06]">
                                    <DexChart
                                        chainId={selectedPair.chainId}
                                        pairAddress={selectedPair.pairAddress}
                                        tokenSymbol={selectedPair.tokenSymbol}
                                    />
                                </div>

                                {/* TX Feed (fills remaining space) */}
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <LiveTxFeed
                                        chain={selectedPair.chain}
                                        tokenAddress={selectedPair.tokenAddress}
                                        pairAddress={selectedPair.pairAddress}
                                        tokenSymbol={selectedPair.tokenSymbol}
                                        quoteSymbol={selectedPair.quoteSymbol}
                                        pollSeconds={8}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-white/15 px-4">
                                <div className="relative">
                                    <Activity className="w-20 h-20 opacity-10" />
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500/50 animate-ping" />
                                </div>
                                <div className="text-center space-y-2 max-w-md">
                                    <h2 className="text-xl font-black text-white/20">On-Chain Tracker</h2>
                                    <p className="text-sm text-white/10">
                                        Tìm và chọn token từ sidebar bên trái để xem chart, giao dịch real-time, và thông tin chi tiết
                                    </p>
                                    <div className="flex items-center justify-center gap-4 mt-4">
                                        {(['BSC', 'ETH', 'POLYGON'] as SupportedChain[]).map(c => (
                                            <span key={c} className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                                style={{ color: CHAIN_LABELS[c].color, backgroundColor: CHAIN_LABELS[c].color + '15' }}>
                                                {CHAIN_LABELS[c].name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {/* Quick start hint for mobile */}
                                <button onClick={() => setLeftOpen(true)}
                                    className="lg:hidden text-xs text-violet-400/50 border border-violet-400/20 rounded-lg px-4 py-2 hover:bg-violet-400/5 transition-colors">
                                    Tap to search tokens
                                </button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDEBAR — Desktop only, Mobile: overlay */}
                    <div className="w-64 xl:w-72 flex-shrink-0 hidden xl:flex xl:flex-col">
                        <DexRightSidebar pair={selectedPair?.pair || null} />
                    </div>

                    {/* Mobile Right Sidebar Overlay */}
                    {rightOpen && (
                        <div className="fixed inset-0 z-50 xl:hidden flex justify-end">
                            <div onClick={() => setRightOpen(false)} className="flex-1 bg-black/60 backdrop-blur-sm" />
                            <div className="w-72 max-w-[85vw] h-full">
                                <DexRightSidebar
                                    pair={selectedPair?.pair || null}
                                    isOpen={true}
                                    onClose={() => setRightOpen(false)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
