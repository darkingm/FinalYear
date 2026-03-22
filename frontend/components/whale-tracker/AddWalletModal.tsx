'use client';

import { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWhaleTrackerStore, CHAIN_LABELS } from '@/store/whale-tracker-store';
import type { SupportedChain, TokenPair } from '@/store/whale-tracker-store';
import { Fish, AlertCircle, Search } from 'lucide-react';
import { TokenSearchPanel } from './TokenSearchPanel';

interface Props { open: boolean; onClose: () => void; }

const CHAINS: { value: SupportedChain; label: string; color: string }[] = [
    { value: 'BSC', label: '🟡 BNB Chain', color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
    { value: 'ETH', label: '🔵 Ethereum', color: 'border-blue-500/50 bg-blue-500/10 text-blue-400' },
    { value: 'POLYGON', label: '🟣 Polygon', color: 'border-purple-500/50 bg-purple-500/10 text-purple-400' },
];

export function AddWalletModal({ open, onClose }: Props) {
    const addWallet = useWhaleTrackerStore((s) => s.addWallet);

    const [address, setAddress] = useState('');
    const [label, setLabel] = useState('');
    const [chain, setChain] = useState<SupportedChain>('BSC');
    const [minUSD, setMinUSD] = useState(10000);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'manual' | 'byToken'>('manual');

    // Token attachment (optional)
    const [selectedToken, setSelectedToken] = useState<TokenPair | null>(null);

    const handleSelectToken = (pair: TokenPair) => {
        setSelectedToken(pair);
        setChain(pair.chain);
        if (!label) setLabel(pair.baseToken.symbol + ' Holder');
        setTab('manual');
    };

    const handleSubmit = () => {
        setError('');
        const trimmed = address.trim();
        if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
            setError('Địa chỉ ví không hợp lệ. Phải bắt đầu bằng 0x và có 42 ký tự.');
            return;
        }
        if (!label.trim()) {
            setError('Vui lòng đặt tên/nhãn cho ví này.');
            return;
        }
        addWallet({
            address: trimmed.toLowerCase(),
            label: label.trim(),
            chain,
            minValueUSD: minUSD,
            tokenAddress: selectedToken?.baseToken.address,
            tokenSymbol: selectedToken?.baseToken.symbol,
            pairAddress: selectedToken?.pairAddress,
        });
        // Reset
        setAddress(''); setLabel(''); setChain('BSC'); setMinUSD(10000);
        setSelectedToken(null); setTab('manual');
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-5 pt-5 pb-0 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <Fish className="w-5 h-5 text-[#8247e5]" />
                        Thêm ví theo dõi cá voi
                    </DialogTitle>
                    <DialogDescription>
                        Thêm địa chỉ ví và tùy chọn gắn với token cụ thể để đếm BUY/SELL chính xác.
                    </DialogDescription>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-3">
                        {(['manual', 'byToken'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'bg-[#8247e5] text-white' : 'text-muted-foreground hover:bg-accent/10'
                                    }`}>
                                {t === 'manual' ? '📝 Nhập thủ công' : '🔍 Tìm theo token'}
                            </button>
                        ))}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* ── Token search tab ─────────────────── */}
                    {tab === 'byToken' && (
                        <TokenSearchPanel onSelectForWallet={handleSelectToken} compact />
                    )}

                    {/* ── Manual tab ───────────────────────── */}
                    {tab === 'manual' && (
                        <>
                            {/* Selected token badge */}
                            {selectedToken && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#8247e5]/10 border border-[#8247e5]/30">
                                    <span className="text-[#8247e5] text-sm font-bold">
                                        {selectedToken.baseToken.symbol}/{selectedToken.quoteToken.symbol}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{selectedToken.dexId}</span>
                                    <button onClick={() => setSelectedToken(null)}
                                        className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
                                </div>
                            )}

                            {/* Address */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Địa chỉ ví <span className="text-red-500">*</span></label>
                                <input type="text"
                                    placeholder="0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE"
                                    value={address} onChange={(e) => setAddress(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8247e5]/50 transition" />
                            </div>

                            {/* Label */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Tên / Nhãn <span className="text-red-500">*</span></label>
                                <input type="text"
                                    placeholder="vd: SIREN Dev Wallet, Binance Hot"
                                    value={label} onChange={(e) => setLabel(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#8247e5]/50 transition" />
                            </div>

                            {/* Chain */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Blockchain</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CHAINS.map((c) => (
                                        <button key={c.value} onClick={() => setChain(c.value)}
                                            className={`px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${chain === c.value ? c.color + ' ring-1 ring-current' : 'border-border text-muted-foreground hover:bg-accent/5'
                                                }`}>{c.label}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Token filter — if no token selected yet */}
                            {!selectedToken && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                    <Search className="w-3.5 h-3.5" />
                                    <button onClick={() => setTab('byToken')} className="hover:text-foreground transition-colors underline-offset-2 hover:underline">
                                        Gắn với token cụ thể để đếm BUY/SELL chính xác →
                                    </button>
                                </div>
                            )}

                            {/* Threshold */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">
                                    Ngưỡng cảnh báo (USD)
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-sm">$</span>
                                    <input type="number" min={0} value={minUSD}
                                        onChange={(e) => setMinUSD(Number(e.target.value))}
                                        className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#8247e5]/50 transition" />
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {[1000, 10000, 50000, 100000].map((v) => (
                                        <button key={v} onClick={() => setMinUSD(v)}
                                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${minUSD === v ? 'border-[#8247e5] bg-[#8247e5]/10 text-[#8247e5]' : 'border-border text-muted-foreground'
                                                }`}>
                                            ${v.toLocaleString()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-500 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className="px-5 py-4 border-t border-border gap-2 flex-shrink-0">
                    <Button variant="outline" onClick={onClose}>Hủy</Button>
                    {tab === 'manual' && (
                        <Button onClick={handleSubmit} className="bg-[#8247e5] hover:bg-[#8247e5]/90 text-white">
                            <Fish className="w-4 h-4 mr-1.5" /> Thêm theo dõi
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
