'use client';

import { motion } from 'framer-motion';
import { Check, Circle, Loader2 } from 'lucide-react';

export type OrderStatus =
    | 'UNPAID'
    | 'TX_SUBMITTED'
    | 'ONCHAIN_PENDING'
    | 'ONCHAIN_CONFIRMED'
    | 'PAYMENT_VALIDATED'
    | 'PAID'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REFUNDED'
    | 'DISPUTED';

interface OrderStepperProps {
    currentStatus: OrderStatus;
    className?: string;
}

const orderSteps = [
    { status: ['UNPAID'], label: 'Order Created', description: 'Waiting for payment' },
    { status: ['TX_SUBMITTED', 'ONCHAIN_PENDING'], label: 'Payment Pending', description: 'Transaction submittted' },
    { status: ['ONCHAIN_CONFIRMED', 'PAYMENT_VALIDATED', 'PAID'], label: 'Payment Confirmed', description: 'Payment verified' },
    { status: ['PROCESSING'], label: 'Processing', description: 'Seller preparing order' },
    { status: ['SHIPPED'], label: 'Shipped', description: 'On the way' },
    { status: ['DELIVERED', 'COMPLETED'], label: 'Completed', description: 'Order delivered' },
];

const cancelledStatuses = ['CANCELLED', 'REFUNDED', 'DISPUTED'];

export function OrderStepper({ currentStatus, className }: OrderStepperProps) {
    const isCancelled = cancelledStatuses.includes(currentStatus);

    const getCurrentStepIndex = () => {
        for (let i = 0; i < orderSteps.length; i++) {
            if (orderSteps[i].status.includes(currentStatus)) {
                return i;
            }
        }
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();

    if (isCancelled) {
        return (
            <div className={className}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-center"
                >
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <span className="text-3xl">❌</span>
                    </div>
                    <h3 className="text-xl font-semibold text-red-700 dark:text-red-400 mb-2">
                        Order {currentStatus.toLowerCase().replace('_', ' ')}
                    </h3>
                    <p className="text-red-600/80 dark:text-red-400/80">
                        {currentStatus === 'CANCELLED' && 'This order has been cancelled.'}
                        {currentStatus === 'REFUNDED' && 'Payment has been refunded to your account.'}
                        {currentStatus === 'DISPUTED' && 'This order is under investigation.'}
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className={className}>
            {/* Desktop view */}
            <div className="hidden md:block">
                <div className="flex items-center justify-between relative">
                    {/* Progress line */}
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStepIndex / (orderSteps.length - 1)) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500"
                    />

                    {orderSteps.map((step, index) => {
                        const isCompleted = index < currentStepIndex;
                        const isCurrent = index === currentStepIndex;
                        const isPending = index > currentStepIndex;

                        return (
                            <div key={step.label} className="relative flex flex-col items-center z-10" style={{ width: `${100 / orderSteps.length}%` }}>
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-colors ${isCompleted
                                            ? 'bg-green-500 text-white'
                                            : isCurrent
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                        }`}
                                >
                                    {isCompleted ? (
                                        <Check className="w-5 h-5" />
                                    ) : isCurrent ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Circle className="w-5 h-5" />
                                    )}
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 + 0.2 }}
                                    className="mt-3 text-center"
                                >
                                    <p className={`font-medium text-sm ${isCurrent ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                        {step.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 max-w-[100px]">
                                        {step.description}
                                    </p>
                                </motion.div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile view */}
            <div className="md:hidden space-y-3">
                {orderSteps.map((step, index) => {
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                        <motion.div
                            key={step.label}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                }`}>
                                {isCompleted ? (
                                    <Check className="w-4 h-4" />
                                ) : isCurrent ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <span className="text-xs">{index + 1}</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className={`font-medium text-sm ${isCurrent ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    {step.label}
                                </p>
                                <p className="text-xs text-muted-foreground">{step.description}</p>
                            </div>

                            {isCompleted && (
                                <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">✓ Done</span>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// Compact version for order list
interface OrderStatusIndicatorProps {
    status: OrderStatus;
    showLabel?: boolean;
}

export function OrderStatusIndicator({ status, showLabel = true }: OrderStatusIndicatorProps) {
    const statusConfig: Record<OrderStatus, { color: string; bgColor: string; label: string }> = {
        UNPAID: { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/20', label: 'Unpaid' },
        TX_SUBMITTED: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/20', label: 'Tx Submitted' },
        ONCHAIN_PENDING: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/20', label: 'Pending' },
        ONCHAIN_CONFIRMED: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/20', label: 'Confirmed' },
        PAYMENT_VALIDATED: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/20', label: 'Validated' },
        PAID: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/20', label: 'Paid' },
        PROCESSING: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/20', label: 'Processing' },
        SHIPPED: { color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/20', label: 'Shipped' },
        DELIVERED: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/20', label: 'Delivered' },
        COMPLETED: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/20', label: 'Completed' },
        CANCELLED: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/20', label: 'Cancelled' },
        REFUNDED: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/20', label: 'Refunded' },
        DISPUTED: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/20', label: 'Disputed' },
    };

    const config = statusConfig[status] || statusConfig.UNPAID;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {showLabel && config.label}
        </span>
    );
}
