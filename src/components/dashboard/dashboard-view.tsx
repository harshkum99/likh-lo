'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Coins,
  Flame,
  Gauge,
  HandCoins,
  IndianRupee,
  Minus,
  NotebookPen,
  Plus,
  Receipt,
  ScanLine,
  Sparkles,
  Truck,
} from 'lucide-react'
import { Page, Panel, Section } from '@/components/app/page'
import { BrandMark } from '@/components/app/app-shell'
import { KpiCard } from '@/components/app/kpi-card'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PERIODS, change, computeDashboard, type DashboardData, type PeriodKey } from '@/lib/analytics'
import { formatCompactINR, formatDate, formatINR, formatNumber, formatPercent, parseISODate, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Category, Expense, Trip } from '@/lib/types'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

// recharts is ~430 KB of JS: load it after the numbers are on screen so phones get a usable dashboard first.
const chartFallback = () => <Skeleton className="min-h-72 flex-1 rounded-2xl" />
const TrendChart = dynamic(() => import('./charts').then(m => m.TrendChart), { ssr: false, loading: chartFallback })
const SpendMix = dynamic(() => import('./charts').then(m => m.SpendMix), { ssr: false, loading: chartFallback })
import { FleetLeaderboard, NeedsAttention, RecentActivity, RunningTrips, TopCategories } from './lists'
import { NotesArea, type Note } from './notes-area'

const ALL = '__all__'
const noSubscribe = () => () => {}
const PERIOD_LABEL: Record<PeriodKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'This month',
  ytd: 'This year',
  all: 'All time',
}

/** The business cockpit. All numbers come from computeDashboard so they match /fleet and /trips. */
// Phones have no sidebar, so the dashboard header carries the logo there.
const TITLE = (
  <span className="flex items-center gap-2.5">
    <BrandMark className="size-8 rounded-lg lg:hidden" />
    Overview
  </span>
)

export function DashboardView({
  trips,
  expenses,
  categories,
  vehicles,
  notes,
  serverToday,
}: {
  trips: Trip[]
  expenses: Expense[]
  categories: Category[]
  vehicles: string[]
  notes: Note[]
  serverToday: string
}) {
  const [period, setPeriod] = useState<PeriodKey>('30d')
  const [vehicle, setVehicle] = useState<string | null>(null)
  // Server date only for SSR/hydration; then the browser's own date (the server may run in UTC, and Day N uses the browser's).
  const today = useSyncExternalStore(noSubscribe, todayISO, () => serverToday)
  const subtitle = parseISODate(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })

  if (!trips.length) {
    return (
      <Page title={TITLE} subtitle={subtitle}>
        <FirstRun />
        <NotesArea initialNotes={notes} />
      </Page>
    )
  }

  const d = computeDashboard({ trips, expenses, categories }, { period, vehicle, today })
  const newTripHref = vehicle ? `/trips/new?vehicle=${encodeURIComponent(vehicle)}` : '/trips/new'

  return (
    <Page
      title={TITLE}
      subtitle={subtitle}
      actions={
        <>
          {vehicles.length > 1 && <VehicleFilter vehicles={vehicles} value={vehicle} onChange={setVehicle} />}
          <Button render={<Link href={newTripHref} />} nativeButton={false} className="hidden h-10 rounded-xl px-3.5 sm:inline-flex">
            <Plus />
            New trip
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Segmented aria-label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        <p className="px-0.5 text-xs text-muted-foreground tabular-nums">
          {formatDate(d.period.from, { year: d.period.key === 'all' })} – {formatDate(d.period.to)}
        </p>
      </div>

      <Hero d={d} vehicle={vehicle} />
      <Kpis d={d} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-4">
        <Section title="Revenue, spend & profit" className="flex flex-col lg:col-span-2">
          <TrendChart series={d.series} bucket={d.period.bucket} />
        </Section>
        <Section title="Spend mix" className="flex flex-col">
          <SpendMix groups={d.groups} total={d.totals.expense} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start lg:gap-4">
        <Section title="Top categories">
          <TopCategories categories={d.categories} hasPrev={!!d.prev} />
        </Section>
        <Section
          title={
            <span className="flex items-center gap-2">
              On the road
              {d.running.length > 0 && <span className="rounded-full bg-positive/12 px-2 text-xs text-positive tabular-nums">{d.running.length}</span>}
            </span>
          }
          action={<SectionLink href="/trips?status=running">All trips</SectionLink>}
          className="lg:col-span-2"
        >
          <RunningTrips running={d.running} newTripHref={newTripHref} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-4">
        <div className="space-y-6">
          <Section title="Fleet leaderboard" action={<SectionLink href="/fleet">See fleet</SectionLink>}>
            <FleetLeaderboard vehicles={d.vehicles} />
          </Section>
          {d.attention.length > 0 && (
            <Section title="Needs attention">
              <NeedsAttention items={d.attention} />
            </Section>
          )}
        </div>
        <Section title="Recent activity" action={<SectionLink href="/expenses">Add expense</SectionLink>}>
          <RecentActivity expenses={expenses} trips={trips} categories={categories} vehicle={vehicle} />
        </Section>
      </div>

      <NotesArea initialNotes={notes} />
    </Page>
  )
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-my-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
      {children}
    </Link>
  )
}

function VehicleFilter({ vehicles, value, onChange }: { vehicles: string[]; value: string | null; onChange: (v: string | null) => void }) {
  const items = [{ value: ALL, label: 'All vehicles' }, ...vehicles.map(v => ({ value: v, label: v }))]
  return (
    <Select items={items} value={value ?? ALL} onValueChange={v => onChange(v && v !== ALL ? v : null)}>
      <SelectTrigger
        aria-label="Filter by vehicle"
        className="h-10 max-w-44 rounded-xl bg-card px-3 shadow-sm data-[size=default]:h-10 [&_svg]:text-muted-foreground"
      >
        <Truck />
        <SelectValue className="truncate" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end" className="min-w-44 rounded-xl p-1">
        {items.map(i => (
          <SelectItem key={i.value} value={i.value} className="py-2">
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Hero({ d, vehicle }: { d: DashboardData; vehicle: string | null }) {
  const { totals, prev, period } = d
  const delta = change(totals.profit, prev?.profit)
  const flat = delta !== null && Math.abs(delta) < 0.005
  const DeltaIcon = flat ? Minus : delta && delta > 0 ? ArrowUpRight : ArrowDownRight
  const hasMoney = totals.revenue + totals.expense > 0

  return (
    <div className="relative overflow-hidden rounded-3xl bg-hero p-5 text-white shadow-lg shadow-primary/15 sm:p-6 lg:grid lg:grid-cols-2 lg:items-end lg:gap-10">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-white/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm text-white/70">
          Net profit · {vehicle ?? PERIOD_LABEL[period.key]}
          {vehicle && <span className="text-white/50"> · {PERIOD_LABEL[period.key]}</span>}
        </p>
        <p className="mt-1 truncate text-4xl font-semibold tracking-tight sm:text-5xl">{formatINR(totals.profit)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {delta !== null && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-medium tabular-nums"
              aria-label={flat ? 'unchanged versus previous period' : `${delta > 0 ? 'up' : 'down'} ${formatPercent(Math.abs(delta))} versus previous period`}
            >
              <DeltaIcon className="size-4" />
              {formatPercent(Math.abs(delta))}
              <span className="font-normal text-white/70">vs previous</span>
            </span>
          )}
          <span className="text-white/75">
            {totals.margin === null ? 'No sales closed yet' : `${formatPercent(totals.margin)} margin`}
          </span>
        </div>
      </div>

      <div className="relative mt-6 lg:mt-0">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
          {hasMoney && (
            <>
              <div className="basis-0 rounded-full bg-white" style={{ flexGrow: totals.revenue }} />
              <div className="basis-0 rounded-full bg-white/40" style={{ flexGrow: totals.expense }} />
            </>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-white/70">
              <span className="size-2 rounded-full bg-white" />
              Revenue
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(totals.revenue)}</dd>
          </div>
          <div className="text-right">
            <dt className="flex items-center justify-end gap-1.5 text-white/70">
              <span className="size-2 rounded-full bg-white/40" />
              Expenses
            </dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{formatINR(totals.expense)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-white/55">Sales of trips closed in this period minus everything spent in it.</p>
      </div>
    </div>
  )
}

function Kpis({ d }: { d: DashboardData }) {
  const { totals: t, prev: p, live, period } = d
  const revenueSpark = d.series.map(s => s.revenue)
  const expenseSpark = d.series.map(s => s.expense)
  const balance = Math.round(live.driverBalance)
  const utilPts = t.utilization !== null && p?.utilization != null ? Math.round((t.utilization - p.utilization) * 100) : null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Revenue"
        icon={IndianRupee}
        value={formatCompactINR(t.revenue)}
        delta={change(t.revenue, p?.revenue)}
        hint="from closed trips"
        spark={revenueSpark}
        sparkColor="var(--color-chart-1)"
      />
      <KpiCard
        label="Expenses"
        icon={Receipt}
        value={formatCompactINR(t.expense)}
        delta={change(t.expense, p?.expense)}
        goodWhen="down"
        hint="all spend"
        spark={expenseSpark}
        sparkColor="var(--color-chart-2)"
      />
      <KpiCard
        label="Trips completed"
        icon={CircleCheck}
        value={formatNumber(t.tripsCompleted)}
        delta={change(t.tripsCompleted, p?.tripsCompleted)}
        hint={`${formatNumber(t.tripsStarted)} started`}
      />
      <KpiCard
        label="Avg profit / trip"
        icon={Coins}
        value={t.avgProfitPerTrip === null ? '—' : <span className={cn(t.avgProfitPerTrip < 0 && 'text-negative')}>{formatCompactINR(t.avgProfitPerTrip)}</span>}
        delta={change(t.avgProfitPerTrip, p?.avgProfitPerTrip)}
        hint="per closed trip"
      />
      <KpiCard
        label="Active trips"
        icon={Truck}
        value={
          <span className="inline-flex items-center gap-2">
            {formatNumber(live.activeTrips)}
            {live.activeTrips > 0 && <LiveDot />}
          </span>
        }
        hint={live.activeTrips ? `${formatCompactINR(live.runningSpend)} spent so far` : 'none on the road'}
      />
      <KpiCard
        label="Fleet utilisation"
        icon={Gauge}
        value={t.utilization === null ? '—' : formatPercent(t.utilization)}
        hint={utilPts === null || utilPts === 0 ? 'of days on a trip' : `${utilPts > 0 ? '+' : '−'}${Math.abs(utilPts)} pts vs previous`}
      />
      <KpiCard
        label="Daily spend"
        icon={Flame}
        value={formatCompactINR(t.dailyBurn)}
        delta={change(t.dailyBurn, p?.dailyBurn)}
        goodWhen="down"
        hint={`avg over ${formatNumber(period.days)} days`}
        spark={expenseSpark}
        sparkColor="var(--color-chart-2)"
      />
      <KpiCard
        label={balance > 0 ? 'Owed to drivers' : balance < 0 ? 'Held by drivers' : 'Driver balance'}
        icon={HandCoins}
        value={<span className={cn(balance > 0 && 'text-warning')}>{formatCompactINR(Math.abs(balance))}</span>}
        hint={balance > 0 ? 'paid beyond advance' : balance < 0 ? 'advance not yet spent' : 'all settled'}
      />
    </div>
  )
}

const STEPS = [
  { icon: Truck, title: 'Start a trip', body: 'Truck number, load and route. Takes ten seconds.' },
  { icon: NotebookPen, title: 'Write down every rupee', body: 'Type expenses, or scan the register page and check what it read.' },
  { icon: Coins, title: 'Close it, see the profit', body: 'Enter the sale amount when the load is sold. Likh-lo does the maths.' },
]

function FirstRun() {
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-hero p-6 text-white shadow-lg shadow-primary/15 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-3xl" />
        <Truck aria-hidden className="pointer-events-none absolute -right-6 -bottom-8 size-44 text-white/[0.07]" />
        <div className="relative">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15">
            <Sparkles className="size-5" />
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome to Likh-lo</h2>
          <p className="mt-2 max-w-md text-sm text-white/75 sm:text-base">
            Your register, but it adds up by itself. Track every trip, every rupee spent on the road and what each truck really earns.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/trips/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-medium text-hero-from shadow-sm transition hover:bg-white/90 active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Start your first trip
            </Link>
            <Link
              href="/scan"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/15 px-5 text-sm font-medium text-white transition hover:bg-white/20 active:scale-[0.98]"
            >
              <ScanLine className="size-4" />
              Scan a register page
            </Link>
          </div>
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Panel className="flex h-full gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground tabular-nums">{i + 1}. </span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </Panel>
          </li>
        ))}
      </ol>
    </>
  )
}
