'use client'

import { ChartColumn, ChartPie } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, Pie, PieChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '@/components/app/page'
import type { GroupStat, Period, SeriesPoint } from '@/lib/analytics'
import { formatCompactINR, formatINR, formatPercent } from '@/lib/format'
import type { CategoryGroup } from '@/lib/types'
import { GROUP_COLOR, groupOf } from './groups'

const SERIES = [
  { key: 'revenue', label: 'Revenue', color: 'var(--color-chart-1)' },
  { key: 'expense', label: 'Expenses', color: 'var(--color-chart-2)' },
  { key: 'profit', label: 'Profit', color: 'var(--color-chart-3)' },
] as const


const AXIS_TICK = { fill: 'var(--color-chart-axis)', fontSize: 11 }
const TOOLTIP_BOX = 'min-w-44 rounded-xl border bg-popover p-3 text-xs text-popover-foreground shadow-lg shadow-black/5'

function ChartEmpty({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Icon className="size-6 opacity-60" />
      {text}
    </div>
  )
}

function TrendTooltip({ row, bucket }: { row: SeriesPoint; bucket: Period['bucket'] }) {
  return (
    <div className={TOOLTIP_BOX}>
      <p className="mb-2 font-medium">{bucket === 'week' ? `Week of ${row.label}` : row.label}</p>
      {SERIES.map(s => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className={s.key === 'profit' && row.profit < 0 ? 'font-medium text-negative tabular-nums' : 'font-medium tabular-nums'}>
            {formatINR(row[s.key])}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Revenue + expense bars and a profit line per bucket, on one ₹ axis. */
export function TrendChart({ series, bucket }: { series: SeriesPoint[]; bucket: Period['bucket'] }) {
  const sums = { revenue: 0, expense: 0, profit: 0 }
  for (const p of series) {
    sums.revenue += p.revenue
    sums.expense += p.expense
    sums.profit += p.profit
  }
  const empty = !sums.revenue && !sums.expense

  return (
    <Panel className="flex flex-1 flex-col p-4 sm:p-5">
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {SERIES.map(s => (
          <li key={s.key} className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {s.key === 'profit' ? (
                <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              ) : (
                <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              )}
              {s.label}
            </span>
            <span className={s.key === 'profit' && sums.profit < 0 ? 'text-sm font-semibold text-negative tabular-nums' : 'text-sm font-semibold tabular-nums'}>
              {formatCompactINR(sums[s.key])}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 h-60">
        {empty ? (
          <ChartEmpty icon={ChartColumn} text="No sales or spend in this period" />
        ) : (
          <ComposedChart responsive className="size-full" data={series} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={2} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} tickMargin={8} minTickGap={20} />
            <YAxis tickFormatter={v => formatCompactINR(v)} tickLine={false} axisLine={false} tick={AXIS_TICK} width={56} />
            <Tooltip cursor={{ fill: 'var(--color-muted)', opacity: 0.7 }} content={({ active, payload }) => (active && payload?.[0] ? <TrendTooltip row={payload[0].payload as SeriesPoint} bucket={bucket} /> : null)} />
            {series.some(p => p.profit < 0) ? <ReferenceLine y={0} stroke="var(--color-chart-axis)" strokeOpacity={0.6} /> : null}
            <Bar dataKey="revenue" name="Revenue" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expense" name="Expenses" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Line
              dataKey="profit"
              name="Profit"
              type="monotone"
              stroke="var(--color-chart-3)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }}
            />
          </ComposedChart>
        )}
      </div>
    </Panel>
  )
}

function GroupTooltip({ row, total }: { row: { group: CategoryGroup; amount: number }; total: number }) {
  return (
    <div className={TOOLTIP_BOX}>
      <p className="flex items-center gap-2 font-medium">
        <span className="size-2 rounded-full" style={{ background: GROUP_COLOR[row.group] }} />
        {row.group}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{formatINR(row.amount)}</p>
      <p className="text-muted-foreground">{formatPercent(total ? row.amount / total : 0)} of spend</p>
    </div>
  )
}

/** Donut of spend by category group with the total in the centre and a legend with amounts. */
export function SpendMix({ groups, total }: { groups: GroupStat[]; total: number }) {
  const merged = new Map<CategoryGroup, number>()
  for (const g of groups) merged.set(groupOf(g.group), (merged.get(groupOf(g.group)) ?? 0) + g.amount)
  const data = [...merged.entries()]
    .map(([group, amount]) => ({ group, amount, fill: GROUP_COLOR[group] }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <Panel className="flex flex-1 flex-col p-4 sm:p-5">
      {!total ? (
        <ChartEmpty icon={ChartPie} text="No spend in this period" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 sm:flex-row lg:flex-col">
          <div className="relative size-44 shrink-0">
            <PieChart width={176} height={176}>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="group"
                innerRadius={58}
                outerRadius={86}
                startAngle={90}
                endAngle={-270}
                stroke="var(--color-card)"
                strokeWidth={2}
              />
              <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <GroupTooltip row={payload[0].payload} total={total} /> : null)} />
            </PieChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-muted-foreground">Total spend</span>
              <span className="text-xl font-semibold tracking-tight">{formatCompactINR(total)}</span>
            </div>
          </div>
          <ul className="w-full space-y-2.5 sm:flex-1 lg:flex-none">
            {data.map(g => (
              <li key={g.group} className="flex items-center gap-2.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.fill }} />
                <span className="flex-1 truncate">{g.group}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatPercent(g.amount / total)}</span>
                <span className="min-w-20 text-right font-medium tabular-nums">{formatINR(g.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
