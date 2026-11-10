// Business KPIs computed from raw rows. Pure functions (no I/O) so they run on server or client and are unit-tested.
//
// Accounting conventions (keep in sync with the UI copy):
// - Expenses count on their own `date`.
// - Trip revenue (sell_amount) counts on the trip's end_date (when the load was sold); running trips have no revenue yet.
// - Trip profit = sell_amount - all of that trip's expenses (whole-trip view, independent of period).
// - Driver balance = driver-paid expenses - cash advanced to the driver. Positive = owner owes the driver.
import { daysBetween, formatINR, parseISODate, toISODate, todayISO } from './format.ts'
import type { Category, Expense, Trip } from './types.ts'

export type PeriodKey = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'all'
export const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'mtd', label: 'This month' },
  { value: 'ytd', label: 'This year' },
  { value: 'all', label: 'All time' },
]

export interface Period {
  key: PeriodKey
  from: string
  to: string
  days: number
  prev: { from: string; to: string } | null
  bucket: 'day' | 'week' | 'month'
}

const addDays = (iso: string, n: number) => {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function resolvePeriod(key: PeriodKey, today = todayISO(), earliest?: string): Period {
  const t = parseISODate(today)
  let from: string
  if (key === '7d') from = addDays(today, -6)
  else if (key === '30d') from = addDays(today, -29)
  else if (key === '90d') from = addDays(today, -89)
  else if (key === 'mtd') from = toISODate(new Date(t.getFullYear(), t.getMonth(), 1))
  else if (key === 'ytd') from = toISODate(new Date(t.getFullYear(), 0, 1))
  else from = earliest && earliest < today ? earliest : addDays(today, -29)
  const days = daysBetween(from, today)
  const prev = key === 'all' ? null : { from: addDays(from, -days), to: addDays(from, -1) }
  const bucket = days > 92 ? 'month' : days > 31 ? 'week' : 'day'
  return { key, from, to: today, days, prev, bucket }
}

const inRange = (d: string | null | undefined, from: string, to: string) => !!d && d >= from && d <= to

/** Monday-based week start / month start / the day itself. */
export function bucketKey(iso: string, bucket: Period['bucket']): string {
  if (bucket === 'day') return iso
  const d = parseISODate(iso)
  if (bucket === 'month') return toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toISODate(d)
}

export function bucketLabel(key: string, bucket: Period['bucket']): string {
  const d = parseISODate(key)
  if (bucket === 'month') return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------- trips

export interface TripSummary {
  trip: Trip
  spent: number
  revenue: number
  profit: number
  margin: number | null
  days: number
  costPerDay: number
  entries: number
  driverPaid: number
  driverBalance: number
  lastExpenseDate: string | null
}

export function summarizeTrips(trips: Trip[], expenses: Expense[]): Map<string, TripSummary> {
  const byTrip = new Map<string, Expense[]>()
  for (const e of expenses) if (e.trip_id) (byTrip.get(e.trip_id) ?? byTrip.set(e.trip_id, []).get(e.trip_id)!).push(e)
  const out = new Map<string, TripSummary>()
  for (const trip of trips) {
    const rows = byTrip.get(trip.id) ?? []
    const spent = rows.reduce((s, e) => s + e.amount, 0)
    const driverPaid = rows.filter(e => e.paid_by === 'driver').reduce((s, e) => s + e.amount, 0)
    const revenue = trip.sell_amount || 0
    const days = daysBetween(trip.start_date, trip.end_date)
    out.set(trip.id, {
      trip,
      spent,
      revenue,
      profit: revenue - spent,
      margin: revenue > 0 ? (revenue - spent) / revenue : null,
      days,
      costPerDay: spent / days,
      entries: rows.length,
      driverPaid,
      driverBalance: driverPaid - (trip.driver_advance || 0),
      lastExpenseDate: rows.reduce<string | null>((m, e) => (!m || e.date > m ? e.date : m), null),
    })
  }
  return out
}

// ---------------------------------------------------------------- dashboard

export interface Totals {
  revenue: number
  expense: number
  profit: number
  margin: number | null
  tripsCompleted: number
  tripsStarted: number
  avgProfitPerTrip: number | null
  avgTripDays: number | null
  dailyBurn: number
  utilization: number | null
}

export interface CategoryStat { id: string; name: string; group: string; amount: number; share: number; prevAmount: number }
export interface GroupStat { group: string; amount: number; share: number }
export interface SeriesPoint { key: string; label: string; revenue: number; expense: number; profit: number }

export interface VehicleStat {
  vehicle: string
  trips: number
  running: number
  revenue: number
  expense: number
  profit: number
  margin: number | null
  utilization: number | null
  costPerDay: number
  avgProfitPerTrip: number | null
  driverBalance: number
  lastActive: string | null
  spark: number[]
}

export interface Attention { kind: 'missing-sale' | 'long-running' | 'driver-owed' | 'idle-vehicle'; message: string; href?: string }

export interface DashboardData {
  period: Period
  totals: Totals
  prev: Totals | null
  /** Live state, not bound to the period. */
  live: { activeTrips: number; runningSpend: number; driverBalance: number; vehicles: number }
  series: SeriesPoint[]
  categories: CategoryStat[]
  groups: GroupStat[]
  vehicles: VehicleStat[]
  running: TripSummary[]
  recentCompleted: TripSummary[]
  attention: Attention[]
}

export const UNASSIGNED = 'Unassigned'
export const vehicleOf = (t: Trip) => t.vehicle_number?.trim().toUpperCase() || UNASSIGNED

/** Fraction of period days on which each vehicle had a trip running (overlapping trips counted once). */
function utilization(trips: Trip[], from: string, to: string, today: string): number | null {
  if (!trips.length) return null
  const days = new Set<string>()
  for (const t of trips) {
    const s = t.start_date > from ? t.start_date : from
    const endRaw = t.end_date ?? today
    const e = endRaw < to ? endRaw : to
    for (let d = s; d <= e; d = addDays(d, 1)) days.add(d)
  }
  return days.size / daysBetween(from, to)
}

function totalsFor(trips: Trip[], expenses: Expense[], summaries: Map<string, TripSummary>, from: string, to: string, today: string): Totals {
  const expense = expenses.filter(e => inRange(e.date, from, to)).reduce((s, e) => s + e.amount, 0)
  const completed = trips.filter(t => t.status === 'completed' && inRange(t.end_date ?? t.start_date, from, to))
  const revenue = completed.reduce((s, t) => s + (t.sell_amount || 0), 0)
  const profits = completed.map(t => summaries.get(t.id)!.profit)
  const vehicles = new Map<string, Trip[]>()
  for (const t of trips) (vehicles.get(vehicleOf(t)) ?? vehicles.set(vehicleOf(t), []).get(vehicleOf(t))!).push(t)
  // Trips without a vehicle number can't be placed on a truck, so they don't count towards fleet utilisation.
  const utils = [...vehicles.entries()].filter(([v]) => v !== UNASSIGNED || vehicles.size === 1).map(([, ts]) => utilization(ts, from, to, today)).filter((u): u is number => u !== null)
  return {
    revenue,
    expense,
    profit: revenue - expense,
    margin: revenue > 0 ? (revenue - expense) / revenue : null,
    tripsCompleted: completed.length,
    tripsStarted: trips.filter(t => inRange(t.start_date, from, to)).length,
    avgProfitPerTrip: profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : null,
    avgTripDays: completed.length ? completed.reduce((s, t) => s + summaries.get(t.id)!.days, 0) / completed.length : null,
    dailyBurn: expense / daysBetween(from, to),
    utilization: utils.length ? utils.reduce((a, b) => a + b, 0) / utils.length : null,
  }
}

export function computeDashboard(
  data: { trips: Trip[]; expenses: Expense[]; categories: Category[] },
  opts: { period: PeriodKey; vehicle?: string | null; today?: string },
): DashboardData {
  const today = opts.today ?? todayISO()
  const trips = opts.vehicle ? data.trips.filter(t => vehicleOf(t) === opts.vehicle) : data.trips
  const tripIds = new Set(trips.map(t => t.id))
  const expenses = opts.vehicle ? data.expenses.filter(e => e.trip_id && tripIds.has(e.trip_id)) : data.expenses
  const earliest = [...trips.map(t => t.start_date), ...expenses.map(e => e.date)].reduce<string | undefined>((m, d) => (!m || d < m ? d : m), undefined)
  const period = resolvePeriod(opts.period, today, earliest)
  const summaries = summarizeTrips(trips, expenses)

  const totals = totalsFor(trips, expenses, summaries, period.from, period.to, today)
  const prev = period.prev ? totalsFor(trips, expenses, summaries, period.prev.from, period.prev.to, today) : null

  // Time series, with empty buckets filled so the chart has no gaps.
  const series = new Map<string, SeriesPoint>()
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
    const k = bucketKey(d, period.bucket)
    if (!series.has(k)) series.set(k, { key: k, label: bucketLabel(k, period.bucket), revenue: 0, expense: 0, profit: 0 })
  }
  for (const e of expenses) if (inRange(e.date, period.from, period.to)) series.get(bucketKey(e.date, period.bucket))!.expense += e.amount
  for (const t of trips) {
    const d = t.end_date ?? t.start_date
    if (t.status === 'completed' && inRange(d, period.from, period.to)) series.get(bucketKey(d, period.bucket))!.revenue += t.sell_amount || 0
  }
  for (const p of series.values()) p.profit = p.revenue - p.expense

  // Categories + groups
  const catById = new Map(data.categories.map(c => [c.id, c]))
  const catAmounts = new Map<string, { cur: number; prev: number }>()
  for (const e of expenses) {
    const id = e.category_id ?? 'uncategorised'
    const slot = catAmounts.get(id) ?? { cur: 0, prev: 0 }
    if (inRange(e.date, period.from, period.to)) slot.cur += e.amount
    else if (period.prev && inRange(e.date, period.prev.from, period.prev.to)) slot.prev += e.amount
    catAmounts.set(id, slot)
  }
  const categories: CategoryStat[] = [...catAmounts.entries()]
    .filter(([, v]) => v.cur > 0 || v.prev > 0)
    .map(([id, v]) => {
      const c = catById.get(id)
      return { id, name: c?.name ?? 'Uncategorised', group: c?.category_group || 'Other', amount: v.cur, prevAmount: v.prev, share: totals.expense ? v.cur / totals.expense : 0 }
    })
    .sort((a, b) => b.amount - a.amount)
  const groupMap = new Map<string, number>()
  for (const c of categories) groupMap.set(c.group, (groupMap.get(c.group) ?? 0) + c.amount)
  const groups = [...groupMap.entries()]
    .filter(([, a]) => a > 0)
    .map(([group, amount]) => ({ group, amount, share: totals.expense ? amount / totals.expense : 0 }))
    .sort((a, b) => b.amount - a.amount)

  // Vehicles (always computed over the unfiltered fleet so the leaderboard stays comparable)
  const vehicles = fleetStats(data, period, today)
    .filter(v => !opts.vehicle || v.vehicle === opts.vehicle)

  const all = [...summaries.values()]
  const running = all.filter(s => s.trip.status === 'running').sort((a, b) => a.trip.start_date.localeCompare(b.trip.start_date))
  const recentCompleted = all
    .filter(s => s.trip.status === 'completed')
    .sort((a, b) => (b.trip.end_date ?? '').localeCompare(a.trip.end_date ?? ''))
    .slice(0, 5)

  const attention: Attention[] = []
  for (const s of all) {
    if (s.trip.status === 'completed' && !s.revenue && s.spent > 0)
      attention.push({ kind: 'missing-sale', message: `${tripName(s.trip)} is closed without a sell amount`, href: `/trips/${s.trip.id}` })
    if (s.trip.status === 'running' && s.days > 14)
      attention.push({ kind: 'long-running', message: `${tripName(s.trip)} has been running ${s.days} days`, href: `/trips/${s.trip.id}` })
    if (s.trip.status === 'completed' && s.driverBalance > 0)
      attention.push({ kind: 'driver-owed', message: `Driver is owed ${formatINR(s.driverBalance)} on ${tripName(s.trip)}`, href: `/trips/${s.trip.id}` })
  }
  for (const v of vehicles) {
    if (v.vehicle !== UNASSIGNED && v.running === 0 && v.lastActive && daysBetween(v.lastActive, today) > 7)
      attention.push({ kind: 'idle-vehicle', message: `${v.vehicle} idle for ${daysBetween(v.lastActive, today) - 1} days`, href: `/fleet` })
  }

  return {
    period,
    totals,
    prev,
    live: {
      activeTrips: running.length,
      runningSpend: running.reduce((s, r) => s + r.spent, 0),
      driverBalance: all.reduce((s, r) => s + r.driverBalance, 0),
      vehicles: new Set(trips.map(vehicleOf).filter(v => v !== UNASSIGNED)).size,
    },
    series: [...series.values()],
    categories,
    groups,
    vehicles,
    running,
    recentCompleted,
    attention: attention.slice(0, 6),
  }
}

/** Per-vehicle leaderboard for a period. */
export function fleetStats(data: { trips: Trip[]; expenses: Expense[] }, period: Period, today = todayISO()): VehicleStat[] {
  const summaries = summarizeTrips(data.trips, data.expenses)
  const byVehicle = new Map<string, Trip[]>()
  for (const t of data.trips) (byVehicle.get(vehicleOf(t)) ?? byVehicle.set(vehicleOf(t), []).get(vehicleOf(t))!).push(t)
  const tripVehicle = new Map(data.trips.map(t => [t.id, vehicleOf(t)]))

  return [...byVehicle.entries()].map(([vehicle, trips]) => {
    const ids = new Set(trips.map(t => t.id))
    const vExpenses = data.expenses.filter(e => e.trip_id && ids.has(e.trip_id))
    const t = totalsFor(trips, vExpenses, summaries, period.from, period.to, today)
    const spark = new Map<string, number>()
    for (let d = period.from; d <= period.to; d = addDays(d, 1)) spark.set(bucketKey(d, period.bucket), 0)
    for (const tr of trips) {
      const d = tr.end_date ?? tr.start_date
      if (tr.status === 'completed' && inRange(d, period.from, period.to)) spark.set(bucketKey(d, period.bucket), (spark.get(bucketKey(d, period.bucket)) ?? 0) + (tr.sell_amount || 0))
    }
    for (const e of vExpenses) if (inRange(e.date, period.from, period.to) && tripVehicle.get(e.trip_id!) === vehicle) spark.set(bucketKey(e.date, period.bucket), (spark.get(bucketKey(e.date, period.bucket)) ?? 0) - e.amount)
    const lastActive = trips.reduce<string | null>((m, tr) => {
      const d = tr.status === 'running' ? today : tr.end_date ?? tr.start_date
      return !m || d > m ? d : m
    }, null)
    return {
      vehicle,
      trips: trips.filter(tr => inRange(tr.start_date, period.from, period.to) || inRange(tr.end_date, period.from, period.to) || tr.status === 'running').length,
      running: trips.filter(tr => tr.status === 'running').length,
      revenue: t.revenue,
      expense: t.expense,
      profit: t.profit,
      margin: t.margin,
      utilization: t.utilization,
      costPerDay: t.dailyBurn,
      avgProfitPerTrip: t.avgProfitPerTrip,
      driverBalance: trips.reduce((s, tr) => s + summaries.get(tr.id)!.driverBalance, 0),
      lastActive,
      spark: [...spark.values()],
    }
  }).sort((a, b) => b.profit - a.profit)
}

export function tripName(t: Pick<Trip, 'commodity' | 'route' | 'vehicle_number'>): string {
  return [t.vehicle_number?.toUpperCase(), t.commodity || t.route].filter(Boolean).join(' · ') || 'Trip'
}

/** Fractional change; null when there is no meaningful baseline. */
export function change(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}
