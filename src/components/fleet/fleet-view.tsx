'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowDownRight, ArrowUpRight, ChevronRight, Plus } from 'lucide-react'
import { change, fleetStats, PERIODS, resolvePeriod, UNASSIGNED, vehicleOf, type PeriodKey, type VehicleStat } from '@/lib/analytics'
import { daysBetween, formatDate, formatINR, formatNumber, formatPercent } from '@/lib/format'
import type { Expense, Trip } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Panel, Section } from '@/components/app/page'
import { Sparkline } from '@/components/app/sparkline'
import { Badge, LiveDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { formatPlate, VehiclePlate } from './vehicle-plate'

type SortKey = 'profit' | 'margin' | 'utilisation' | 'spend'
const SORTS: { value: SortKey; label: string; key: (v: VehicleStat) => number | null }[] = [
  { value: 'profit', label: 'Profit', key: v => v.profit },
  { value: 'margin', label: 'Margin', key: v => v.margin },
  { value: 'utilisation', label: 'Utilisation', key: v => v.utilization },
  { value: 'spend', label: 'Spend', key: v => v.expense },
]

const tone = (n: number) => (n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : 'text-muted-foreground')
const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`
const tripsHref = (vehicle: string) => `/trips?vehicle=${encodeURIComponent(vehicle)}`
/** Driver balance > 0: owner owes the driver; < 0: unspent advance is still with the driver. */
const driverLabel = (b: number) => `${b > 0 ? 'Owed' : 'Holds'} ${formatINR(Math.abs(b))}`
const hasDriverBalance = (b: number) => Math.round(b) !== 0

/** Fleet-wide totals. Sums the per-vehicle rows (trip-linked money only) so the summary always equals the table. */
function summarize(stats: VehicleStat[]) {
  const assigned = stats.filter(v => v.vehicle !== UNASSIGNED)
  const sum = (f: (v: VehicleStat) => number) => stats.reduce((s, v) => s + f(v), 0)
  const revenue = sum(v => v.revenue)
  const expense = sum(v => v.expense)
  return {
    vehicles: assigned.length,
    onRoad: assigned.filter(v => v.running > 0).length,
    trips: sum(v => v.trips),
    revenue,
    expense,
    profit: revenue - expense,
    margin: revenue > 0 ? (revenue - expense) / revenue : null,
    // The Unassigned bucket mixes several trucks, so it is left out of utilisation.
    utilization: assigned.length ? assigned.reduce((s, v) => s + (v.utilization ?? 0), 0) / assigned.length : null,
    costPerDay: sum(v => v.costPerDay),
    driverBalance: sum(v => v.driverBalance),
    spark: (stats[0]?.spark ?? []).map((_, i) => sum(v => v.spark[i] ?? 0)),
  }
}

export function FleetView({ trips, expenses, today }: { trips: Trip[]; expenses: Expense[]; today: string }) {
  const router = useRouter()
  const [periodKey, setPeriodKey] = useState<PeriodKey>('90d')
  const [sort, setSort] = useState<SortKey>('profit')

  const earliest = [...trips.map(t => t.start_date), ...expenses.map(e => e.date)].reduce<string | undefined>((m, d) => (!m || d < m ? d : m), undefined)
  const period = resolvePeriod(periodKey, today, earliest)
  const stats = fleetStats({ trips, expenses }, period, today)
  const fleet = summarize(stats)
  const prev = period.prev ? summarize(fleetStats({ trips, expenses }, { ...period, ...period.prev }, today)) : null
  const delta = prev ? change(fleet.profit, prev.profit) : null

  const running = new Map<string, Trip[]>()
  for (const t of trips) if (t.status === 'running') running.set(vehicleOf(t), [...(running.get(vehicleOf(t)) ?? []), t])
  const unassignedTrips = trips.filter(t => vehicleOf(t) === UNASSIGNED).length

  const by = SORTS.find(s => s.value === sort)!.key
  const rows = [...stats].sort(
    (a, b) => Number(a.vehicle === UNASSIGNED) - Number(b.vehicle === UNASSIGNED) || (by(b) ?? -Infinity) - (by(a) ?? -Infinity) || 0,
  )
  const periodLabel = PERIODS.find(p => p.value === periodKey)!.label
  const ctx = { today, periodDays: period.days, periodLabel, unassignedTrips }

  return (
    <>
      <Segmented value={periodKey} onChange={setPeriodKey} options={PERIODS} aria-label="Period" />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-hero-from to-hero-to p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/70">
                Fleet profit · {formatDate(period.from)} – {formatDate(period.to)}
              </p>
              <p className="mt-1 truncate text-4xl font-semibold tracking-tight tabular-nums">{formatINR(fleet.profit)}</p>
            </div>
            {delta !== null && Number.isFinite(delta) && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white/15 px-2 py-1 text-xs font-medium tabular-nums">
                {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                <span className="sr-only">{delta >= 0 ? 'Up' : 'Down'}</span>
                {formatPercent(Math.abs(delta))}
                <span className="sr-only">versus the previous {period.days} days</span>
              </span>
            )}
          </div>
          <Sparkline data={fleet.spark} color="white" className="h-12 w-full" />
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <HeroStat label="Revenue" value={formatINR(fleet.revenue)} />
            <HeroStat label="Spend" value={formatINR(fleet.expense)} />
            <HeroStat label="Margin" value={fleet.margin === null ? '—' : formatPercent(fleet.margin)} />
          </dl>
        </div>

        <Panel className="grid grid-cols-3 divide-x">
          <MiniStat label="Vehicles" value={formatNumber(fleet.vehicles)} hint={plural(fleet.trips, 'trip')} />
          <MiniStat
            label="On the road"
            value={
              <span className="inline-flex items-center gap-2">
                {formatNumber(fleet.onRoad)}
                {fleet.onRoad > 0 && <LiveDot />}
              </span>
            }
            hint={`${formatNumber(fleet.vehicles - fleet.onRoad)} idle`}
          />
          <MiniStat
            label="Utilisation"
            value={fleet.utilization === null ? '—' : formatPercent(fleet.utilization)}
            hint="avg per truck"
          />
        </Panel>
      </div>

      <Section title="Vehicles">
        {/* On lg the table's column headers do the sorting. */}
        <Segmented className="lg:hidden" value={sort} onChange={setSort} options={SORTS} aria-label="Sort vehicles by" />
        <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
          {rows.map(v => (
            <VehicleCard key={v.vehicle} v={v} running={running.get(v.vehicle) ?? []} {...ctx} />
          ))}
        </div>

        <Panel className="hidden overflow-clip lg:block">
          {/* Scrolls sideways only if lg is too narrow; on xl it stays visible so the sticky header follows the page. */}
          <div className="overflow-x-auto xl:overflow-visible">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th className="hidden xl:table-cell">Trips</Th>
                  <Th>Revenue</Th>
                  <Th sortKey="spend" sort={sort} onSort={setSort}>Spend</Th>
                  <Th sortKey="profit" sort={sort} onSort={setSort}>Profit</Th>
                  <Th sortKey="margin" sort={sort} onSort={setSort}>Margin</Th>
                  <Th sortKey="utilisation" sort={sort} onSort={setSort}>Utilisation</Th>
                  <Th className="hidden xl:table-cell">₹/day</Th>
                  <Th className="hidden xl:table-cell">Driver</Th>
                  <Th>Trend</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(v => {
                  const href = tripsHref(v.vehicle)
                  const unassigned = v.vehicle === UNASSIGNED
                  return (
                    <tr
                      key={v.vehicle}
                      onClick={e => {
                        if (!(e.target as Element).closest('a,button')) router.push(href)
                      }}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <Td>
                        <div className="flex flex-col items-start gap-1.5">
                          <Link
                            href={href}
                            aria-label={unassigned ? 'Trips without a vehicle number' : `Trips of ${formatPlate(v.vehicle)}`}
                            className="rounded-[0.4em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {unassigned ? <NoPlate /> : <VehiclePlate number={v.vehicle} className="text-xs" />}
                          </Link>
                          {unassigned ? (
                            <p className="text-xs whitespace-normal text-muted-foreground">Add vehicle numbers to these trips</p>
                          ) : (
                            <VehicleStatus v={v} running={running.get(v.vehicle) ?? []} today={today} />
                          )}
                        </div>
                      </Td>
                      <Td className="hidden xl:table-cell">{formatNumber(v.trips)}</Td>
                      <Td>{formatINR(v.revenue)}</Td>
                      <Td className="text-expense">{formatINR(v.expense)}</Td>
                      <Td className={cn('font-semibold', tone(v.profit))}>{formatINR(v.profit)}</Td>
                      <Td>{v.margin === null ? '—' : formatPercent(v.margin)}</Td>
                      <Td>{unassigned ? '—' : <UtilBar value={v.utilization} />}</Td>
                      <Td className="hidden xl:table-cell">{formatINR(v.costPerDay)}</Td>
                      <Td className={cn('hidden xl:table-cell', v.driverBalance > 0 ? 'text-warning' : 'text-muted-foreground')}>
                        {hasDriverBalance(v.driverBalance) ? driverLabel(v.driverBalance) : '—'}
                      </Td>
                      <Td>
                        <Sparkline data={v.spark} color="var(--color-chart-3)" className="ml-auto h-8 w-20" />
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <Td>Fleet total</Td>
                  <Td className="hidden xl:table-cell">{formatNumber(fleet.trips)}</Td>
                  <Td>{formatINR(fleet.revenue)}</Td>
                  <Td className="text-expense">{formatINR(fleet.expense)}</Td>
                  <Td className={tone(fleet.profit)}>{formatINR(fleet.profit)}</Td>
                  <Td>{fleet.margin === null ? '—' : formatPercent(fleet.margin)}</Td>
                  <Td>{fleet.utilization === null ? '—' : <UtilBar value={fleet.utilization} />}</Td>
                  <Td className="hidden xl:table-cell">{formatINR(fleet.costPerDay)}</Td>
                  <Td className={cn('hidden xl:table-cell', fleet.driverBalance > 0 ? 'text-warning' : 'text-muted-foreground')}>
                    {hasDriverBalance(fleet.driverBalance) ? driverLabel(fleet.driverBalance) : '—'}
                  </Td>
                  <Td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
        <p className="px-0.5 text-xs text-muted-foreground">
          Profit = sales of trips that ended in the period minus that period&apos;s trip expenses. Driver balance covers all time.
        </p>
      </Section>
    </>
  )
}

function VehicleCard({
  v,
  running,
  today,
  periodDays,
  periodLabel,
  unassignedTrips,
}: {
  v: VehicleStat
  running: Trip[]
  today: string
  periodDays: number
  periodLabel: string
  unassignedTrips: number
}) {
  const unassigned = v.vehicle === UNASSIGNED
  return (
    <Panel className="relative flex flex-col gap-4 p-4 transition hover:shadow-md active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={tripsHref(v.vehicle)}
          aria-label={unassigned ? 'Trips without a vehicle number' : `Trips of ${formatPlate(v.vehicle)}`}
          className="min-w-0 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {unassigned ? <NoPlate /> : <VehiclePlate number={v.vehicle} />}
        </Link>
        <div className="relative z-10 shrink-0">
          <VehicleStatus v={v} running={running} today={today} />
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Profit · {periodLabel}</p>
          <p className={cn('truncate text-3xl font-semibold tracking-tight tabular-nums', tone(v.profit))}>{formatINR(v.profit)}</p>
        </div>
        <Sparkline data={v.spark} color="var(--color-chart-3)" className="mb-1 h-10 w-24 shrink-0" />
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3 text-sm">
        <CardStat label="Revenue" value={formatINR(v.revenue)} />
        <CardStat label="Spend" value={formatINR(v.expense)} className="text-expense" />
        <CardStat label="Margin" value={v.margin === null ? '—' : formatPercent(v.margin)} />
      </dl>

      {unassigned ? (
        <p className="text-xs text-muted-foreground">
          {plural(unassignedTrips, 'trip')} {unassignedTrips === 1 ? 'has' : 'have'} no vehicle number. Add it on the trip so the money counts
          towards the right truck.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-muted-foreground">Utilisation</span>
            <span className="tabular-nums">
              <span className="font-semibold">{formatPercent(v.utilization)}</span>
              <span className="text-muted-foreground">
                {' '}
                · {formatNumber(Math.round((v.utilization ?? 0) * periodDays))} of {formatNumber(periodDays)} days
              </span>
            </span>
          </div>
          <Bar value={v.utilization} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{plural(v.trips, 'trip')}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{formatINR(v.costPerDay)}/day spend</span>
        {hasDriverBalance(v.driverBalance) && (
          <Badge variant={v.driverBalance > 0 ? 'warning' : 'muted'} className="tabular-nums">
            Driver {driverLabel(v.driverBalance).toLowerCase()}
          </Badge>
        )}
      </div>

      <div className="-mx-4 -mb-4 flex items-center justify-between gap-3 border-t px-4 py-3">
        <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
          View trips <ChevronRight className="size-4" />
        </span>
        {!unassigned && (
          <Button
            render={<Link href={`/trips/new?vehicle=${encodeURIComponent(v.vehicle)}`} />}
            nativeButton={false}
            variant="outline"
            className="relative z-10 h-10 rounded-xl px-3.5"
          >
            <Plus /> New trip
          </Button>
        )}
      </div>
    </Panel>
  )
}

function VehicleStatus({ v, running, today }: { v: VehicleStat; running: Trip[]; today: string }) {
  const link = 'rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring'
  if (running.length === 1)
    return (
      <Link href={`/trips/${running[0].id}`} className={link}>
        <Badge variant="success" className="transition-colors hover:bg-positive/20">
          <LiveDot className="mr-0.5" />
          On trip · Day {daysBetween(running[0].start_date, today)}
          <ChevronRight />
        </Badge>
      </Link>
    )
  if (running.length > 1)
    return (
      <Link href={`${tripsHref(v.vehicle)}&status=running`} className={link}>
        <Badge variant="success" className="transition-colors hover:bg-positive/20">
          <LiveDot className="mr-0.5" />
          {running.length} trips running
          <ChevronRight />
        </Badge>
      </Link>
    )
  if (v.vehicle === UNASSIGNED || !v.lastActive) return null
  const idleDays = daysBetween(v.lastActive, today) - 1
  return (
    <Badge variant={idleDays >= 7 ? 'warning' : 'muted'}>Idle since {idleDays > 0 ? formatDate(v.lastActive) : 'today'}</Badge>
  )
}

function NoPlate() {
  return (
    <span className="inline-flex items-center rounded-[0.4em] border-[1.5px] border-dashed border-muted-foreground/40 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground">
      No vehicle number
    </span>
  )
}

function Bar({ value }: { value: number | null }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(1, value ?? 0) * 100}%` }} />
    </div>
  )
}

function UtilBar({ value }: { value: number | null }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="w-14">
        <Bar value={value} />
      </span>
      <span className="w-9 text-right">{formatPercent(value)}</span>
    </span>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-white/70">{label}</dt>
      <dd className="truncate font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function CardStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-semibold tabular-nums', className)}>{value}</dd>
    </div>
  )
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1 p-3 sm:p-4">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Th({
  children,
  className,
  sortKey,
  sort,
  onSort,
}: {
  children: React.ReactNode
  className?: string
  sortKey?: SortKey
  sort?: SortKey
  onSort?: (k: SortKey) => void
}) {
  const active = !!sortKey && sortKey === sort
  return (
    <th
      scope="col"
      aria-sort={active ? 'descending' : undefined}
      className={cn(
        'sticky top-0 z-10 border-b bg-card/95 px-2.5 py-2.5 text-right text-xs font-medium whitespace-nowrap text-muted-foreground backdrop-blur first:pl-4 first:text-left last:pr-4',
        className,
      )}
    >
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn('inline-flex items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', active && 'text-foreground')}
        >
          {children}
          {active && <ArrowDown className="size-3" />}
        </button>
      ) : (
        children
      )}
    </th>
  )
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-2.5 py-3 text-right whitespace-nowrap first:pl-4 first:text-left last:pr-4', className)}>{children}</td>
}
