'use client'

import { cn } from '@/lib/utils'

/** iOS-style segmented control / filter pills. Scrolls horizontally on narrow screens. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'default',
  'aria-label': ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly { value: T; label: React.ReactNode; count?: number }[]
  className?: string
  size?: 'sm' | 'default'
  'aria-label'?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1', className)}
    >
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active ? 'bg-card text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-primary/10 text-primary' : 'bg-background/60')}>
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
