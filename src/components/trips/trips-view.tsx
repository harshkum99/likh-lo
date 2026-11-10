'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Plus, Search, Truck } from 'lucide-react'
import { EmptyState, Panel } from '@/components/app/page'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { vehicleOf, type TripSummary } from '@/lib/analytics'
import { formatCompactINR, formatINR, formatNumber, formatPercent, parseISODate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { VehiclePlate } from '@/components/fleet/vehicle-plate'
import { tripDates } from './shared'

export type StatusFilter = 'all' | 'running' | 'completed'
const ALL_VEHICLES = '__all__'
const squash = (s: string) => s.replace(/[\s-]+/g, '').toLowerCase()
const isRunning = (s: TripSummary) => s.trip.status === 'running'
const sum = (rows: TripSummary[], f: (s: TripSummary) => number) => rows.reduce((a, s) => a + f(s), 0)
/** Running trips have no revenue yet (analytics convention), even if a sell amount survived a reopen. */
const soldFor = (s: TripSummary) => (isRunning(s) ? 0 : s.revenue)

export function TripsView({
  summaries,
  initialStatus,
  initialVehicle,
}: {
  summaries: TripSummary[]
  initialStatus: StatusFilter
  initialVehicle: string | null
}) {
  const vehicles = [...new Set(summaries.map(s => vehicleOf(s.trip)))]
  const [status, setStatus] = useState(initialStatus)
  // URLs may carry "JH01AB1234" while the trip says "JH 01 AB 1234".
  const [vehicle, setVehicle] = useState(() => vehicles.find(v => initialVehicle && squash(v) === squash(initialVehicle)) ?? null)
  const [query, setQuery] = useState('')

  if (!summaries.length) {
    return (
      <EmptyState
        icon={Truck}
        title="No trips yet"
        description="Start a trip when a truck leaves with a load. Every rupee spent on the road gets logged against it."
        action={
          <Button render={<Link href="/trips/new" />} nativeButton={false} className="h-11 rounded-xl px-4">
            <Plus /> Start a trip
          </Button>
        }
      />
    )
  }

  const q = squash(query)
  const base = summaries.filter(
    s =>
      (!vehicle || vehicleOf(s.trip) === vehicle) &&
      (!q || squash([s.trip.vehicle_number, s.trip.commodity, s.trip.route].join(' ')).includes(q)),
  )
  const shown = status === 'all' ? base : base.filter(s => s.trip.status === status)
  const running = shown.filter(isRunning)

  const revenue = sum(shown, soldFor)
  const spent = sum(shown, s => s.spent)
  const runningSpent = sum(running, s => s.spent)
  const net = revenue - spent

  const months = new Map<string, TripSummary[]>()
  for (const s of shown) {
    const k = s.trip.start_date.slice(0, 7)
    ;(months.get(k) ?? months.set(k, []).get(k)!).push(s)
  }

  const clear = () => {
    setStatus('all')
    setVehicle(null)
    setQuery('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          aria-label="Trip status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All', count: base.length },
            { value: 'running', label: 'Running', count: base.filter(isRunning).length },
            { value: 'completed', label: 'Completed', count: base.length - base.filter(isRunning).length },
          ]}
          className="self-start"
        />
        <div className="flex gap-2 lg:ml-auto">
          <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Vehicle, load or route"
              aria-label="Search trips"
              className="h-11 rounded-xl bg-card pl-10"
            />
          </div>
          {vehicles.length > 1 && (
            <Select
              value={vehicle ?? ALL_VEHICLES}
              onValueChange={v => setVehicle(v && v !== ALL_VEHICLES ? v : null)}
              items={[{ value: ALL_VEHICLES, label: 'All vehicles' }, ...vehicles.map(v => ({ value: v, label: v }))]}
            >
              <SelectTrigger aria-label="Vehicle" className="h-11 w-36 shrink-0 rounded-xl bg-card px-3 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="end" className="max-h-72 rounded-xl">
                <SelectItem value={ALL_VEHICLES} className="py-2">All vehicles</SelectItem>
                {vehicles.map(v => (
                  <SelectItem key={v} value={v} className="py-2 font-mono text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No trips match"
          description="Try another vehicle or status, or clear the search."
          action={
            <Button variant="outline" onClick={clear} className="h-11 rounded-xl px-4">
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4">
            <Stat label="Trips" value={formatNumber(shown.length)} hint={running.length ? `${running.length} running` : 'All closed'} />
            <Stat label="Revenue" value={formatCompactINR(revenue)} hint="Sold loads" />
            <Stat
              label="Spent"
              value={formatCompactINR(spent)}
              valueClass="text-expense"
              hint={runningSpent && revenue ? `${formatCompactINR(runningSpent)} on running` : 'All expenses'}
            />
            <Stat
              label="Net"
              value={formatCompactINR(net)}
              valueClass={net >= 0 ? 'text-positive' : 'text-negative'}
              hint={revenue > 0 ? `${formatPercent(net / revenue)} margin` : 'Nothing sold yet'}
            />
          </Panel>

          <div className="space-y-6">
            {[...months].map(([month, rows]) => (
              <section key={month} className="space-y-3">
                <div className="flex items-baseline justify-between px-0.5">
                  <h2 className="text-sm font-semibold tracking-tight">
                    {parseISODate(`${month}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} {rows.length === 1 ? 'trip' : 'trips'}
                  </span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {rows.map(s => (
                    <TripCard key={s.trip.id} s={s} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint, valueClass }: { label: string; value: string; hint: string; valueClass?: string }) {
  return (
    <div className="bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tracking-tight tabular-nums', valueClass)}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function TripCard({ s }: { s: TripSummary }) {
  const t = s.trip
  const running = isRunning(s)
  const load = [t.commodity, t.route].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/trips/${t.id}`}
      className="group block rounded-2xl border bg-card p-4 shadow-sm shadow-black/[0.03] transition outline-none hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          {t.vehicle_number ? <VehiclePlate number={t.vehicle_number} className="text-xs" /> : <span className="text-xs text-muted-foreground">No vehicle</span>}
          <p className="truncate font-medium">{load || 'Trip'}</p>
          <p className="text-xs text-muted-foreground">{tripDates(t, s.days)}</p>
        </div>
        {running ? (
          <Badge variant="success">
            <LiveDot />
            Running
          </Badge>
        ) : (
          <Badge variant="muted">Completed</Badge>
        )}
      </div>

      {!running &&
        (s.revenue > 0 ? (
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-positive/15"
            title={`${formatPercent(s.spent / s.revenue)} of revenue spent`}
            aria-hidden
          >
            <div
              className={cn('h-full rounded-full', s.spent > s.revenue ? 'bg-negative' : 'bg-expense')}
              style={{ width: `${Math.min(100, (s.spent / s.revenue) * 100)}%` }}
            />
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-warning">
            <AlertTriangle className="size-3.5" /> Sale amount missing
          </p>
        ))}

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
        {running ? (
          <>
            <Cell label="Spent so far" value={formatINR(s.spent)} tone="text-expense" />
            <Cell label="Per day" value={formatINR(s.costPerDay)} />
            <Cell label="Entries" value={formatNumber(s.entries)} end />
          </>
        ) : (
          <>
            <Cell label="Revenue" value={formatINR(s.revenue)} />
            <Cell label="Spent" value={formatINR(s.spent)} tone="text-expense" />
            <Cell label="Profit" value={formatINR(s.profit)} tone={s.profit >= 0 ? 'text-positive' : 'text-negative'} end />
          </>
        )}
      </dl>
    </Link>
  )
}

function Cell({ label, value, tone, end }: { label: string; value: string; tone?: string; end?: boolean }) {
  return (
    <div className={cn('min-w-0', end && 'text-right')}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-sm font-semibold tabular-nums', tone)}>{value}</dd>
    </div>
  )
}
