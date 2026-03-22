'use client';

/**
 * Minimal ScrollArea — replaces @radix-ui/react-scroll-area
 * Uses native overflow-y: auto with Tailwind classes.
 */
export function ScrollArea({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border ${className}`}>
            {children}
        </div>
    );
}
