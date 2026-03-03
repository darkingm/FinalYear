'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface ProgressProps {
    value: number; // 0-100
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
    showValue?: boolean;
    animated?: boolean;
    className?: string;
}

export function Progress({
    value,
    max = 100,
    size = 'md',
    variant = 'default',
    showValue = false,
    animated = true,
    className,
}: ProgressProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeStyles = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    const variantStyles = {
        default: 'bg-primary',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
        gradient: 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500',
    };

    return (
        <div className={cn('w-full', className)}>
            <div className={cn('w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden', sizeStyles[size])}>
                <motion.div
                    initial={animated ? { width: 0 } : false}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', variantStyles[variant])}
                />
            </div>
            {showValue && (
                <div className="mt-1 text-sm text-muted-foreground text-right">
                    {Math.round(percentage)}%
                </div>
            )}
        </div>
    );
}

// Circular Progress
interface CircularProgressProps {
    value: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'gradient';
    showValue?: boolean;
    className?: string;
}

export function CircularProgress({
    value,
    max = 100,
    size = 80,
    strokeWidth = 8,
    variant = 'default',
    showValue = true,
    className,
}: CircularProgressProps) {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const variantColors = {
        default: 'stroke-primary',
        success: 'stroke-green-500',
        warning: 'stroke-yellow-500',
        error: 'stroke-red-500',
        gradient: 'stroke-[url(#gradient)]',
    };

    return (
        <div className={cn('relative inline-flex items-center justify-center', className)}>
            <svg width={size} height={size} className="transform -rotate-90">
                {variant === 'gradient' && (
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                    </defs>
                )}
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    className={variantColors[variant]}
                    style={{
                        strokeDasharray: circumference,
                    }}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </svg>
            {showValue && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-semibold">{Math.round(percentage)}%</span>
                </div>
            )}
        </div>
    );
}

// Step Progress (for order flow)
interface StepProgressProps {
    steps: string[];
    currentStep: number;
    className?: string;
}

export function StepProgress({ steps, currentStep, className }: StepProgressProps) {
    return (
        <div className={cn('w-full', className)}>
            <div className="flex items-center justify-between relative">
                {/* Connection line */}
                <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
                <div
                    className="absolute top-4 left-0 h-0.5 bg-primary transition-all duration-500"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => (
                    <div key={step} className="relative flex flex-col items-center">
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{
                                scale: index <= currentStep ? 1 : 0.8,
                                backgroundColor: index <= currentStep ? 'var(--primary)' : 'rgb(229 231 235)',
                            }}
                            className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold z-10 transition-colors',
                                index <= currentStep
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                            )}
                        >
                            {index < currentStep ? '✓' : index + 1}
                        </motion.div>
                        <span className={cn(
                            'mt-2 text-xs font-medium text-center max-w-[80px]',
                            index <= currentStep ? 'text-primary' : 'text-muted-foreground'
                        )}>
                            {step}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
