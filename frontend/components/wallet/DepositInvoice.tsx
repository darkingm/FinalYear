'use client';

import { QRCodeSVG } from 'qrcode.react';
import {
    QrCode, Copy, AlertCircle, CheckCircle, Loader2, Clock, X,
    ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

export interface ChainToken {
    token_id: number;
    symbol: string;
    token_address: string;
    decimals: number;
    chain_id: number;
}

export interface UserWalletLite {
    wallet_db_id: number;
    chain_type: string;
    chain_id: number | null;
    address: string;
    label: string | null;
    is_verified?: boolean;
}

export interface DepositIntent {
    intent_id: number;
    chain_id: number;
    token_id: number;
    expected_amount: string | number;
    from_address: string;
    to_address: string;
    reference_code: string;
    status: 'pending' | 'matched' | 'expired' | 'cancelled';
    expires_at: string;
    created_at: string;
    payment_uri: string;
    token_symbol: string;
    token_decimals: number;
    token_address: string;
    chain_info: { name: string; type: string; symbol?: string };
    matched_tx_hash?: string | null;
    deposit_status?: string | null;
    deposit_confirmations?: number | null;
}

const SUPPORTED_CHAINS = [
    { id: 31337, name: 'Hardhat (test)', icon: '🧪' },
    { id: 84532, name: 'Base Sepolia', icon: '🔵' },
    { id: 80002, name: 'Polygon Amoy', icon: '🟣' },
    { id: 97, name: 'BSC Testnet', icon: '🟡' },
    { id: 421614, name: 'Arbitrum Sepolia', icon: '🔷' },
];

function fmtCountdown(ms: number): string {
    if (ms <= 0) return '00:00';
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function shortAddr(a: string) {
    if (!a) return '';
    return `${a.slice(0, 8)}...${a.slice(-6)}`;
}

interface DepositInvoiceCardProps {
    activeIntent: DepositIntent | null;
    now: number;
    tokens: ChainToken[];
    tokenLoading: boolean;
    wallets: UserWalletLite[];
    formChainId: number;
    formTokenId: number | '';
    formAmount: string;
    formFromWalletId: number | '';
    creating: boolean;
    onChainChange: (id: number) => void;
    onTokenChange: (id: number | '') => void;
    onAmountChange: (v: string) => void;
    onWalletChange: (id: number | '') => void;
    onSubmit: () => void;
    onCancel: () => void;
    onClose: () => void;
    onCopy: (text: string, label: string) => void;
}

export function DepositInvoiceCard(props: DepositInvoiceCardProps) {
    const {
        activeIntent, now, tokens, tokenLoading, wallets,
        formChainId, formTokenId, formAmount, formFromWalletId, creating,
        onChainChange, onTokenChange, onAmountChange, onWalletChange,
        onSubmit, onCancel, onClose, onCopy,
    } = props;

    const verifiedEvmWallets = wallets.filter(w => w.chain_type === 'evm' && w.is_verified);

    const showForm = !activeIntent
        || activeIntent.status === 'expired'
        || activeIntent.status === 'cancelled';

    if (showForm) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="font-bold text-base flex items-center gap-2 mb-4">
                    <QrCode className="w-5 h-5 text-[#f0b90b]" />
                    Tạo phiếu nạp tiền
                </h3>

                {verifiedEvmWallets.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-semibold">Chưa có ví đã xác thực</p>
                        <p className="text-sm mt-1">Liên kết MetaMask trước để có thể nạp tiền.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Chain */}
                        <div>
                            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Mạng</label>
                            <select
                                value={formChainId}
                                onChange={e => onChainChange(Number(e.target.value))}
                                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                            >
                                {SUPPORTED_CHAINS.map(c => (
                                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Token */}
                        <div>
                            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Token</label>
                            <select
                                value={formTokenId}
                                onChange={e => onTokenChange(e.target.value ? Number(e.target.value) : '')}
                                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                                disabled={tokenLoading}
                            >
                                <option value="">{tokenLoading ? 'Đang tải...' : (tokens.length === 0 ? 'Không có token nào' : 'Chọn token')}</option>
                                {tokens.map(t => (
                                    <option key={t.token_id} value={t.token_id}>
                                        {t.symbol} ({t.decimals} decimals)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Số lượng</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="VD: 100"
                                value={formAmount}
                                onChange={e => onAmountChange(e.target.value.replace(/[^0-9.]/g, ''))}
                                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-mono"
                            />
                        </div>

                        {/* From wallet */}
                        <div>
                            <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Ví gửi (đã xác thực)</label>
                            <select
                                value={formFromWalletId}
                                onChange={e => onWalletChange(e.target.value ? Number(e.target.value) : '')}
                                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-xl text-sm"
                            >
                                <option value="">Chọn ví gửi</option>
                                {verifiedEvmWallets.map(w => (
                                    <option key={w.wallet_db_id} value={w.wallet_db_id}>
                                        {w.label || 'Ví'} — {shortAddr(w.address)}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Hệ thống chỉ ghi nhận nạp tiền <strong>đến từ ví này</strong>. Gửi từ ví khác sẽ không được tự động khớp.
                            </p>
                        </div>

                        <button
                            onClick={onSubmit}
                            disabled={creating}
                            className="w-full py-2.5 bg-[#f0b90b] hover:bg-[#f0b90b]/90 disabled:opacity-50 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                            {creating ? 'Đang tạo...' : 'Tạo QR nạp tiền'}
                        </button>

                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-400/90">
                                Mỗi phiếu chỉ có hiệu lực <strong>15 phút</strong>. Gửi đúng <strong>token</strong>, đúng <strong>mạng</strong>, đúng <strong>số lượng</strong> từ ví đã chọn.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Active intent — show QR
    const expiresMs = new Date(activeIntent.expires_at).getTime() - now;
    const isMatched = activeIntent.status === 'matched';
    const requiredConfs = activeIntent.chain_id === 31337 ? 0
        : [97, 80002, 421614, 84532].includes(activeIntent.chain_id) ? 1 : 12;
    const confsNow = activeIntent.deposit_confirmations ?? 0;
    const depositStatus = activeIntent.deposit_status;
    const fullyConfirmed = depositStatus === 'confirmed';

    return (
        <div className="bg-card border border-border rounded-2xl p-6 relative">
            <button
                onClick={onClose}
                title="Đóng"
                className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center">
                {/* Status badge */}
                <div className={`mb-4 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    fullyConfirmed
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : isMatched
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-amber-500/15 text-amber-400'
                }`}>
                    {fullyConfirmed ? <CheckCircle className="w-3.5 h-3.5" />
                        : isMatched ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Clock className="w-3.5 h-3.5" />}
                    {fullyConfirmed
                        ? 'Đã xác nhận trên blockchain'
                        : isMatched
                            ? `Đã phát hiện giao dịch — ${confsNow}/${requiredConfs} xác nhận`
                            : `Đang chờ — hết hạn sau ${fmtCountdown(expiresMs)}`}
                </div>

                {/* QR */}
                {!isMatched && expiresMs > 0 ? (
                    <div className="p-4 bg-white rounded-2xl shadow-xl mb-5 ring-4 ring-[#f0b90b]/10">
                        <QRCodeSVG value={activeIntent.payment_uri} size={220} bgColor="#ffffff" fgColor="#000000" level="M" />
                    </div>
                ) : (
                    <div className="p-4 bg-muted rounded-2xl mb-5 w-[252px] h-[252px] flex items-center justify-center">
                        {fullyConfirmed
                            ? <CheckCircle className="w-20 h-20 text-emerald-400" />
                            : isMatched
                                ? <Loader2 className="w-20 h-20 text-blue-400 animate-spin" />
                                : <AlertCircle className="w-20 h-20 text-red-400" />}
                    </div>
                )}

                {/* Amount */}
                <div className="text-center mb-3">
                    <p className="text-xs text-muted-foreground">Gửi chính xác</p>
                    <p className="text-2xl font-black mt-0.5">
                        {Number(activeIntent.expected_amount).toString()}{' '}
                        <span className="text-[#f0b90b]">{activeIntent.token_symbol}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">trên {activeIntent.chain_info?.name || `chain ${activeIntent.chain_id}`}</p>
                </div>

                {/* Fields */}
                <div className="w-full space-y-2 mb-4">
                    <FieldRow label="Địa chỉ nhận" value={activeIntent.to_address} mono onCopy={() => onCopy(activeIntent.to_address, 'địa chỉ nhận')} />
                    <FieldRow label="Ví gửi" value={activeIntent.from_address} mono />
                    <FieldRow label="Mã tham chiếu" value={activeIntent.reference_code} onCopy={() => onCopy(activeIntent.reference_code, 'mã tham chiếu')} />
                    {activeIntent.matched_tx_hash && (
                        <FieldRow label="Mã giao dịch" value={activeIntent.matched_tx_hash} mono onCopy={() => onCopy(activeIntent.matched_tx_hash!, 'mã giao dịch')} />
                    )}
                </div>

                {/* Actions */}
                <div className="w-full flex gap-2">
                    {!isMatched && (
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2 text-sm font-semibold border border-border hover:bg-muted rounded-xl transition-colors"
                        >
                            Huỷ phiếu
                        </button>
                    )}
                    {fullyConfirmed && (
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 text-sm font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-colors"
                        >
                            Hoàn tất
                        </button>
                    )}
                </div>

                {/* Warning */}
                {!isMatched && (
                    <div className="w-full mt-3 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-400/90">
                            QR theo chuẩn EIP-681: nếu ví hỗ trợ, sẽ tự động điền địa chỉ + token + số lượng. Một số ví chỉ đọc địa chỉ — khi đó nhập token và số lượng thủ công.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function FieldRow({
    label, value, mono, onCopy,
}: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
    return (
        <div className="p-3 bg-background border border-border rounded-xl">
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">{label}</p>
            <div className="flex items-start gap-2">
                <p className={`flex-1 text-xs break-all ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</p>
                {onCopy && (
                    <button onClick={onCopy} className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

interface PastIntentsListProps {
    intents: DepositIntent[];
    onResume: (i: DepositIntent) => void;
    onCancel: (id: number) => void;
}

export function PastIntentsList({ intents, onResume, onCancel }: PastIntentsListProps) {
    const [expanded, setExpanded] = useState(false);
    if (intents.length === 0) return null;

    return (
        <div className="bg-card border border-border rounded-2xl">
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
            >
                <span className="font-bold text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Phiếu nạp khác ({intents.length})
                </span>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expanded && (
                <div className="border-t border-border divide-y divide-border">
                    {intents.map(i => {
                        const statusColor =
                            i.status === 'matched' ? 'text-blue-400 bg-blue-500/10'
                            : i.status === 'expired' ? 'text-muted-foreground bg-muted'
                            : i.status === 'cancelled' ? 'text-muted-foreground bg-muted'
                            : 'text-amber-400 bg-amber-500/10';
                        const statusText =
                            i.status === 'matched' ? (i.deposit_status === 'confirmed' ? 'Đã xác nhận' : 'Đã khớp')
                            : i.status === 'expired' ? 'Hết hạn'
                            : i.status === 'cancelled' ? 'Đã huỷ'
                            : 'Đang chờ';
                        return (
                            <div key={i.intent_id} className="p-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm">
                                            {Number(i.expected_amount)} {i.token_symbol}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                                            {statusText}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        {i.chain_info?.name || `chain ${i.chain_id}`} · {i.reference_code} ·{' '}
                                        {new Date(i.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {i.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => onResume(i)}
                                                className="px-2 py-1 text-[11px] font-bold text-[#f0b90b] hover:bg-[#f0b90b]/10 rounded-lg"
                                            >
                                                Mở
                                            </button>
                                            <button
                                                onClick={() => onCancel(i.intent_id)}
                                                className="px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                            >
                                                Huỷ
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
