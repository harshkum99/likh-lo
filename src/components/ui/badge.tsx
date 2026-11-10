import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        success: 'bg-positive/12 text-positive',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-negative/12 text-negative',
        expense: 'bg-expense/12 text-expense',
        muted: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

/** Pulsing dot for "running" states. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2', className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-positive" />
    </span>
  )
}
