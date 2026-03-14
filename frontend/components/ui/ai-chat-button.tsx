'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  '💰 So sánh giá sản phẩm',
  '🔒 Escrow hoạt động thế nào?',
  '🪙 Dùng coin nào để mua?',
  '📦 Cách đặt hàng?',
];

const GREETING = `Xin chào! 👋 Tôi là **Web3Market AI** — trợ lý thông minh của bạn.

Tôi có thể giúp:
• Tìm \u0026 so sánh sản phẩm
• Giải thích thanh toán crypto
• Hỗ trợ kỹ thuật
• Điểm tín dụng Web3

Hỏi tôi bất kỳ điều gì! 🚀`;

export function AIChatButton() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: GREETING, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const { isAuthenticated } = useAuth();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setUnread(0); endRef.current?.scrollIntoView({ behavior: 'smooth' }); }
  }, [open, messages]);

  const sendMessage = async (text: string = input.trim()) => {
    if (!text || loading) return;
    setInput('');
    setLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await apiClient.post('/api/ai/chat', { message: text });
      const reply = res.data?.reply || res.data?.message || 'Xin lỗi, tôi không hiểu câu hỏi này.';
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau 🙏',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-16 right-0 w-[360px] bg-card border border-border rounded-2xl shadow-2xl shadow-black/20 overflow-hidden flex flex-col"
            style={{ height: '500px' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#f0b90b] to-[#e6a800] px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-black text-sm">Web3Market AI</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-black/70">Trực tuyến</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    msg.role === 'assistant'
                      ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20'
                      : 'bg-primary/10 border border-primary/20'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot className="w-3.5 h-3.5 text-[#f0b90b]" />
                      : <User className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className={`max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'assistant'
                        ? 'bg-muted text-foreground rounded-tl-sm'
                        : 'bg-[#f0b90b] text-black font-medium rounded-tr-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#f0b90b]/10 border border-[#f0b90b]/20 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-[#f0b90b]" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted flex gap-1.5 items-center">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ repeat: Infinity, duration: 0.7, delay }}
                        className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick prompts */}
            {messages.length <= 2 && (
              <div className="px-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p.slice(2))}
                    className="flex-shrink-0 text-xs px-3 py-1.5 bg-muted border border-border rounded-full text-foreground hover:border-[#f0b90b]/50 hover:text-[#f0b90b] transition-all whitespace-nowrap"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={e => { e.preventDefault(); sendMessage(); }}
              className="flex gap-2 p-3 border-t border-border flex-shrink-0"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isAuthenticated ? 'Hỏi tôi điều gì đó...' : 'Đăng nhập để hỏi AI...'}
                disabled={loading || !isAuthenticated}
                className="flex-1 text-sm bg-muted border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-[#f0b90b]/50 text-foreground placeholder:text-muted-foreground disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !isAuthenticated}
                className="p-2.5 bg-[#f0b90b] hover:bg-[#e6a800] disabled:opacity-40 text-black rounded-xl transition-all shadow shadow-yellow-500/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(v => !v)}
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#f0b90b] to-[#e6a800] text-black shadow-xl shadow-yellow-500/30 flex items-center justify-center transition-shadow hover:shadow-yellow-500/50"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle className="w-6 h-6 fill-black/20" />
            </motion.div>
          )}
        </AnimatePresence>
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background shadow">
            {unread}
          </span>
        )}
      </motion.button>
    </div>
  );
}
