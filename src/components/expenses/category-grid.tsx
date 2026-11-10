'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { EyeOff, Loader2, Plus, RotateCcw, Search, X } from 'lucide-react'
import { createCategory, deactivateCategory, reactivateCategory } from '@/app/expenses/actions'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toast'
import { titleCase } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CATEGORY_GROUPS, type ActionResult, type Category, type CategoryGroup } from '@/lib/types'
import { cleanAmountInput } from './amount'

type GroupFilter = 'All' | CategoryGroup
const FILTERS: { value: GroupFilter; label: string }[] = [{ value: 'All', label: 'All' }, ...CATEGORY_GROUPS.map(g => ({ value: g, label: g }))]
const GROUP_OPTIONS = CATEGORY_GROUPS.map(g => ({ value: g, label: g }))

export function CategoryGrid({
  categories,
  usedIds,
  amounts,
  onAmountChange,
}: {
  categories: Category[]
  usedIds: string[]
  amounts: Record<string, string>
  onAmountChange: (categoryId: string, value: string) => void
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<GroupFilter>('All')
  const [managing, setManaging] = useState(false)
  const [adding, setAdding] = useState(false)
  const [seed, setSeed] = useState('')
  // The category last created/restored in the dialog; focus its tile as soon as it arrives in the refreshed props.
  const addedId = useRef<string | null>(null)
  const focusPending = useRef(false)

  useEffect(() => {
    const el = focusPending.current && addedId.current && document.getElementById(`amount-${addedId.current}`)
    if (!el) return
    focusPending.current = false
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })

  const q = query.trim().toLowerCase()
  const used = new Set(usedIds)
  const visible = categories.filter(
    c => c.is_active && (group === 'All' || (c.category_group ?? 'Other') === group) && (!q || c.name.toLowerCase().includes(q)),
  )
  const top = visible.filter(c => used.has(c.id))
  const rest = visible.filter(c => !used.has(c.id))
  const hidden = categories.filter(c => !c.is_active)
  // Only the user's own categories can be hidden (RLS blocks updates to built-in ones).
  const canManage = categories.some(c => c.is_active && !c.is_default)
  // Hiding the last own category removes the toggle, so manage mode must switch off with it.
  const manage = managing && canManage

  function openNew() {
    addedId.current = null
    setSeed(titleCase(query))
    setAdding(true)
  }

  function added(id: string, name: string) {
    addedId.current = id
    focusPending.current = true
    setQuery('')
    setGroup('All')
    setAdding(false)
    toast.success(`“${name}” is ready`, 'Type the amount in its tile.')
  }

  async function hide(c: Category) {
    const name = titleCase(c.name)
    const ok = await confirmDialog({
      title: `Hide “${name}”?`,
      description: 'Old entries keep it. You can bring it back from New category.',
      confirmLabel: 'Hide',
      destructive: true,
    })
    if (!ok) return
    try {
      const res = await deactivateCategory(c.id)
      if (!res.success) return toast.error(res.error)
      onAmountChange(c.id, '')
      toast.success(`Hid “${name}”`)
    } catch {
      toast.error('Could not hide it. Check your internet and try again.')
    }
  }

  const tiles = (list: Category[]) =>
    list.map(c => (
      <Tile
        key={c.id}
        category={c}
        value={amounts[c.id] ?? ''}
        onChange={v => onAmountChange(c.id, v)}
        onHide={manage && !c.is_default ? () => hide(c) : undefined}
      />
    ))

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search categories"
              aria-label="Search categories"
              enterKeyHint="search"
              className="h-11 rounded-xl bg-card pr-10 pl-10"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {canManage && (
            <Button
              variant={manage ? 'secondary' : 'outline'}
              aria-pressed={manage}
              onClick={() => setManaging(!manage)}
              className="h-11 rounded-xl px-3.5"
            >
              {manage ? 'Done' : 'Manage'}
            </Button>
          )}
        </div>
        <Segmented aria-label="Category group" value={group} onChange={setGroup} options={FILTERS} />
        {manage && (
          <p className="px-0.5 text-xs text-muted-foreground">
            Tap <EyeOff className="inline size-3.5 align-[-2px]" /> to hide one of your own categories. Built-in ones can’t be hidden.
          </p>
        )}
      </div>

      {top.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-0.5 text-xs font-medium text-muted-foreground">Used on this trip</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{tiles(top)}</div>
        </div>
      )}

      <div className="space-y-2">
        {top.length > 0 && rest.length > 0 && <h3 className="px-0.5 text-xs font-medium text-muted-foreground">More categories</h3>}
        {visible.length === 0 && (
          <p className="px-0.5 text-sm text-muted-foreground">
            {q ? `No category matches “${query.trim()}”.` : 'No categories in this group yet.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {tiles(rest)}
          <button
            type="button"
            onClick={openNew}
            className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-3 text-center text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-primary/[0.04] hover:text-primary active:scale-[0.98]"
          >
            <Plus className="size-5" />
            <span className="line-clamp-2">{q && visible.length === 0 ? `Create “${titleCase(query)}”` : 'New category'}</span>
          </button>
        </div>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent
          className="gap-5 rounded-3xl p-6 sm:max-w-md"
          finalFocus={() => (addedId.current && document.getElementById(`amount-${addedId.current}`)) || true}
        >
          <NewCategoryForm
            initialName={seed}
            initialGroup={group === 'All' ? 'Other' : group}
            hidden={hidden}
            onAdded={added}
            onCancel={() => setAdding(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Tile({
  category,
  value,
  onChange,
  onHide,
}: {
  category: Category
  value: string
  onChange: (v: string) => void
  onHide?: () => void
}) {
  const name = titleCase(category.name)
  const filled = Number(value) > 0
  const id = `amount-${category.id}`
  return (
    <div className="relative">
      {/* The whole tile is the label, so a tap anywhere focuses the amount. */}
      <label
        htmlFor={id}
        className={cn(
          'flex h-24 cursor-text flex-col justify-between rounded-2xl border bg-card p-3 shadow-sm transition-all focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-primary/15',
          filled && 'border-primary/50 bg-primary/[0.06] ring-1 ring-primary/40',
        )}
      >
        <span className={cn('line-clamp-2 text-xs leading-snug font-medium', onHide && 'pr-8', filled ? 'text-primary' : 'text-muted-foreground')}>
          {name}
        </span>
        <span className="flex items-baseline gap-0.5">
          <span className={cn('text-base font-semibold', filled ? 'text-primary' : 'text-muted-foreground/50')}>₹</span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="0"
            aria-label={`${name} amount in rupees`}
            value={value}
            onChange={e => onChange(cleanAmountInput(e.target.value))}
            className="w-full min-w-0 bg-transparent text-xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/35"
          />
        </span>
      </label>
      {onHide && (
        <button
          type="button"
          onClick={onHide}
          aria-label={`Hide ${name}`}
          className="absolute top-1.5 right-1.5 flex size-9 items-center justify-center rounded-lg bg-background/80 text-muted-foreground ring-1 ring-border transition-colors hover:text-destructive"
        >
          <EyeOff className="size-4" />
        </button>
      )}
    </div>
  )
}

function NewCategoryForm({
  initialName,
  initialGroup,
  hidden,
  onAdded,
  onCancel,
}: {
  initialName: string
  initialGroup: CategoryGroup
  hidden: Category[]
  onAdded: (id: string, name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [group, setGroup] = useState<CategoryGroup>(initialGroup)
  const [busy, startBusy] = useTransition()

  function run(label: string, action: () => Promise<ActionResult<{ id: string }>>) {
    startBusy(async () => {
      try {
        const res = await action()
        if (res.success) onAdded(res.id, label)
        else toast.error(res.error)
      } catch {
        toast.error('Could not save. Check your internet and try again.')
      }
    })
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={e => {
        e.preventDefault()
        if (name.trim()) run(titleCase(name), () => createCategory(name, group))
      }}
    >
      <div className="space-y-1.5">
        <DialogTitle className="text-base font-semibold">New category</DialogTitle>
        <DialogDescription>Add a cost you see in your register, like “Tyre repair” or “Loading”.</DialogDescription>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-category-name" className="text-xs font-medium text-muted-foreground">Name</Label>
        <Input
          id="new-category-name"
          autoFocus
          value={name}
          maxLength={60}
          placeholder="e.g. Tyre repair"
          onChange={e => setName(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Group</p>
        <Segmented aria-label="Group" value={group} onChange={setGroup} options={GROUP_OPTIONS} className="w-full [&>button]:flex-1 [&>button]:justify-center" />
      </div>

      {hidden.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground">Or bring back a hidden one</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map(c => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => run(titleCase(c.name), async () => ({ ...(await reactivateCategory(c.id)), id: c.id }))}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" />
                {titleCase(c.name)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 rounded-xl" disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />}
          Create
        </Button>
      </div>
    </form>
  )
}
