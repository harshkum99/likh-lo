import { Panel } from '@/components/app/page'
import { formatINR, formatPercent } from '@/lib/format'
import { CATEGORY_GROUPS, type Category, type CategoryGroup, type Expense } from '@/lib/types'
import { GROUP_COLOR, groupOf } from './shared'

interface Row { id: string; name: string; group: CategoryGroup | null; amount: number }

/** Where the trip's money went: group mix bar + top categories (top 6, rest folded into "Others"). */
export function SpendBreakdown({ expenses, categories }: { expenses: Expense[]; categories: Category[] }) {
  const byId = new Map(categories.map(c => [c.id, c]))
  const total = expenses.reduce((a, e) => a + e.amount, 0) // > 0: the page only renders this when the trip has spend

  const rows = new Map<string, Row>()
  for (const e of expenses) {
    const c = e.category_id ? byId.get(e.category_id) : undefined
    const key = c?.id ?? 'none'
    const row = rows.get(key) ?? { id: key, name: c?.name ?? 'Uncategorised', group: groupOf(c), amount: 0 }
    row.amount += e.amount
    rows.set(key, row)
  }
  const sorted = [...rows.values()].sort((a, b) => b.amount - a.amount)
  const top: Row[] =
    sorted.length > 7
      ? [...sorted.slice(0, 6), { id: 'others', name: 'Others', group: null, amount: sorted.slice(6).reduce((a, r) => a + r.amount, 0) }]
      : sorted
  const groups = CATEGORY_GROUPS.map(g => ({ group: g, amount: sorted.filter(r => r.group === g).reduce((a, r) => a + r.amount, 0) })).filter(
    g => g.amount > 0,
  )
  // "Others" mixes groups, so it gets a neutral colour instead of borrowing one.
  const colour = (r: Row) => (r.group ? GROUP_COLOR[r.group] : 'var(--color-chart-axis)')

  return (
    <Panel className="space-y-5 p-4 sm:p-5">
      <div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {groups.map(g => (
            <div key={g.group} style={{ width: `${(g.amount / total) * 100}%`, background: GROUP_COLOR[g.group] }} />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {groups.map(g => (
            <li key={g.group} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: GROUP_COLOR[g.group] }} />
              {g.group}
              <span className="font-medium text-foreground tabular-nums">{formatPercent(g.amount / total)}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="space-y-3.5">
        {top.map(r => (
          <li key={r.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{formatINR(r.amount)}</span>
                <span className="inline-block w-11 text-right text-xs text-muted-foreground">{formatPercent(r.amount / total)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${(r.amount / total) * 100}%`, background: colour(r) }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
