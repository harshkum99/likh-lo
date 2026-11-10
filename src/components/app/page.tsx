import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Standard page frame: sticky translucent header on mobile, roomy header on desktop, centred content column.
 * width="narrow" for forms/flows (max-w-2xl), "wide" (default) for dashboards and lists (max-w-6xl).
 */
export function Page({
  title,
  subtitle,
  back,
  actions,
  width = 'wide',
  className,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  back?: string
  actions?: React.ReactNode
  width?: 'wide' | 'narrow'
  className?: string
  children: React.ReactNode
}) {
  const container = cn('mx-auto w-full px-4 sm:px-6 lg:px-8', width === 'wide' ? 'max-w-6xl' : 'max-w-2xl')
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 lg:static lg:border-0 lg:bg-transparent">
        <div className={cn(container, 'flex min-h-14 items-center gap-3 py-2 lg:pt-8 lg:pb-2')}>
          {back && (
            <Link
              href={back}
              aria-label="Back"
              className="-ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-5" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight lg:text-2xl">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground lg:text-sm">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className={cn(container, 'space-y-6 py-4 lg:py-6', className)}>{children}</div>
    </>
  )
}

/** Section heading inside a page: title left, optional action right. */
export function Section({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-0.5">
          {title && <h2 className="text-sm font-semibold tracking-tight text-foreground/90">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** The standard surface: white card, hairline border, soft shadow. */
export function Panel({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm shadow-black/[0.03]', className)} {...props} />
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
