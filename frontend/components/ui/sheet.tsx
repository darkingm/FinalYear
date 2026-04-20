'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Sheet — a slide-over panel built on @radix-ui/react-dialog
 * Supports side='right' (default) or 'left'
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
        )}
        {...props}
    />
));
SheetOverlay.displayName = 'SheetOverlay';

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    side?: 'left' | 'right';
}

const SheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
    <SheetPortal>
        <SheetOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                'fixed z-50 flex h-full flex-col border-l border-border bg-popover/96 shadow-2xl backdrop-blur-xl transition ease-in-out dark:bg-popover/82',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:duration-300 data-[state=open]:duration-300',
                side === 'right'
                    ? 'right-0 top-0 data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right'
                    : 'left-0 top-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
                className
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close className="absolute right-3 top-3 rounded-lg p-1.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 px-4 py-3', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-base font-semibold leading-none tracking-tight text-foreground', className)}
        {...props}
    />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
));
SheetDescription.displayName = 'SheetDescription';

export {
    Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay,
    SheetContent, SheetHeader, SheetTitle, SheetDescription,
};
