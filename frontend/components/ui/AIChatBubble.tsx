'use client';
/**
 * AIChatBubble — floating AI assistant, visible on all pages
 * - Collapsed: gold brain icon, bottom-right
 * - Expanded: chat panel, calls /api/ai/chat
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, ChevronDown, Sparkles, RefreshCw } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; content: string }

const INIT: Msg = {
    role: 'assistant',
    content: 'Xin chào! Tôi là AI Assistant của Web3Market 👋\nTôi có thể giúp bạn về:\n• Giá coin & thị trường crypto\n• Gợi ý sản phẩm\n• Hướng dẫn thanh toán & ví Web3\n• RWA token hóa tài sản\n\nHỏi gì đi nào!',
};

const SUGGESTIONS = ['Giá BTC hôm nay?', 'RWA là gì?', 'Cách kết nối MetaMask?', 'Sản phẩm nổi bật'];

export function AIChatBubble() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Msg[]>([INIT]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [unread, setUnread] = useState(0);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    useEffect(() => {
        if (open) setUnread(0);
    }, [open]);

    const send = async (text: string) => {
        const query = text.trim();
        if (!query) return;
        setInput('');
        setError('');
        const next: Msg[] = [...messages, { role: 'user', content: query }];
        setMessages(next);
        setLoading(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const reply: Msg = { role: 'assistant', content: data.reply };
            setMessages(p => [...p, reply]);
            if (!open) setUnread(n => n + 1);
        } catch {
            setError('Không thể kết nối AI. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    };

    const reset = () => setMessages([INIT]);

    return (
        <>
            {/* Bubble button */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setOpen(true)}
                        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#e6a800] shadow-lg shadow-yellow-500/30 flex items-center justify-center hover:scale-110 hover:shadow-yellow-500/50 transition-all"
                        aria-label="Mở AI Chat"
                    >
                        <Bot className="w-7 h-7 text-black" />
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {unread}
                            </span>
                        )}
                        {/* Pulse ring */}
                        <span className="absolute inset-0 rounded-full animate-ping bg-[#f0b90b]/30 pointer-events-none" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat panel */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-6 right-6 z-[9999] w-[360px] max-w-[calc(100vw-24px)] h-[520px] max-h-[calc(100vh-96px)] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden backdrop-blur-xl"
                        style={{ background: 'hsl(var(--card) / 0.98)' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-[#f0b90b]/10 to-transparent flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#e6a800] flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-black" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                    AI Assistant <Sparkles className="w-3.5 h-3.5 text-[#f0b90b]" />
                                </p>
                                <p className="text-[10px] text-emerald-400 font-medium">● Online</p>
                            </div>
                            <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors p-1" title="Xóa lịch sử">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                                <ChevronDown className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3">
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {m.role === 'assistant' && (
                                        <div className="w-6 h-6 rounded-full bg-[#f0b90b]/20 flex items-center justify-center flex-shrink-0 mr-1.5 mt-0.5">
                                            <Bot className="w-3.5 h-3.5 text-[#f0b90b]" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${m.role === 'user'
                                                ? 'bg-[#f0b90b] text-black font-medium rounded-tr-sm'
                                                : 'bg-muted text-foreground rounded-tl-sm'
                                            }`}
                                    >
                                        {m.content}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex justify-start">
                                    <div className="w-6 h-6 rounded-full bg-[#f0b90b]/20 flex items-center justify-center flex-shrink-0 mr-1.5 mt-0.5">
                                        <Bot className="w-3.5 h-3.5 text-[#f0b90b]" />
                                    </div>
                                    <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-muted">
                                        <Loader2 className="w-4 h-4 animate-spin text-[#f0b90b]" />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex justify-center">
                                    <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2 flex items-center gap-2">
                                        {error}
                                        <button onClick={() => send(messages[messages.length - 1]?.content || '')} className="underline">Thử lại</button>
                                    </div>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Suggestions (only show on first load) */}
                        {messages.length === 1 && (
                            <div className="px-3 pb-1 flex gap-1.5 flex-wrap flex-shrink-0">
                                {SUGGESTIONS.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        className="px-2.5 py-1 text-[11px] bg-[#f0b90b]/10 hover:bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/20 rounded-full transition-all font-medium"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <div className="px-3 pb-3 pt-2 border-t border-border flex-shrink-0">
                            <div className="flex items-end gap-2 bg-secondary rounded-xl px-3 py-2 border border-border focus-within:border-[#f0b90b]/40 transition-colors">
                                <textarea
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKey}
                                    placeholder="Hỏi AI..."
                                    rows={1}
                                    className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none resize-none max-h-24"
                                    style={{ lineHeight: '1.4' }}
                                />
                                <button
                                    onClick={() => send(input)}
                                    disabled={!input.trim() || loading}
                                    className="w-7 h-7 flex-shrink-0 rounded-lg bg-[#f0b90b] text-black flex items-center justify-center hover:bg-[#f0b90b]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <p className="text-[9px] text-muted-foreground text-center mt-1.5">AI có thể sai • Không dùng làm lời khuyên đầu tư</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
