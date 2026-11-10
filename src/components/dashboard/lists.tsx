'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, BadgeIndianRupee, ChevronRight, CirclePause, HandCoins, Hourglass, Plus, Receipt, ScanLine, Truck } from 'lucide-react'
import { EmptyState, Panel } from '@/components/app/page'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UNASSIGNED, change, tripName, vehicleOf, type Attention, type CategoryStat, type TripSummary, type VehicleStat } from '@/lib/analytics'
import { formatDate, formatINR, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Expense, Trip } from '@/lib/types'
import { VehiclePlate } from '@/components/fleet/vehicle-plate'
import { GROUP_COLOR, groupOf } from './groups'

const tone = (n: number) => (n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : '')

function Muted({ children }: { children: React.ReactNode }) {
  return <Panel className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</Panel>
}

// ---------------------------------------------------------------- top categories

function SpendDelta({ cur, prev }: { cur: number; prev: number }) {
  const d = change(cur, prev)
  if (d === null) return <span className="w-12 text-right text-[11px] text-muted-foreground">{prev === 0 ? 'New' : ''}</span>
  const up = d > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  // More spend is bad.
  return (
    <span
      className={cn('inline-flex w-12 items-center justify-end gap-0.5 text-xs font-medium tabular-nums', up ? 'text-negative' : 'text-positive')}
      aria-label={`${up ? 'up' : 'down'} ${formatPercent(Math.abs(d))} versus previous period`}
    >
      <Icon className="size-3.5 shrink-0" />
      {formatPercent(Math.abs(d))}
    </span>
  )
}

export function TopCategories({ categories, hasPrev }: { categories: CategoryStat[]; hasPrev: boolean }) {
  const top = categories.filter(c => c.amount > 0).slice(0, 6)
  if (!top.length) return <Muted>No spend in this period</Muted>
  return (
    <Panel className="divide-y">
      {top.map(c => (
        <div key={c.id} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">{c.name}</span>
            <span className="text-sm font-semibold tabular-nums">{formatINR(c.amount)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, c.share * 100)}%`, background: GROUP_COLOR[groupOf(c.group)] }} />
            </div>
            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{formatPercent(c.share)}</span>
            {hasPrev && <SpendDelta cur={c.amount} prev={c.prevAmount} />}
          </div>
        </div>
      ))}
    </Panel>
  )
}

// ---------------------------------------------------------------- running trips

function DriverLine({ balance }: { balance: number }) {
  const b = Math.round(balance)
  if (!b) return null
  return (
    <p className={cn('mt-3 flex items-center gap-1.5 text-xs', b > 0 ? 'text-warning' : 'text-muted-foreground')}>
      <HandCoins className="size-3.5" />
      {b > 0 ? `Owed to driver ${formatINR(b)}` : `Driver holds ${formatINR(-b)}`}
    </p>
  )
}

export function RunningTrips({ running, newTripHref }: { running: TripSummary[]; newTripHref: string }) {
  if (!running.length) {
    return (
      <EmptyState
        icon={Truck}
        title="No trucks on the road"
        description="Start a trip when a truck leaves with a load, then log spend against it."
        action={
          <Button render={<Link href={newTripHref} />} nativeButton={false} className="h-11 rounded-xl px-4">
            <Plus />
            Start a trip
          </Button>
        }
        className="bg-card/50 py-10"
      />
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {running.map(s => {
        const t = s.trip
        const load = [t.commodity, t.route].filter(Boolean).join(' · ')
        return (
          <Panel key={t.id} className="flex flex-col overflow-hidden">
            <Link href={`/trips/${t.id}`} className="flex-1 p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1.5">
                  {t.vehicle_number?.trim() ? <VehiclePlate number={t.vehicle_number} /> : <p className="font-semibold tracking-tight">No vehicle</p>}
                  <p className="truncate text-sm text-muted-foreground">{load || `Started ${formatDate(t.start_date)}`}</p>
                </div>
                <Badge variant="success" className="shrink-0">
                  <LiveDot />
                  Day {s.days}
                </Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Spent so far</dt>
                  <dd className="mt-0.5 font-semibold text-expense tabular-nums">{formatINR(s.spent)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Per day</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(s.costPerDay)}</dd>
                </div>
              </dl>
              <DriverLine balance={s.driverBalance} />
            </Link>
            <div className="grid grid-cols-2 divide-x border-t">
              <Link
                href={`/expenses?trip=${t.id}`}
                className="flex h-11 items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 active:bg-primary/10"
              >
                <Plus className="size-4" />
                Add expense
              </Link>
              <Link
                href={`/scan?trip=${t.id}`}
                className="flex h-11 items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 active:bg-primary/10"
              >
                <ScanLine className="size-4" />
                Scan
              </Link>
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- fleet leaderboard

export function FleetLeaderboard({ vehicles }: { vehicles: VehicleStat[] }) {
  // The "no vehicle" bucket only earns a row when it had activity in the period.
  const top = vehicles.filter(v => v.vehicle !== UNASSIGNED || v.trips || v.revenue || v.expense).slice(0, 5)
  if (!top.length) return <Muted>No vehicles yet</Muted>
  return (
    <Panel className="divide-y overflow-hidden">
      {top.map((v, i) => {
        const named = v.vehicle !== UNASSIGNED
        const body = (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {named ? <VehiclePlate number={v.vehicle} ind={false} className="text-xs" /> : <span className="truncate">No vehicle</span>}
                {v.running > 0 && <LiveDot />}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted sm:w-20" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(v.utilization ?? 0) * 100}%` }} />
                </div>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {v.utilization === null ? '—' : formatPercent(v.utilization)} on road · {v.trips} {v.trips === 1 ? 'trip' : 'trips'}
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn('text-sm font-semibold tabular-nums', tone(v.profit))}>{formatINR(v.profit)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{v.margin === null ? 'no sales' : `${formatPercent(v.margin)} margin`}</p>
            </div>
          </>
        )
        const row = 'flex items-center gap-3 px-4 py-3'
        return named ? (
          <Link key={v.vehicle} href={`/trips?vehicle=${encodeURIComponent(v.vehicle)}`} className={cn(row, 'transition-colors hover:bg-muted/40')}>
            {body}
          </Link>
        ) : (
          <div key={v.vehicle} className={row}>
            {body}
          </div>
        )
      })}
    </Panel>
  )
}

// ---------------------------------------------------------------- needs attention

const ATTENTION_ICON: Record<Attention['kind'], React.ComponentType<{ className?: string }>> = {
  'missing-sale': BadgeIndianRupee,
  'long-running': Hourglass,
  'driver-owed': HandCoins,
  'idle-vehicle': CirclePause,
}

export function NeedsAttention({ items }: { items: Attention[] }) {
  return (
    <Panel className="divide-y overflow-hidden">
      {items.map((a, i) => {
        const Icon = ATTENTION_ICON[a.kind]
        const body = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">{a.message}</span>
            {a.href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          </>
        )
        const row = 'flex items-center gap-3 px-4 py-3'
        // Index key: two closed trips of the same truck and load produce identical messages.
        return a.href ? (
          <Link key={i} href={a.href} className={cn(row, 'transition-colors hover:bg-muted/40')}>
            {body}
          </Link>
        ) : (
          <div key={i} className={row}>
            {body}
          </div>
        )
      })}
    </Panel>
  )
}

// ---------------------------------------------------------------- recent activity

export function RecentActivity({
  expenses,
  trips,
  categories,
  vehicle,
}: {
  expenses: Expense[]
  trips: Trip[]
  categories: Category[]
  vehicle: string | null
}) {
  const tripById = new Map(trips.map(t => [t.id, t]))
  const catById = new Map(categories.map(c => [c.id, c]))
  const rows = expenses
    .filter(e => {
      if (!vehicle) return true
      const t = e.trip_id ? tripById.get(e.trip_id) : undefined
      return !!t && vehicleOf(t) === vehicle
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)

  if (!rows.length) return <Muted>No expenses logged yet</Muted>
  return (
    <Panel className="divide-y overflow-hidden">
      {rows.map(e => {
        const trip = e.trip_id ? tripById.get(e.trip_id) : undefined
        const body = (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-expense/10 text-expense">
              <Receipt className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{(e.category_id && catById.get(e.category_id)?.name) || 'Uncategorised'}</p>
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{trip ? tripName(trip) : 'No trip'}</span>
                {e.paid_by === 'driver' && (
                  <Badge variant="warning" className="shrink-0">
                    Driver
                  </Badge>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums">{formatINR(e.amount)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(e.date)}</p>
            </div>
          </>
        )
        const row = 'flex items-center gap-3 px-4 py-3'
        return trip ? (
          <Link key={e.id} href={`/trips/${trip.id}`} className={cn(row, 'transition-colors hover:bg-muted/40')}>
            {body}
          </Link>
        ) : (
          <div key={e.id} className={row}>
            {body}
          </div>
        )
      })}
    </Panel>
  )
}
