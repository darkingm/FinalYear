'use client';

import { motion } from 'framer-motion';
import { Check, Circle, Loader2, AlertTriangle } from 'lucide-react';

export type OrderStatus =
    | 'UNPAID'
    | 'TX_SUBMITTED'
    | 'TX_FAILED'
    | 'ONCHAIN_PENDING'
    | 'ONCHAIN_CONFIRMED'
    | 'PAYMENT_VALIDATED'
    | 'PAID'
    | 'PAID_PAYPAL'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDED'
    | 'DISPUTED';

interface OrderStepperProps {
    currentStatus: OrderStatus;
    paymentMethod?: string | null;
    className?: string;
}

// Steps chung cho mọi đơn hàng
const orderSteps = [
    {
        statuses: ['UNPAID'],
        label: 'Đặt hàng',
        description: 'Đang chờ thanh toán',
        icon: '🛒',
    },
    {
        statuses: ['TX_SUBMITTED', 'ONCHAIN_PENDING', 'ONCHAIN_CONFIRMED', 'PAYMENT_VALIDATED', 'PAID', 'PAID_PAYPAL', 'PROCESSING'],
        label: 'Đã thanh toán',
        description: 'Tiền đang trong Escrow',
        icon: '💳',
    },
    {
        statuses: ['SHIPPED'],
        label: 'Đang giao hàng',
        description: 'Người bán đã gửi hàng',
        icon: '🚚',
    },
    {
        statuses: ['DELIVERED', 'COMPLETED'],
        label: 'Hoàn thành',
        description: 'Giao hàng thành công',
        icon: '✅',
    },
];

const cancelledStatuses = ['CANCELLED', 'REFUNDED', 'DISPUTED', 'TX_FAILED'];

const cancelledMessages: Record<string, { title: string; desc: string; emoji: string }> = {
    CANCELLED: { title: 'Đơn hàng đã hủy', desc: 'Đơn hàng đã bị hủy và không được xử lý.', emoji: '🚫' },
    REFUNDED: { title: 'Đã hoàn tiền', desc: 'Giao dịch đã được hoàn tiền về ví của bạn.', emoji: '↩️' },
    TX_FAILED: { title: 'Giao dịch thất bại', desc: 'Giao dịch blockchain thất bại. Tiền chưa bị trừ. Vui lòng thử lại.', emoji: '⛔' },
    DISPUTED: { title: 'Đang khiếu nại', desc: 'Đơn hàng đang được Admin xem xét. Tiền vẫn đóng băng trong Escrow.', emoji: '⚖️' },
};

export function OrderStepper({ currentStatus, paymentMethod, className }: OrderStepperProps) {
    const isCancelled = cancelledStatuses.includes(currentStatus);

    const getCurrentStepIndex = () => {
        for (let i = 0; i < orderSteps.length; i++) {
            if (orderSteps[i].statuses.includes(currentStatus)) return i;
        }
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();

    // ── Cancelled / Failed / Disputed UI ──────────────────────────────────────
    if (isCancelled) {
        const info = cancelledMessages[currentStatus] || cancelledMessages['CANCELLED'];
        const isDisputed = currentStatus === 'DISPUTED';
        return (
            <div className={className}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-5 rounded-2xl border text-center ${isDisputed
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                        }`}
                >
                    <div className="text-4xl mb-3">{info.emoji}</div>
                    <h3 className={`text-base font-bold mb-1 ${isDisputed ? 'text-amber-300' : 'text-red-300'}`}>
                        {info.title}
                    </h3>
                    <p className="text-sm text-gray-400">{info.desc}</p>
                    {isDisputed && (
                        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-400/80">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Admin sẽ liên hệ trong vòng 24h làm việc
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    // ── Normal progress stepper ───────────────────────────────────────────────
    return (
        <div className={className}>
            {/* Desktop */}
            <div className="hidden md:block">
                <div className="flex items-start justify-between relative">
                    {/* Background track */}
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10" />
                    {/* Progress fill */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStepIndex / (orderSteps.length - 1)) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-[#f0b90b] to-emerald-400"
                    />

                    {orderSteps.map((step, index) => {
                        const isCompleted = index < currentStepIndex;
                        const isCurrent = index === currentStepIndex;

                        return (
                            <div key={step.label} className="relative flex flex-col items-center z-10"
                                style={{ width: `${100 / orderSteps.length}%` }}>
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.08 }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all
                                        ${isCompleted
                                            ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                            : isCurrent
                                                ? 'bg-[#f0b90b] text-black shadow-[#f0b90b]/30'
                                                : 'bg-white/5 border border-white/10 text-gray-500'
                                        }`}
                                >
                                    {isCompleted ? (
                                        <Check className="w-5 h-5" />
                                    ) : isCurrent ? (
                                        currentStepIndex === orderSteps.length - 1
                                            ? <Check className="w-5 h-5" />
                                            : <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <span className="text-xs font-bold">{index + 1}</span>
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.08 + 0.15 }}
                                    className="mt-3 text-center px-1"
                                >
                                    <p className={`font-semibold text-xs ${isCurrent
                                        ? 'text-[#f0b90b]'
                                        : isCompleted
                                            ? 'text-emerald-400'
                                            : 'text-gray-500'
                                        }`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[10px] text-gray-600 mt-0.5 leading-tight max-w-[90px] mx-auto">
                                        {step.description}
                                    </p>
                                </motion.div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2">
                {orderSteps.map((step, index) => {
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                        <motion.div
                            key={step.label}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
                                ${isCurrent ? 'bg-[#f0b90b]/10 border border-[#f0b90b]/20' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                                ${isCompleted
                                    ? 'bg-emerald-500 text-white'
                                    : isCurrent
                                        ? 'bg-[#f0b90b] text-black'
                                        : 'bg-white/5 border border-white/10 text-gray-500'
                                }`}>
                                {isCompleted
                                    ? <Check className="w-4 h-4" />
                                    : isCurrent
                                        ? (currentStepIndex === orderSteps.length - 1
                                            ? <Check className="w-4 h-4" />
                                            : <Loader2 className="w-4 h-4 animate-spin" />)
                                        : <span className="text-xs">{index + 1}</span>
                                }
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${isCurrent ? 'text-[#f0b90b]' : isCompleted ? 'text-emerald-400' : 'text-gray-500'}`}>
                                    {step.label}
                                </p>
                                <p className="text-xs text-gray-600">{step.description}</p>
                            </div>

                            {isCompleted && (
                                <span className="text-[10px] text-emerald-500 font-semibold flex-shrink-0">✓ Xong</span>
                            )}
                            {isCurrent && index < orderSteps.length - 1 && (
                                <span className="text-[10px] text-[#f0b90b] font-semibold flex-shrink-0">Hiện tại</span>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Compact badge for order list ─────────────────────────────────────────────
interface OrderStatusIndicatorProps {
    status: OrderStatus;
    showLabel?: boolean;
}

export function OrderStatusIndicator({ status, showLabel = true }: OrderStatusIndicatorProps) {
    const statusConfig: Record<OrderStatus, { color: string; bgColor: string; label: string; pulse?: boolean }> = {
        UNPAID: { color: 'text-amber-400', bgColor: 'bg-amber-400/10 border border-amber-400/20', label: 'Chờ thanh toán', pulse: true },
        TX_SUBMITTED: { color: 'text-blue-400', bgColor: 'bg-blue-400/10 border border-blue-400/20', label: 'Đang gửi TX', pulse: true },
        TX_FAILED: { color: 'text-red-400', bgColor: 'bg-red-400/10 border border-red-400/20', label: 'TX Thất bại' },
        ONCHAIN_PENDING: { color: 'text-blue-400', bgColor: 'bg-blue-400/10 border border-blue-400/20', label: 'Chờ blockchain', pulse: true },
        ONCHAIN_CONFIRMED: { color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border border-emerald-400/20', label: 'On-chain ✓', pulse: true },
        PAYMENT_VALIDATED: { color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border border-emerald-400/20', label: 'Đã xác nhận' },
        PAID: { color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border border-emerald-400/20', label: 'Đã thanh toán' },
        PAID_PAYPAL: { color: 'text-blue-400', bgColor: 'bg-blue-400/10 border border-blue-400/20', label: 'PayPal ✓' },
        PROCESSING: { color: 'text-purple-400', bgColor: 'bg-purple-400/10 border border-purple-400/20', label: 'Đang xử lý', pulse: true },
        SHIPPED: { color: 'text-indigo-400', bgColor: 'bg-indigo-400/10 border border-indigo-400/20', label: 'Đang giao', pulse: true },
        DELIVERED: { color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border border-emerald-400/20', label: 'Đã giao' },
        COMPLETED: { color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border border-emerald-400/20', label: 'Hoàn thành ✓' },
        CANCELLED: { color: 'text-gray-400', bgColor: 'bg-gray-400/10 border border-gray-400/20', label: 'Đã hủy' },
        REFUNDED: { color: 'text-orange-400', bgColor: 'bg-orange-400/10 border border-orange-400/20', label: 'Hoàn tiền' },
        DISPUTED: { color: 'text-red-400', bgColor: 'bg-red-400/10 border border-red-400/20', label: '⚖️ Khiếu nại', pulse: true },
    };

    const config = statusConfig[status] || statusConfig.UNPAID;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.color}`}>
            {config.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
            {showLabel && config.label}
        </span>
    );
}
