'use client';

import { cn } from '@/lib/utils/cn';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    dot?: boolean;
    icon?: React.ReactNode;
}

export function Badge({
    children,
    variant = 'default',
    size = 'md',
    className,
    dot = false,
    icon,
}: BadgeProps) {
    const variantStyles = {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        outline: 'border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200',
    };

    const sizeStyles = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base',
    };

    const dotColors = {
        default: 'bg-gray-500',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        outline: 'bg-gray-500',
    };

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 font-medium rounded-full',
                variantStyles[variant],
                sizeStyles[size],
                className
            )}
        >
            {dot && (
                <span className={cn('w-2 h-2 rounded-full animate-pulse', dotColors[variant])} />
            )}
            {icon}
            {children}
        </span>
    );
}

// Status Badge with animated dot
interface StatusBadgeProps {
    status: 'online' | 'offline' | 'busy' | 'away';
    label?: string;
    className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
    const statusConfig = {
        online: { color: 'bg-green-500', label: 'Online', variant: 'success' as const },
        offline: { color: 'bg-gray-500', label: 'Offline', variant: 'default' as const },
        busy: { color: 'bg-red-500', label: 'Busy', variant: 'error' as const },
        away: { color: 'bg-yellow-500', label: 'Away', variant: 'warning' as const },
    };

    const config = statusConfig[status];

    return (
        <Badge variant={config.variant} dot className={className}>
            {label || config.label}
        </Badge>
    );
}

// Order Status Badge
interface OrderStatusBadgeProps {
    status: string;
    className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
    const statusVariant: Record<string, BadgeProps['variant']> = {
        UNPAID: 'warning',
        PAID: 'info',
        PROCESSING: 'info',
        SHIPPED: 'info',
        DELIVERED: 'success',
        COMPLETED: 'success',
        CANCELLED: 'error',
        REFUNDED: 'error',
        DISPUTED: 'error',
    };

    return (
        <Badge variant={statusVariant[status] || 'default'} className={className}>
            {status}
        </Badge>
    );
}
