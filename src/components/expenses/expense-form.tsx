'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { ChevronRight, Info, Loader2, ReceiptText, ScanLine, Wallet } from 'lucide-react'
import { addBatchExpenses } from '@/app/expenses/actions'
import { EmptyState, Panel, Section } from '@/components/app/page'
import { TripPicker } from '@/components/app/trip-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { tripName } from '@/lib/analytics'
import { formatDate, formatINR, titleCase, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Expense, Trip } from '@/lib/types'
import { CategoryGrid } from './category-grid'

/** Per-trip context computed on the server: totals, categories already used, latest entries (newest first). */
export interface TripLog {
  spent: number
  entries: number
  used: string[]
  recent: Expense[]
}

const noSubscribe = () => () => {}
const plural = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`

export function ExpenseForm({
  trips,
  categories,
  logs,
  defaultTripId,
}: {
  trips: Trip[]
  categories: Category[]
  logs: Record<string, TripLog>
  defaultTripId: string
}) {
  const [tripId, setTripId] = useState(defaultTripId)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  // Today in the user's timezone; the server render has no clock to agree on, so it gets '' and hydrates to the real date.
  const today = useSyncExternalStore(noSubscribe, todayISO, () => '')
  const [pickedDate, setPickedDate] = useState('')
  const date = pickedDate || today
  const [driverPaid, setDriverPaid] = useState(false)
  const [note, setNote] = useState('')
  const [saving, startSaving] = useTransition()

  const trip = trips.find(t => t.id === tripId)
  const log = logs[tripId]
  const names = new Map(categories.map(c => [c.id, titleCase(c.name)]))
  const rows = Object.entries(amounts)
    .map(([categoryId, v]) => ({ categoryId, amount: Number(v) }))
    .filter(r => r.amount > 0)
  const total = rows.reduce((s, r) => s + r.amount, 0)

  function save() {
    if (!trip || rows.length === 0) return
    startSaving(async () => {
      try {
        const res = await addBatchExpenses(
          trip.id,
          rows.map(r => ({ ...r, date, notes: note.trim() || undefined, paidBy: driverPaid ? 'driver' : 'owner' })),
        )
        if (!res.success) {
          toast.error(res.error)
          return
        }
        toast.success(`Added ${plural(res.count)} to ${tripName(trip)}`)
        setAmounts({})
        setNote('')
        setDriverPaid(false)
      } catch {
        toast.error('Could not save. Check your internet and try again — your amounts are still here.')
      }
    })
  }

  return (
    <>
      <Link
        href={tripId ? `/scan?trip=${tripId}` : '/scan'}
        className="group flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-3.5 transition hover:bg-primary/10 active:scale-[0.99]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <ScanLine className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Have a register page?</span>
          <span className="block text-xs text-muted-foreground">Scan it — AI reads it and fills everything for you.</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
      </Link>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="px-0.5 text-xs font-medium text-muted-foreground">Trip</p>
          <TripPicker trips={trips} value={tripId} onChange={setTripId} />
          {trip?.status === 'completed' && (
            <p className="flex items-center gap-1.5 px-0.5 text-xs text-warning">
              <Info className="size-3.5 shrink-0" />
              This trip is completed — new entries will change its profit.
            </p>
          )}
        </div>

        <Panel className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="batch-date" className="text-xs font-medium text-muted-foreground">Date</Label>
            <Input
              id="batch-date"
              type="date"
              value={date}
              max={today || undefined}
              onChange={e => setPickedDate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-note" className="text-xs font-medium text-muted-foreground">
              Note <span className="font-normal">(optional, added to each entry)</span>
            </Label>
            <Input
              id="batch-note"
              value={note}
              maxLength={200}
              placeholder="e.g. Ranchi toll, bill no. 42"
              onChange={e => setNote(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={driverPaid}
            onClick={() => setDriverPaid(v => !v)}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-span-2',
              driverPaid && 'border-warning/40 bg-warning/[0.08] hover:bg-warning/[0.12]',
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Wallet className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Paid by driver</span>
              <span className="block text-xs text-muted-foreground">Ticked in the register — the driver paid from his own pocket.</span>
            </span>
            <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', driverPaid ? 'bg-primary' : 'bg-input')}>
              <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform', driverPaid && 'translate-x-4')} />
            </span>
          </button>
        </Panel>

        <div className="space-y-3">
          <div className="px-0.5">
            <h2 className="text-sm font-semibold tracking-tight">Amounts</h2>
            <p className="text-xs text-muted-foreground">Each amount is added as a new entry — nothing already on the trip is replaced.</p>
          </div>
          <CategoryGrid
            categories={categories}
            usedIds={log?.used ?? []}
            amounts={amounts}
            onAmountChange={(id, v) => setAmounts(prev => ({ ...prev, [id]: v }))}
          />
        </div>

        {/* Floats above the mobile tab bar (and its raised Scan button); a plain footer on desktop. */}
        <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 lg:static">
          <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-black/5 lg:shadow-sm">
            {rows.length > 0 && !saving && (
              <Button variant="ghost" className="h-11 rounded-xl px-3 text-muted-foreground" onClick={() => setAmounts({})}>
                Clear
              </Button>
            )}
            <Button className="h-11 flex-1 rounded-xl text-sm active:scale-[0.98]" disabled={!trip || rows.length === 0 || saving} onClick={save}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" /> Adding…
                </>
              ) : rows.length > 0 ? (
                <span className="tabular-nums">Add {plural(rows.length)} · {formatINR(total)}</span>
              ) : (
                'Enter an amount to add'
              )}
            </Button>
          </div>
        </div>
      </div>

      <Section
        title="Recent on this trip"
        action={
          trip && (
            <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              Open trip <ChevronRight className="size-3.5" />
            </Link>
          )
        }
      >
        {log && log.recent.length > 0 ? (
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
              <span className="tabular-nums">{plural(log.entries)} so far</span>
              <span>
                Spent <span className="font-semibold text-expense tabular-nums">{formatINR(log.spent)}</span>
              </span>
            </div>
            <ul className="divide-y">
              {log.recent.map(e => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{(e.category_id && names.get(e.category_id)) || 'Uncategorised'}</span>
                      {e.paid_by === 'driver' && <Badge variant="warning">Driver</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{[formatDate(e.date), e.notes].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(e.amount)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <EmptyState icon={ReceiptText} title="No entries on this trip yet" description="Amounts you add above will show up here." />
        )}
      </Section>
    </>
  )
}
