'use client';

import { motion } from 'framer-motion';
import { Check, Clock, Package, CreditCard, Truck, Home, AlertCircle } from 'lucide-react';

interface TimelineEvent {
    id: string;
    status: string;
    title: string;
    description?: string;
    timestamp: string;
    isCompleted: boolean;
}

interface OrderTimelineProps {
    orderId: number;
    events?: TimelineEvent[];
}

// Mock events for demonstration - replace with real data
const generateMockEvents = (orderId: number): TimelineEvent[] => [
    {
        id: '1',
        status: 'CREATED',
        title: 'Order Created',
        description: 'Your order has been placed successfully',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        isCompleted: true,
    },
    {
        id: '2',
        status: 'PAID',
        title: 'Payment Confirmed',
        description: 'Payment verified via smart contract',
        timestamp: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
        isCompleted: true,
    },
    {
        id: '3',
        status: 'PROCESSING',
        title: 'Processing',
        description: 'Seller is preparing your order',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        isCompleted: true,
    },
    {
        id: '4',
        status: 'SHIPPED',
        title: 'Shipped',
        description: 'Your order is on the way',
        timestamp: new Date().toISOString(),
        isCompleted: false,
    },
    {
        id: '5',
        status: 'DELIVERED',
        title: 'Delivered',
        description: 'Package delivered to your address',
        timestamp: '',
        isCompleted: false,
    },
];

const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ElementType> = {
        CREATED: Package,
        PAID: CreditCard,
        PROCESSING: Clock,
        SHIPPED: Truck,
        DELIVERED: Home,
        DEFAULT: AlertCircle,
    };
    return icons[status] || icons.DEFAULT;
};

export function OrderTimeline({ orderId, events }: OrderTimelineProps) {
    const timelineEvents = events || generateMockEvents(orderId);

    return (
        <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <div className="space-y-6">
                {timelineEvents.map((event, index) => {
                    const Icon = getStatusIcon(event.status);

                    return (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative flex gap-4"
                        >
                            {/* Icon */}
                            <div
                                className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${event.isCompleted
                                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                    }`}
                            >
                                {event.isCompleted ? (
                                    <Check className="w-5 h-5" />
                                ) : (
                                    <Icon className="w-5 h-5" />
                                )}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 pb-6 ${index === timelineEvents.length - 1 ? 'pb-0' : ''}`}>
                                <div className={`p-4 rounded-lg ${event.isCompleted
                                        ? 'bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30'
                                        : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700'
                                    }`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className={`font-semibold ${event.isCompleted ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                                            }`}>
                                            {event.title}
                                        </h4>
                                        {event.timestamp && (
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(event.timestamp).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    {event.description && (
                                        <p className="text-sm text-muted-foreground">{event.description}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
