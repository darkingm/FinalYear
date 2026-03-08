'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, CheckCircle, XCircle, AlertTriangle, Upload,
    Send, Shield, MessageCircle, ChevronRight, Copy, Check,
    Camera, Paperclip, Loader2, RefreshCw, User,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://103.20.96.79:3001';

interface P2POrder {
    p2p_order_id: number; order_ref: string; status: string;
    fiat_amount: string; token_amount: string; price_per_unit: string;
    fiat_currency: string; symbol: string; payment_method: string;
    expires_at: string; payment_paid_at: string; confirmed_at: string;
    buyer_id: number; seller_id: number;
    buyer_username: string; buyer_avatar: string;
    seller_username: string; seller_avatar: string;
    payment_proof: string[];
    offer_payment_methods: string[]; offer_terms: string; auto_release: boolean;
}

interface Message { message_id: number; sender_id: number; message: string; attachments: string[]; created_at: string; username: string; avatar_url: string; is_system: boolean; }

const STATUS_META: Record<string, { label: string; color: string; icon: any; desc: string }> = {
    PENDING: { label: 'Awaiting Payment', color: 'text-amber-400', icon: Clock, desc: 'Buyer needs to transfer funds' },
    PAID: { label: 'Payment Sent', color: 'text-blue-400', icon: CheckCircle, desc: 'Seller reviewing payment proof' },
    CONFIRMED: { label: 'Confirmed', color: 'text-green-400', icon: CheckCircle, desc: 'Crypto is being released' },
    RELEASED: { label: 'Completed', color: 'text-green-400', icon: CheckCircle, desc: 'Transaction completed' },
    CANCELLED: { label: 'Cancelled', color: 'text-red-400', icon: XCircle, desc: 'Order was cancelled' },
    DISPUTED: { label: 'In Dispute', color: 'text-orange-400', icon: AlertTriangle, desc: 'Admin reviewing dispute' },
    RESOLVED_BUYER: { label: 'Resolved (Buyer)', color: 'text-green-400', icon: CheckCircle, desc: 'Resolved in buyer\'s favor' },
    RESOLVED_SELLER: { label: 'Resolved (Seller)', color: 'text-violet-400', icon: CheckCircle, desc: 'Resolved in seller\'s favor' },
    TIMEOUT: { label: 'Timed Out', color: 'text-red-400', icon: XCircle, desc: 'Order expired without payment' },
};

export default function P2POrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [order, setOrder] = useState<P2POrder | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [chatMsg, setChatMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [myUserId, setMyUserId] = useState<number | null>(null);
    const [countdown, setCountdown] = useState('');

    // Action states
    const [marking, setMarking] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [disputing, setDisputing] = useState(false);
    const [showDisputeForm, setShowDisputeForm] = useState(false);
    const [disputeReason, setDisputeReason] = useState('PAYMENT_NOT_RECEIVED');
    const [disputeDesc, setDisputeDesc] = useState('');
    const [proofFiles, setProofFiles] = useState<File[]>([]);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [error, setError] = useState('');

    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    const fetchOrder = useCallback(async () => {
        if (!token) { router.push('/login'); return; }
        try {
            const [orderRes, msgRes] = await Promise.all([
                fetch(`${API}/api/p2p/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API}/api/p2p/orders/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const [od, md] = await Promise.all([orderRes.json(), msgRes.json()]);
            if (od.success) setOrder(od.data);
            if (md.success) setMessages(md.data);
        } finally { setLoading(false); }
    }, [id, token, router]);

    useEffect(() => { fetchOrder(); }, [fetchOrder]);

    // Get current user id from token
    useEffect(() => {
        if (!token) return;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setMyUserId(payload.user_id);
        } catch { }
    }, [token]);

    // Countdown timer
    useEffect(() => {
        if (!order?.expires_at || order.status !== 'PENDING') return;
        const tick = () => {
            const diff = new Date(order.expires_at).getTime() - Date.now();
            if (diff <= 0) { setCountdown('Expired'); return; }
            const m = Math.floor(diff / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [order]);

    // Auto-scroll chat
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(fetchOrder, 30_000);
        return () => clearInterval(interval);
    }, [fetchOrder]);

    const sendMessage = async () => {
        if (!chatMsg.trim() || !token) return;
        setSending(true);
        try {
            const res = await fetch(`${API}/api/p2p/orders/${id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ message: chatMsg }),
            });
            const d = await res.json();
            if (d.success) { setMessages(prev => [...prev, d.data]); setChatMsg(''); }
        } finally { setSending(false); }
    };

    const handleMarkPaid = async () => {
        if (!token || !order) return;
        setUploadingProof(true);
        setError('');
        let proofUrls: string[] = [];

        // Upload proof files first
        if (proofFiles.length > 0) {
            const formData = new FormData();
            proofFiles.forEach(f => formData.append('files', f));
            try {
                const uploadRes = await fetch(`${API}/api/p2p/orders/${id}/proof`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });
                const ud = await uploadRes.json();
                if (ud.success) proofUrls = ud.urls;
            } catch (err) { setError('Failed to upload proof images'); setUploadingProof(false); return; }
        }

        setUploadingProof(false);
        setMarking(true);
        try {
            const res = await fetch(`${API}/api/p2p/orders/${id}/paid`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ payment_method: order.payment_method, proof_urls: proofUrls }),
            });
            const d = await res.json();
            if (d.success) { setOrder(d.data); setProofFiles([]); await fetchOrder(); }
            else setError(d.message);
        } finally { setMarking(false); }
    };

    const handleConfirm = async () => {
        if (!token) return;
        setConfirming(true);
        try {
            const res = await fetch(`${API}/api/p2p/orders/${id}/confirm`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` },
            });
            const d = await res.json();
            if (d.success) { setOrder(d.data); await fetchOrder(); }
            else setError(d.message);
        } finally { setConfirming(false); }
    };

    const handleCancel = async () => {
        if (!token || !confirm('Cancel this order?')) return;
        setCancelling(true);
        try {
            const res = await fetch(`${API}/api/p2p/orders/${id}/cancel`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reason: 'Cancelled by user' }),
            });
            const d = await res.json();
            if (d.success) setOrder(d.data);
            else setError(d.message);
        } finally { setCancelling(false); }
    };

    const handleDispute = async () => {
        if (!token || !disputeDesc.trim()) { setError('Please describe the issue'); return; }
        setDisputing(true);
        try {
            const res = await fetch(`${API}/api/p2p/orders/${id}/dispute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ reason: disputeReason, description: disputeDesc, evidence_urls: [] }),
            });
            const d = await res.json();
            if (d.success) { setShowDisputeForm(false); await fetchOrder(); }
            else setError(d.message);
        } finally { setDisputing(false); }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
    );
    if (!order) return <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-white/40">Order not found</div>;

    const isBuyer = myUserId === order.buyer_id;
    const isSeller = myUserId === order.seller_id;
    const meta = STATUS_META[order.status] || { label: order.status, color: 'text-white/60', icon: Clock, desc: '' };
    const StatusIcon = meta.icon;

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 text-sm">
                    <button onClick={() => router.push('/p2p')} className="text-white/40 hover:text-white transition-colors">P2P</button>
                    <ChevronRight className="w-4 h-4 text-white/20" />
                    <button onClick={() => router.push('/p2p/orders')} className="text-white/40 hover:text-white transition-colors">My Orders</button>
                    <ChevronRight className="w-4 h-4 text-white/20" />
                    <span className="text-white/70 font-mono">{order.order_ref}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left: Order Info + Actions */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Status Card */}
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <StatusIcon className={`w-6 h-6 ${meta.color}`} />
                                    <div>
                                        <p className={`font-bold text-lg ${meta.color}`}>{meta.label}</p>
                                        <p className="text-sm text-white/40">{meta.desc}</p>
                                    </div>
                                </div>
                                {order.status === 'PENDING' && (
                                    <div className={`text-2xl font-mono font-bold tabular-nums ${countdown === 'Expired' ? 'text-red-400' : 'text-amber-400'}`}>
                                        {countdown}
                                    </div>
                                )}
                            </div>

                            {/* Step progress */}
                            <div className="flex items-center gap-2">
                                {['PENDING', 'PAID', 'CONFIRMED', 'RELEASED'].map((s, i) => {
                                    const steps = ['PENDING', 'PAID', 'CONFIRMED', 'RELEASED'];
                                    const curIdx = steps.indexOf(order.status);
                                    const done = i < curIdx || order.status === 'RELEASED';
                                    const active = i === curIdx;
                                    return (
                                        <div key={s} className="flex items-center gap-2 flex-1">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                        ${done ? 'bg-green-500 text-white' : active ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/30'}`}>
                                                {done ? '✓' : i + 1}
                                            </div>
                                            {i < 3 && <div className={`h-0.5 flex-1 ${done ? 'bg-green-500' : 'bg-white/10'}`} />}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between text-xs text-white/30">
                                <span>Created</span><span>Paid</span><span>Confirmed</span><span>Completed</span>
                            </div>
                        </div>

                        {/* Order Details */}
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                            <h3 className="font-semibold text-white/80">Order Details</h3>
                            {[
                                { label: 'Order Ref', value: order.order_ref, mono: true },
                                { label: 'You Pay', value: `${parseFloat(order.fiat_amount).toLocaleString()} ${order.fiat_currency}` },
                                { label: 'You Receive', value: `${parseFloat(order.token_amount).toFixed(6)} ${order.symbol}` },
                                { label: 'Price', value: `${parseFloat(order.price_per_unit).toLocaleString()} ${order.fiat_currency}/${order.symbol}` },
                                { label: 'Payment', value: order.payment_method },
                                { label: 'Counterparty', value: isBuyer ? `@${order.seller_username} (Seller)` : `@${order.buyer_username} (Buyer)` },
                            ].map(({ label, value, mono }) => (
                                <div key={label} className="flex justify-between gap-4">
                                    <span className="text-sm text-white/40 flex-shrink-0">{label}</span>
                                    <span className={`text-sm text-right ${mono ? 'font-mono text-violet-300' : 'text-white/80'}`}>{value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Payment Proof (if paid) */}
                        {order.payment_proof?.length > 0 && (
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                <h3 className="font-semibold text-white/80 flex items-center gap-2">
                                    <Camera className="w-4 h-4 text-blue-400" />Payment Proof
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {order.payment_proof.map((url, i) => (
                                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-24 h-24 rounded-xl overflow-hidden border border-white/10 hover:border-violet-500 transition-all">
                                            <img src={url} alt="Proof" className="w-full h-full object-cover" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
                                </div>
                            )}

                            {/* Buyer: Upload proof + Mark paid */}
                            {isBuyer && order.status === 'PENDING' && (
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                    <h3 className="font-semibold text-white/80">Step 1 — Complete Payment</h3>
                                    <p className="text-sm text-white/50">Transfer <span className="text-amber-300 font-bold">{parseFloat(order.fiat_amount).toLocaleString()} {order.fiat_currency}</span> via <span className="text-white">{order.payment_method}</span> to the seller, then upload proof below.</p>
                                    {order.offer_terms && <p className="text-xs text-white/40 bg-white/5 rounded-xl p-3">{order.offer_terms}</p>}

                                    <label className="block w-full p-4 border-2 border-dashed border-white/15 rounded-xl hover:border-violet-500/50 transition-colors cursor-pointer text-center">
                                        <Upload className="w-6 h-6 mx-auto mb-2 text-white/30" />
                                        <p className="text-sm text-white/50">Upload payment screenshot / receipt</p>
                                        <p className="text-xs text-white/30 mt-1">PNG, JPG, PDF up to 10MB each</p>
                                        <input
                                            type="file"
                                            multiple accept="image/*,.pdf"
                                            className="hidden"
                                            onChange={e => setProofFiles(Array.from(e.target.files || []))}
                                        />
                                    </label>
                                    {proofFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {proofFiles.map((f, i) => (
                                                <span key={i} className="px-3 py-1 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-xs flex items-center gap-1">
                                                    <Check className="w-3 h-3" />{f.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={handleMarkPaid}
                                        disabled={marking || uploadingProof}
                                        className="w-full py-3.5 rounded-xl font-bold text-sm bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                    >
                                        {(marking || uploadingProof) ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : <><CheckCircle className="w-4 h-4" />I've Paid — Notify Seller</>}
                                    </button>
                                    <button onClick={handleCancel} disabled={cancelling} className="w-full py-2.5 rounded-xl text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all disabled:opacity-40">
                                        {cancelling ? 'Cancelling…' : 'Cancel Order'}
                                    </button>
                                </div>
                            )}

                            {/* Seller: Confirm payment */}
                            {isSeller && order.status === 'PAID' && (
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                    <h3 className="font-semibold text-white/80">Step 2 — Verify & Release</h3>
                                    <p className="text-sm text-white/50">Buyer has marked payment as sent. Check your payment account and confirm receipt to release crypto.</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={handleConfirm}
                                            disabled={confirming}
                                            className="py-3.5 rounded-xl font-bold text-sm bg-green-500/20 border border-green-500/30 text-green-300 hover:bg-green-500/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                        >
                                            {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                            Confirm & Release
                                        </button>
                                        <button
                                            onClick={() => setShowDisputeForm(true)}
                                            className="py-3.5 rounded-xl font-bold text-sm bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2"
                                        >
                                            <AlertTriangle className="w-4 h-4" />Open Dispute
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Dispute form */}
                            {(isBuyer && order.status === 'PAID') && (
                                <button onClick={() => setShowDisputeForm(true)} className="w-full py-2.5 rounded-xl text-sm text-orange-400/80 border border-orange-500/20 hover:bg-orange-500/10 transition-all">
                                    Problem? Open Dispute
                                </button>
                            )}

                            <AnimatePresence>
                                {showDisputeForm && (
                                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                        className="p-5 rounded-2xl bg-orange-500/8 border border-orange-500/20 space-y-4">
                                        <h3 className="font-semibold text-orange-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Open Dispute</h3>
                                        <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none">
                                            <option value="PAYMENT_NOT_RECEIVED">Payment Not Received</option>
                                            <option value="PAYMENT_WRONG_AMOUNT">Wrong Amount Paid</option>
                                            <option value="SELLER_NOT_RELEASING">Seller Not Releasing Crypto</option>
                                            <option value="FAKE_PROOF">Fake Payment Proof</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                        <textarea value={disputeDesc} onChange={e => setDisputeDesc(e.target.value)}
                                            placeholder="Describe the issue in detail..."
                                            rows={3}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none resize-none focus:border-orange-500" />
                                        <div className="flex gap-3">
                                            <button onClick={() => setShowDisputeForm(false)} className="flex-1 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:bg-white/5">Cancel</button>
                                            <button onClick={handleDispute} disabled={disputing || !disputeDesc.trim()}
                                                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 disabled:opacity-40">
                                                {disputing ? 'Submitting…' : 'Submit Dispute'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Right: Chat */}
                    <div className="lg:col-span-2 flex flex-col h-[600px]">
                        <div className="p-4 rounded-t-2xl bg-white/5 border border-white/10 border-b-0 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-violet-400" />
                            <span className="font-semibold text-sm">Order Chat</span>
                            <button onClick={fetchOrder} className="ml-auto text-white/30 hover:text-white/60 transition-colors">
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 bg-white/3 border border-white/10 border-y-0 space-y-3">
                            {messages.map(msg => {
                                const isMe = msg.sender_id === myUserId;
                                if (msg.is_system) return (
                                    <div key={msg.message_id} className="flex justify-center">
                                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/8 text-xs text-white/40">{msg.message}</span>
                                    </div>
                                );
                                return (
                                    <div key={msg.message_id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-violet-300">
                                            {msg.username?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
                        ${isMe ? 'bg-violet-600/30 border border-violet-500/30 text-white' : 'bg-white/8 border border-white/10 text-white/80'}`}>
                                                {msg.message}
                                            </div>
                                            {msg.attachments?.length > 0 && (
                                                <div className="flex gap-1 flex-wrap">
                                                    {msg.attachments.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-white/10 hover:border-violet-500 transition-all">
                                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            <span className="text-xs text-white/25">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="p-3 rounded-b-2xl bg-white/5 border border-white/10 border-t-0">
                            <div className="flex gap-2">
                                <input
                                    value={chatMsg}
                                    onChange={e => setChatMsg(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                    placeholder="Type a message…"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-violet-500 transition-colors"
                                    disabled={['RELEASED', 'CANCELLED', 'TIMEOUT'].includes(order.status)}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={sending || !chatMsg.trim() || ['RELEASED', 'CANCELLED', 'TIMEOUT'].includes(order.status)}
                                    className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 flex items-center justify-center transition-all flex-shrink-0"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
