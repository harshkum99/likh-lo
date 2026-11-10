'use client'

import { useState, useTransition } from 'react'
import { CircleCheck, Flag, Loader2, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { closeTrip, reopenTrip } from '@/app/trips/actions'
import { LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import type { TripSummary } from '@/lib/analytics'
import { formatINR, formatNumber, formatPercent, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The one big number for the trip: spend while running, net profit once sold. Owns close / reopen. */
export function TripHero({ summary: s }: { summary: TripSummary }) {
  const running = s.trip.status === 'running'
  const [pending, startTransition] = useTransition()

  async function reopen() {
    const ok = await confirmDialog({
      title: 'Reopen this trip?',
      description: 'It moves back to Running and its end date is cleared. The sale amount is kept.',
      confirmLabel: 'Reopen',
    })
    if (!ok) return
    startTransition(async () => {
      const res = await reopenTrip(s.trip.id)
      if (res.success) toast.success('Trip reopened')
      else toast.error(res.error)
    })
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-hero-from to-hero-to p-5 text-white shadow-lg shadow-primary/20 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-2xl" />
      <p className="relative flex items-center gap-2 text-sm font-medium text-white/80">
        {running ? (
          <>
            <LiveDot /> Running · Day {s.days}
          </>
        ) : (
          <>
            <CircleCheck className="size-4" /> Completed · {s.days} {s.days === 1 ? 'day' : 'days'}
          </>
        )}
      </p>

      {running ? (
        <div className="relative mt-5">
          <p className="text-sm text-white/70">Spent so far</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatINR(s.spent)}</p>
          <p className="mt-2 text-sm text-white/75 tabular-nums">
            {formatINR(s.costPerDay)}/day · {formatNumber(s.entries)} {s.entries === 1 ? 'entry' : 'entries'}
          </p>
          <CloseTrip summary={s} />
        </div>
      ) : (
        <div className="relative mt-5">
          <p className="text-sm text-white/70">{s.profit >= 0 ? 'Net profit' : 'Net loss'}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatINR(s.profit)}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
            {s.margin === null ? (
              'No sale amount yet — edit the trip to add it'
            ) : (
              <>
                {s.profit >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {formatPercent(s.margin)} margin
              </>
            )}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-white/10 p-3.5">
            <div>
              <dt className="text-xs text-white/70">Revenue</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(s.revenue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/70">Spent</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(s.spent)}</dd>
            </div>
          </dl>
          <Button
            variant="ghost"
            onClick={reopen}
            disabled={pending}
            className="mt-4 h-11 w-full rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Reopen trip
          </Button>
        </div>
      )}
    </div>
  )
}

function CloseTrip({ summary: s }: { summary: TripSummary }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pending, startTransition] = useTransition()
  const sell = Number(amount) || 0
  const profit = sell - s.spent

  function onOpenChange(next: boolean) {
    if (next) {
      setAmount(s.trip.sell_amount ? String(s.trip.sell_amount) : '')
      setEndDate(todayISO())
    }
    setOpen(next)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(sell > 0)) return toast.error('Enter what the load sold for')
    startTransition(async () => {
      const res = await closeTrip(s.trip.id, sell, endDate)
      if (!res.success) return void toast.error(res.error)
      setOpen(false)
      toast.success('Trip closed', `${profit >= 0 ? 'Profit' : 'Loss'} of ${formatINR(Math.abs(profit))}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button className="mt-5 h-11 w-full rounded-xl bg-white text-primary shadow-md hover:bg-white/90 active:scale-[0.98]" />}
      >
        <Flag /> Close trip
      </DialogTrigger>
      <DialogContent className="gap-5 rounded-3xl p-5 sm:max-w-md sm:p-6">
        <div className="space-y-1.5 pr-8">
          <DialogTitle className="text-lg font-semibold">Close trip</DialogTitle>
          <DialogDescription>Enter what the load sold for. You can still add late expenses afterwards.</DialogDescription>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="close-sell" className="text-xs font-medium text-muted-foreground">
              Sold for
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl text-muted-foreground">₹</span>
              <Input
                id="close-sell"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                required
                autoFocus
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 rounded-xl pl-9 text-2xl font-semibold tabular-nums md:text-2xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close-end" className="text-xs font-medium text-muted-foreground">
              End date
            </Label>
            <Input
              id="close-end"
              type="date"
              required
              min={s.trip.start_date}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-11 rounded-xl px-3.5"
            />
          </div>

          <dl className="space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Spent on this trip</dt>
              <dd className="font-medium text-expense tabular-nums">{formatINR(s.spent)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t pt-2">
              <dt className="font-medium">{sell > 0 ? (profit >= 0 ? 'You make' : 'You lose') : 'Profit'}</dt>
              <dd className={cn('text-lg font-semibold tabular-nums', sell > 0 && (profit >= 0 ? 'text-positive' : 'text-negative'))}>
                {sell > 0 ? (
                  <>
                    {formatINR(Math.abs(profit))}
                    <span className="ml-1.5 text-xs font-medium">{formatPercent(profit / sell)}</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>

          <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl">
            {pending && <Loader2 className="animate-spin" />}
            Close trip
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
