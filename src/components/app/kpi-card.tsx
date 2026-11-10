import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/format'
import { Sparkline } from '@/components/app/sparkline'

/**
 * KPI tile: label, headline value, change vs previous period, optional sparkline.
 * `goodWhen` decides whether an increase is green (revenue) or red (expenses).
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  delta,
  goodWhen = 'up',
  hint,
  spark,
  sparkColor = 'var(--color-chart-1)',
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  /** Fractional change vs previous period (0.12 = +12%). null/undefined hides the pill. */
  delta?: number | null
  goodWhen?: 'up' | 'down'
  hint?: React.ReactNode
  spark?: number[]
  sparkColor?: string
  className?: string
}) {
  const showDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  const flat = showDelta && Math.abs(delta) < 0.005
  const good = showDelta && !flat && (delta > 0) === (goodWhen === 'up')
  const DeltaIcon = flat ? Minus : delta && delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className={cn('relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm shadow-black/[0.03]', className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted">
            <Icon className="size-3.5" />
          </span>
        )}
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {showDelta && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium tabular-nums',
                  flat ? 'text-muted-foreground' : good ? 'text-positive' : 'text-negative',
                )}
                aria-label={`${delta > 0 ? 'up' : 'down'} ${formatPercent(Math.abs(delta))} versus previous period`}
              >
                <DeltaIcon className="size-3.5" />
                {formatPercent(Math.abs(delta))}
              </span>
            )}
            {hint && <span className="truncate text-muted-foreground">{hint}</span>}
          </div>
        </div>
        {/* Full-width strip on phones so the value never gets squeezed; beside the value from sm up. */}
        {spark && spark.length > 1 && <Sparkline data={spark} color={sparkColor} className="h-7 w-full shrink-0 sm:h-9 sm:w-20" />}
      </div>
    </div>
  )
}
