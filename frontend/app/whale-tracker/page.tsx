'use client';

import { useState, useRef, useEffect } from 'react';
import { Activity, Menu, Info } from 'lucide-react';
import { CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { SupportedChain, TokenPair } from '@/store/whale-tracker-store';
import { DexLeftSidebar } from '@/components/whale-tracker/DexLeftSidebar';
import { DexRightSidebar } from '@/components/whale-tracker/DexRightSidebar';
import { DexChart } from '@/components/whale-tracker/DexChart';
import { LiveTxFeed } from '@/components/whale-tracker/LiveTxFeed';
import { Header } from '@/components/layout/Header';

const LEFT_SIDEBAR_WIDTH_KEY = 'wt_left_sidebar_width';
const LEFT_SIDEBAR_MIN = 220;
const LEFT_SIDEBAR_MAX = 560;
const LEFT_SIDEBAR_DEFAULT = 256;

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

    // Resizable left sidebar (desktop only). Width is persisted in
    // localStorage so the user's choice survives reloads.
    const [leftWidth, setLeftWidth] = useState<number>(LEFT_SIDEBAR_DEFAULT);
    const draggingRef = useRef(false);
    useEffect(() => {
        try {
            const saved = parseInt(localStorage.getItem(LEFT_SIDEBAR_WIDTH_KEY) || '', 10);
            if (Number.isFinite(saved) && saved >= LEFT_SIDEBAR_MIN && saved <= LEFT_SIDEBAR_MAX) {
                setLeftWidth(saved);
            }
        } catch { /* ignore */ }
    }, []);
    const onMouseDown = (e: React.MouseEvent) => {
        draggingRef.current = true;
        e.preventDefault();
        const onMove = (ev: MouseEvent) => {
            if (!draggingRef.current) return;
            const next = Math.max(LEFT_SIDEBAR_MIN, Math.min(LEFT_SIDEBAR_MAX, ev.clientX));
            setLeftWidth(next);
        };
        const onUp = () => {
            draggingRef.current = false;
            try { localStorage.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(leftWidth)); } catch { /* ignore */ }
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };
    // Persist whenever width changes (covers final mouseup writes too)
    useEffect(() => {
        try { localStorage.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(leftWidth)); } catch { /* ignore */ }
    }, [leftWidth]);

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

                    {/* LEFT SIDEBAR — Desktop: resizable, Mobile: overlay */}
                    <div
                        className="hidden lg:flex lg:flex-col flex-shrink-0"
                        style={{ width: `${leftWidth}px` }}
                    >
                        <DexLeftSidebar
                            onSelectPair={handleSelectPair}
                            selectedPairAddress={selectedPair?.pairAddress}
                        />
                    </div>
                    {/* Drag handle for resizing the left sidebar */}
                    <div
                        onMouseDown={onMouseDown}
                        className="hidden lg:block w-1 cursor-col-resize bg-white/[0.04] hover:bg-violet-500/40 active:bg-violet-500/60 transition-colors flex-shrink-0"
                        title="Kéo để thay đổi kích thước"
                    />

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
                                {/* Chart area — smaller default so the TX feed gets more space.
                                    Iframe still supports zoom/timeframe controls inside. */}
                                <div className="h-[220px] lg:h-[280px] xl:h-[320px] flex-shrink-0 border-b border-white/[0.06]">
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
