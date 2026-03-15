import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20',
        secondary:   'bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80',
        destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
        outline:     'text-foreground border border-border',
        success:     'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
        warning:     'bg-orange-500/10 text-orange-500 border border-orange-500/20',
        ghost:       'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
