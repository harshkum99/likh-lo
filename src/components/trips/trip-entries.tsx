'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Plus, ReceiptText, ScanLine, Trash2 } from 'lucide-react'
import { deleteExpense, updateExpense } from '@/app/expenses/actions'
import { EmptyState, Panel } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { formatDate, formatINR } from '@/lib/format'
import { CATEGORY_GROUPS, type Category, type Expense } from '@/lib/types'
import { cn } from '@/lib/utils'
import { GROUP_COLOR, groupOf } from './shared'

/** Trip's expense entries by day (newest first). Tap a row to fix or delete it. */
export function TripEntries({ tripId, expenses, categories }: { tripId: string; expenses: Expense[]; categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, startDelete] = useTransition()
  const byId = new Map(categories.map(c => [c.id, c]))
  const nameOf = (e: Expense) => (e.category_id && byId.get(e.category_id)?.name) || 'Uncategorised'

  if (!expenses.length) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No entries yet"
        description="Snap the register page and we'll fill the entries in, or add them by hand."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button render={<Link href={`/scan?trip=${tripId}`} />} nativeButton={false} className="h-11 rounded-xl px-4">
              <ScanLine /> Scan register
            </Button>
            <Button render={<Link href={`/expenses?trip=${tripId}`} />} nativeButton={false} variant="outline" className="h-11 rounded-xl px-4">
              <Plus /> Add expense
            </Button>
          </div>
        }
      />
    )
  }

  // getExpenses already sorts by date desc, then newest first within a day.
  const days = new Map<string, Expense[]>()
  for (const e of expenses) (days.get(e.date) ?? days.set(e.date, []).get(e.date)!).push(e)

  async function remove(e: Expense) {
    setOpen(false) // the confirm is its own modal; don't stack it on the edit dialog
    const ok = await confirmDialog({
      title: 'Delete this entry?',
      description: `${nameOf(e)} · ${formatINR(e.amount)} on ${formatDate(e.date)} will be removed from this trip.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return setOpen(true)
    startDelete(async () => {
      const res = await deleteExpense(e.id)
      if (res.success) toast.success('Entry deleted')
      else toast.error(res.error)
    })
  }

  return (
    <>
      <div className="space-y-4">
        {[...days].map(([date, rows]) => (
          <div key={date}>
            <div className="flex items-baseline justify-between px-1 pb-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{formatDate(date, { weekday: true })}</span>
              <span className="tabular-nums">{formatINR(rows.reduce((a, e) => a + e.amount, 0))}</span>
            </div>
            <Panel className="divide-y overflow-hidden">
              {rows.map(e => (
                <button
                  key={e.id}
                  type="button"
                  disabled={deleting && editing?.id === e.id}
                  onClick={() => {
                    setEditing(e)
                    setOpen(true)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted active:bg-muted disabled:animate-pulse disabled:opacity-50"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: GROUP_COLOR[groupOf(e.category_id ? byId.get(e.category_id) : undefined)] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{nameOf(e)}</span>
                    {e.notes && <span className="block truncate text-xs text-muted-foreground">{e.notes}</span>}
                  </span>
                  {e.paid_by === 'driver' && <Badge variant="default">Driver</Badge>}
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(e.amount)}</span>
                </button>
              ))}
            </Panel>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 rounded-3xl p-5 sm:max-w-md sm:p-6">
          {editing && (
            <ExpenseForm key={editing.id} expense={editing} categories={categories} onSaved={() => setOpen(false)} onDelete={() => remove(editing)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExpenseForm({
  expense,
  categories,
  onSaved,
  onDelete,
}: {
  expense: Expense
  categories: Category[]
  onSaved: () => void
  onDelete: () => void
}) {
  const [categoryId, setCategoryId] = useState(expense.category_id)
  const [amount, setAmount] = useState(String(expense.amount))
  const [date, setDate] = useState(expense.date)
  const [notes, setNotes] = useState(expense.notes ?? '')
  const [byDriver, setByDriver] = useState(expense.paid_by === 'driver')
  const [pending, startTransition] = useTransition()
  // Hidden categories stay pickable only for the entry that already uses one.
  const options = categories.filter(c => c.is_active || c.id === expense.category_id)

  function save(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!categoryId) return toast.error('Pick a category')
    if (!(n > 0)) return toast.error('Amount must be above zero')
    startTransition(async () => {
      const res = await updateExpense(expense.id, { category_id: categoryId, amount: n, date, notes, paid_by: byDriver ? 'driver' : 'owner' })
      if (!res.success) return void toast.error(res.error)
      onSaved()
      toast.success('Entry updated')
    })
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1.5 pr-8">
        <DialogTitle className="text-lg font-semibold">Edit entry</DialogTitle>
        <DialogDescription>Changes update this trip’s totals right away.</DialogDescription>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-category" className="text-xs font-medium text-muted-foreground">
          Category
        </Label>
        <Select value={categoryId} onValueChange={v => v && setCategoryId(v)} items={options.map(c => ({ value: c.id, label: c.name }))}>
          <SelectTrigger id="entry-category" className="h-11 w-full rounded-xl px-3.5">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72 rounded-xl">
            {CATEGORY_GROUPS.map(g => {
              const list = options.filter(c => groupOf(c) === g)
              return list.length ? (
                <SelectGroup key={g}>
                  <SelectLabel>{g}</SelectLabel>
                  {list.map(c => (
                    <SelectItem key={c.id} value={c.id} className="py-2">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="entry-amount" className="text-xs font-medium text-muted-foreground">
            Amount
          </Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
            <Input
              id="entry-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="h-11 rounded-xl pl-8 font-semibold tabular-nums"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entry-date" className="text-xs font-medium text-muted-foreground">
            Date
          </Label>
          <Input id="entry-date" type="date" required value={date} onChange={e => setDate(e.target.value)} className="h-11 rounded-xl px-3" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-note" className="text-xs font-medium text-muted-foreground">
          Note
        </Label>
        <Input id="entry-note" value={notes} onChange={e => setNotes(e.target.value)} placeholder="As written in the register" className="h-11 rounded-xl px-3.5" />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={byDriver}
        onClick={() => setByDriver(v => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          <span className="block text-sm font-medium">Paid by driver</span>
          <span className="block text-xs text-muted-foreground">Driver paid this from his own pocket</span>
        </span>
        <span className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', byDriver ? 'bg-primary' : 'bg-input')}>
          <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform', byDriver && 'translate-x-4')} />
        </span>
      </button>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="destructive" onClick={onDelete} disabled={pending} className="h-11 rounded-xl px-4">
          <Trash2 /> Delete
        </Button>
        <Button type="submit" disabled={pending} className="h-11 flex-1 rounded-xl">
          {pending && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}
