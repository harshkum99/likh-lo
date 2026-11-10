'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, ImageIcon, Loader2, PenLine, Plus, RotateCcw, UserRound, Wallet } from 'lucide-react'
import { saveRegisterScan } from '@/app/scan/actions'
import { Panel, Section } from '@/components/app/page'
import { Badge } from '@/components/ui/badge'
import { NEW_TRIP } from '@/components/app/trip-picker'
import { formatPlate } from '@/components/fleet/vehicle-plate'
import { groupOf } from '@/components/trips/shared'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { formatINR, todayISO } from '@/lib/format'
import type { LayoutLine } from '@/lib/register/layout'
import { buildMatcher, type CategoryMatch } from '@/lib/register/match'
import { evalAmount, type ParsedRegister } from '@/lib/register/parse'
import { countDuplicates } from '@/lib/register/review'
import { CATEGORY_GROUPS, type Category, type Trip } from '@/lib/types'
import { cn } from '@/lib/utils'
import { LineCrop, PhotoWithBoxes, type Size } from './photo'
import { Field, TripFields, type TripDraft } from './trip-fields'

/** Slim past expense: teaches the category matcher and powers the duplicate check. */
export interface HistoryEntry {
  trip_id: string | null
  category_id: string | null
  notes: string | null
  amount: number
}

/** Select value prefix for a category that will be created on save ("new:Police"). */
const NEW = 'new:'

interface Row {
  key: number
  /** Index into `lines` (crop + box on the photo); null for rows the owner added. */
  line: number | null
  label: string
  /** As typed: may be an expression ("30932 + 16800"). */
  amount: string
  /** Category id, NEW + name, or '' when none fits. */
  category: string
  /** Name the matcher would create when no category fits. */
  suggestion: string | null
  /** Owner picked the category: stop re-matching when the label changes. */
  picked: boolean
  driver: boolean
  include: boolean
  /** Why the reader is unsure; cleared once the owner edits the row. */
  doubts: string[]
  /** Added with "Add row": focus it, so the owner sees where it went at the end of a long list. */
  fresh?: boolean
}

// A canonical new category ("Police") is preselected; a raw unknown word is only offered, so junk isn't created unseen.
const categoryValue = (m: CategoryMatch | null) => m?.categoryId ?? (m?.newName && m.via !== 'new' ? NEW + m.newName : '')
const amountOf = (text: string) => evalAmount(text).value
const isAmount = (v: number | null): v is number => v !== null && v > 0
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const entries = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`
const squash = (v: string) => v.replace(/[\s-]+/g, '').toUpperCase()

export function Review({
  url,
  size,
  lines,
  parsed,
  manual = false,
  categories,
  history,
  trips,
  tripId,
  onTripChange,
  draft,
  onDraftChange,
  onRestart,
}: {
  url: string
  size: Size | null
  lines: LayoutLine[]
  parsed: ParsedRegister
  /** The reader failed: the owner types the rows while looking at the photo. */
  manual?: boolean
  categories: Category[]
  history: HistoryEntry[]
  trips: Trip[]
  tripId: string
  onTripChange: (id: string) => void
  draft: TripDraft
  onDraftChange: (d: TripDraft) => void
  onRestart: () => void
}) {
  const router = useRouter()
  const match = buildMatcher(categories, history)
  const [rows, setRows] = useState<Row[]>(() => {
    const read = parsed.items.map((item, i): Row => {
      const m = match(item.label)
      const doubts = [...item.warnings]
      if (item.amount !== null && !doubts.length && item.confidence < 0.6) doubts.push('Hard to read: compare with the photo')
      return {
        key: i,
        line: item.line,
        label: item.label,
        amount: item.expr,
        category: categoryValue(m),
        suggestion: m.newName,
        picked: false,
        driver: item.ticked,
        include: item.amount !== null,
        doubts,
      }
    })
    return read.length ? read : [blankRow(0)]
  })
  const [date, setDate] = useState(() => parsed.dateFrom ?? todayISO())
  const [advanceText, setAdvanceText] = useState(parsed.driver.advanceExpr || (parsed.driver.advance ? String(parsed.driver.advance) : ''))
  const [active, setActive] = useState<number | null>(null)
  // Nothing read as an entry (or the reader failed): the owner types the rows, so keep the photo in view.
  const typing = !parsed.items.length
  const [showPhoto, setShowPhoto] = useState(typing)
  const [saving, startSaving] = useTransition()
  // Screen readers land on the summary when the review appears (no scroll, the photo may be above it).
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])

  const isNew = tripId === NEW_TRIP
  const included = rows.filter(r => r.include)
  const values = new Map(rows.map(r => [r.key, amountOf(r.amount)]))
  const total = included.reduce((s, r) => s + (values.get(r.key) ?? 0), 0)
  const missing = included.filter(r => !r.amount.trim()).length
  const badAmounts = included.filter(r => r.amount.trim() && !isAmount(values.get(r.key) ?? null)).length
  const noCategory = included.filter(r => !r.category).length
  const driverPaid = included.reduce((s, r) => s + (r.driver ? (values.get(r.key) ?? 0) : 0), 0)
  const advance = advanceText.trim() ? amountOf(advanceText) : 0
  const flagged = rows.some(r => r.include && (r.doubts.length || !r.category))

  // Same note + amount already on the chosen trip: probably this page was saved before.
  const existing = isNew ? [] : history.filter(h => h.trip_id === tripId)
  const dupes = existing.length ? countDuplicates(included.map(r => ({ label: r.label, amount: values.get(r.key) ?? null })), existing) : 0
  const looksSaved = dupes >= 2 && dupes >= included.length / 2

  const blocker = !tripId
    ? 'Choose a trip'
    : isNew && !draft.vehicle.trim() && !draft.commodity.trim()
      ? 'Add the new trip’s vehicle or load'
      : !date
        ? 'Pick the entry date'
        : !included.length
          ? 'Tick at least one row'
          : badAmounts
            ? `Fix ${plural(badAmounts, 'amount')}`
            : missing
              ? `Enter ${plural(missing, 'amount')}`
              : noCategory
                ? `Pick a category for ${plural(noCategory, 'row')}`
                : advance === null || advance < 0
                  ? 'Fix the cash given to the driver'
                  : null

  const update = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))

  function addRow(from?: { line: number; text: string }) {
    // A numbers-only unread line is an amount; anything else is a label.
    const numeric = !!from && !/\p{L}/u.test(from.text)
    const label = from && !numeric ? from.text : ''
    const m = label ? match(label) : null
    setRows(rs => [
      ...rs,
      { ...blankRow(Math.max(0, ...rs.map(r => r.key)) + 1), line: from?.line ?? null, label, amount: numeric ? from.text : '', category: categoryValue(m), suggestion: m?.newName ?? null, fresh: !from },
    ])
  }

  async function restart() {
    if (await confirmDialog({ title: 'Discard this scan?', description: 'Nothing has been saved yet. You can scan the page again.', confirmLabel: 'Discard', destructive: true })) onRestart()
  }

  async function save() {
    if (blocker) {
      document.querySelector('[data-problem]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return void toast.error(blocker)
    }
    if (
      looksSaved &&
      !(await confirmDialog({
        title: 'Save this page again?',
        description: `${dupes} of these entries are already on this trip with the same note and amount. Saving adds them a second time.`,
        confirmLabel: 'Save anyway',
      }))
    )
      return
    const vehicle = draft.vehicle.trim()
    const known = trips.flatMap(t => (t.vehicle_number ? [t.vehicle_number] : []))
    startSaving(async () => {
      // A dropped connection must not throw: the error page would lose every correction on this screen.
      const res = await saveRegisterScan({
        tripId: isNew ? null : tripId,
        // Reuse a known truck's spelling so "JH01AB1234" and "JH 01 AB 1234" stay one vehicle.
        newTrip: isNew
          ? {
              vehicle_number: vehicle ? (known.find(k => squash(k) === squash(vehicle)) ?? formatPlate(vehicle)) : null,
              commodity: draft.commodity,
              route: draft.route,
              start_date: draft.start || date,
              end_date: draft.end || null,
            }
          : null,
        date,
        rows: included.map(r => ({
          categoryId: r.category.startsWith(NEW) ? null : r.category,
          newCategoryName: r.category.startsWith(NEW) ? r.category.slice(NEW.length) : null,
          amount: values.get(r.key)!,
          label: r.label.trim(),
          paidBy: r.driver ? 'driver' : 'owner',
        })),
        driverAdvance: advance || null,
      }).catch(() => null)
      if (!res) return void toast.error('Couldn’t reach the server', 'Your entries are still here. Check the internet and tap Save again.')
      if (!res.success) return void toast.error(res.error)
      toast.success(`Saved ${entries(res.count)}`, formatINR(total))
      if (res.warning) toast.info(res.warning)
      router.push(`/trips/${res.tripId}`)
    })
  }

  const boxes = rows.map(r => (r.line !== null ? (lines[r.line]?.box ?? null) : null))
  // Keep the card while cash is typed in it: a hidden advance would still be saved.
  const showDriver = parsed.driver.spent !== null || parsed.driver.advance !== null || driverPaid > 0 || !!advanceText.trim()
  const driverGap = parsed.driver.spent !== null && Math.abs(parsed.driver.spent - driverPaid) >= 1

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-6">
      {/* Photo: collapsible on phones, sticky beside the rows on desktop. */}
      <div className="space-y-2 lg:sticky lg:top-6">
        <button
          type="button"
          onClick={() => setShowPhoto(v => !v)}
          aria-expanded={showPhoto}
          className="flex h-11 w-full items-center gap-2 rounded-xl border bg-card px-3.5 text-sm font-medium shadow-sm lg:hidden"
        >
          <ImageIcon className="size-4 text-muted-foreground" />
          {showPhoto ? 'Hide photo' : 'Show the photo'}
          <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform', showPhoto && 'rotate-180')} />
        </button>
        <PhotoWithBoxes
          url={url}
          size={size}
          boxes={boxes}
          active={active}
          className={cn('mx-auto', !showPhoto && 'hidden lg:block')}
          // Fit the whole page in the viewport next to the rows.
          style={size ? { maxWidth: `calc((100dvh - 4rem) * ${size.width / size.height})` } : undefined}
        />
      </div>

      <div className="min-w-0 space-y-4">
        {typing && (
          <Panel className="flex gap-3 border-warning/30 bg-warning/8 p-4 text-sm">
            <PenLine className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              {!manual && 'No entries could be read from this photo. '}Type the entries while looking at the photo.{' '}
              <Link href={isNew ? '/expenses' : `/expenses?trip=${tripId}`} className="font-medium text-primary hover:underline">
                Or use quick add
              </Link>
            </p>
          </Panel>
        )}

        <Panel className="p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h2 ref={heading} tabIndex={-1} className="text-xs font-medium text-muted-foreground outline-none">
                {entries(included.length)}
              </h2>
              <p className="text-3xl font-semibold tracking-tight text-expense tabular-nums">{formatINR(total)}</p>
            </div>
            {driverPaid > 0 && (
              <p className="text-right text-xs text-muted-foreground">
                Driver paid
                <span className="block text-sm font-semibold text-foreground tabular-nums">{formatINR(driverPaid)}</span>
              </p>
            )}
          </div>
          {parsed.writtenTotal !== null && (
            <Reconcile sum={total} written={parsed.writtenTotal} flagged={flagged} />
          )}
        </Panel>

        {/* data-problem: where a blocked Save scrolls to (the first one on the page matches the first blocker). */}
        <div data-problem={(isNew && !draft.vehicle.trim() && !draft.commodity.trim()) || !date || undefined}>
          <TripFields trips={trips} tripId={tripId} onTripChange={onTripChange} draft={draft} onDraftChange={onDraftChange} showDates>
            <Field id="scan-date" label="Entry date">
              <Input id="scan-date" type="date" required value={date} onChange={e => setDate(e.target.value)} className="h-11 rounded-xl bg-card px-3.5" />
            </Field>
          </TripFields>
        </div>

        {looksSaved && (
          <Panel role="alert" className="flex gap-3 border-warning/30 bg-warning/8 p-4 text-sm">
            <Copy className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <span className="font-medium">This page may already be saved.</span> {dupes} of {included.length} entries are already on this trip with the
              same note and amount. Saving again would count them twice.
            </p>
          </Panel>
        )}

        <Section
          title={`Entries · ${rows.length}`}
          action={
            <Button variant="ghost" onClick={() => addRow()} className="h-9 rounded-xl px-2.5 text-primary">
              <Plus /> Add row
            </Button>
          }
        >
          <Panel className="divide-y overflow-hidden">
            {rows.map((r, i) => (
              <RowEditor
                key={r.key}
                row={r}
                value={values.get(r.key) ?? null}
                url={url}
                size={size}
                box={boxes[i]}
                categories={categories}
                active={active === i}
                onActive={on => setActive(on ? i : null)}
                onChange={patch => update(r.key, patch)}
                match={match}
              />
            ))}
          </Panel>
        </Section>

        {parsed.unparsed.length > 0 && (
          <details className="group rounded-2xl border bg-card shadow-sm shadow-black/[0.03]">
            <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
              Unread lines · {parsed.unparsed.length}
              <span className="text-xs font-normal text-muted-foreground">text the reader couldn’t place</span>
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="divide-y border-t">
              {parsed.unparsed.map(u => {
                const added = rows.some(r => r.line === u.line)
                const box = lines[u.line]?.box
                return (
                  <li key={u.line} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      {box && size && <LineCrop url={url} size={size} box={box} />}
                      <p className="truncate font-mono text-xs text-muted-foreground">{u.text}</p>
                    </div>
                    <Button variant="outline" disabled={added} onClick={() => addRow(u)} className="h-9 shrink-0 rounded-xl px-3">
                      {added ? 'Added' : 'Add as row'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </details>
        )}

        {showDriver && (
          <Section title="Driver settlement">
            <Panel data-problem={advance === null || advance < 0 || undefined} className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Paid by driver (rows marked “Driver paid”)</p>
                  <p className="text-xl font-semibold tracking-tight tabular-nums">{formatINR(driverPaid)}</p>
                  {driverGap && <p className="mt-1 text-xs text-muted-foreground">Tap “Driver paid” on each row he paid until it matches the page.</p>}
                </div>
                {parsed.driver.spent !== null &&
                  (driverGap ? (
                    <Badge variant="warning">Page says {formatINR(parsed.driver.spent)}</Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 /> Same as page
                    </Badge>
                  ))}
              </div>
              <Field id="scan-advance" label="Cash given to driver (Driver Jama)">
                <AmountInput id="scan-advance" value={advanceText} onChange={setAdvanceText} invalid={advance === null || advance < 0} />
              </Field>
              <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm">
                <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {!advance
                    ? `Driver paid ${formatINR(driverPaid)} himself. Enter the cash you gave him to see who owes whom.`
                    : driverPaid - advance > 0
                      ? `You owe the driver ${formatINR(driverPaid - advance)} for this page.`
                      : driverPaid - advance < 0
                        ? `The driver still has ${formatINR(advance - driverPaid)} of your cash.`
                        : 'Settled: nobody owes anything for this page.'}
                  {!!advance && <span className="block text-xs text-muted-foreground">The cash is added to the trip’s driver advance when you save.</span>}
                </span>
              </p>
            </Panel>
          </Section>
        )}

        {/* Floats above the mobile tab bar (and its raised Scan button); a plain footer on desktop. */}
        <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 lg:static">
          <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-lg shadow-black/5 lg:shadow-sm">
            <Button variant="ghost" onClick={restart} disabled={saving} className="h-11 rounded-xl px-3 text-muted-foreground">
              <RotateCcw /> <span className="hidden sm:inline">Start over</span>
              <span className="sr-only sm:hidden">Start over</span>
            </Button>
            <Button onClick={save} disabled={saving} className="h-11 min-w-0 flex-1 rounded-xl text-sm active:scale-[0.98]">
              {saving ? (
                <>
                  <Loader2 className="animate-spin" /> Saving…
                </>
              ) : (
                <span className="truncate tabular-nums">{blocker ?? `Save ${entries(included.length)} · ${formatINR(total)}`}</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function blankRow(key: number): Row {
  return { key, line: null, label: '', amount: '', category: '', suggestion: null, picked: false, driver: false, include: true, doubts: [] }
}

function Reconcile({ sum, written, flagged }: { sum: number; written: number; flagged: boolean }) {
  const diff = written - sum
  if (Math.abs(diff) < 1)
    return (
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-positive/10 px-3 py-2 text-sm font-medium text-positive">
        <CheckCircle2 className="size-4 shrink-0" /> Matches the page total {formatINR(written)}
      </p>
    )
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/12 px-3 py-2 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium tabular-nums">
          {formatINR(Math.abs(diff))} {diff > 0 ? 'less' : 'more'}
        </span>{' '}
        than the page total {formatINR(written)} — {flagged ? 'check highlighted rows' : 'compare the rows with the photo'}
      </span>
    </p>
  )
}

/** Amount field that accepts sums like "30932+16800" or "500x6" and shows the result. */
function AmountInput({ id, value, onChange, invalid, label }: { id?: string; value: string; onChange: (v: string) => void; invalid: boolean; label?: string }) {
  const v = amountOf(value)
  const isSum = v !== null && value.replace(/[\s,]/g, '') !== String(v)
  return (
    <div className="space-y-1">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
        <Input
          id={id}
          aria-label={label}
          // The phone keypad has digits plus "+" and "*", so sums can be typed; a decimal pad has no "+".
          inputMode="tel"
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          placeholder="0"
          className="h-11 rounded-xl bg-card pl-8 font-semibold tabular-nums"
        />
      </div>
      {invalid ? (
        <p className="text-xs text-destructive">Type a number, e.g. 3500 or 500x6</p>
      ) : (
        isSum && <p className="text-xs text-muted-foreground tabular-nums">= {formatINR(v)}</p>
      )}
    </div>
  )
}

function RowEditor({
  row,
  value,
  url,
  size,
  box,
  categories,
  active,
  onActive,
  onChange,
  match,
}: {
  row: Row
  value: number | null
  url: string
  size: Size | null
  box: LayoutLine['box'] | null
  categories: Category[]
  active: boolean
  onActive: (on: boolean) => void
  onChange: (patch: Partial<Row>) => void
  match: (label: string) => CategoryMatch
}) {
  const options = categories.filter(c => c.is_active || c.id === row.category)
  const items: Record<string, string> = Object.fromEntries(options.map(c => [c.id, c.name]))
  if (row.suggestion) items[NEW + row.suggestion] = `New · ${row.suggestion}`
  const invalid = row.include && !!row.amount.trim() && !isAmount(value)
  const reasons = row.include && !row.category ? [...row.doubts, 'Pick a category'] : row.doubts

  return (
    <div
      onPointerEnter={() => onActive(true)}
      onPointerLeave={() => onActive(false)}
      onFocus={() => onActive(true)}
      data-problem={(row.include && (!isAmount(value) || !row.category)) || undefined}
      className={cn(
        'space-y-2.5 p-3 transition-colors sm:p-4',
        reasons.length > 0 ? 'bg-warning/8' : !row.include ? 'bg-muted/40' : active && 'bg-accent/40',
      )}
    >
      <div className="flex items-center gap-2">
        <label className="-m-1.5 flex size-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={row.include}
            onChange={e => onChange({ include: e.target.checked })}
            aria-label={`Save ${row.label || 'this row'}`}
            className="size-5 accent-primary"
          />
        </label>
        {box && size ? (
          <LineCrop url={url} size={size} box={box} className={cn(!row.include && 'opacity-60')} />
        ) : (
          <span className="text-xs text-muted-foreground">{row.line === null ? 'Added by you' : 'No photo crop'}</span>
        )}
      </div>

      <div className={cn('grid grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)] gap-2', !row.include && 'opacity-60')}>
        <Input
          aria-label="What it was for"
          autoFocus={row.fresh}
          value={row.label}
          placeholder="e.g. Diesel"
          onChange={e => {
            const label = e.target.value
            const m = row.picked ? null : match(label)
            onChange({ label, doubts: [], ...(m && { category: categoryValue(m), suggestion: m.newName }) })
          }}
          className="h-11 rounded-xl bg-card px-3"
        />
        <AmountInput
          label="Amount"
          value={row.amount}
          invalid={invalid}
          // Typing an amount into an unticked row means the owner wants it.
          onChange={amount => onChange({ amount, doubts: [], ...(!row.include && isAmount(amountOf(amount)) && { include: true }) })}
        />
      </div>

      <div className={cn('flex gap-2', !row.include && 'opacity-60')}>
        <Select value={row.category || null} onValueChange={v => v && onChange({ category: v, picked: true })} items={items}>
          <SelectTrigger aria-label="Category" aria-invalid={(row.include && !row.category) || undefined} className="h-11 min-w-0 flex-1 rounded-xl bg-card px-3 data-[size=default]:h-11">
            <SelectValue placeholder="Choose category" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72 rounded-xl">
            {row.suggestion && (
              <SelectGroup>
                <SelectLabel>Suggested</SelectLabel>
                <SelectItem value={NEW + row.suggestion} className="py-2">
                  <Plus className="text-primary" /> New · {row.suggestion}
                </SelectItem>
              </SelectGroup>
            )}
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
        <button
          type="button"
          aria-pressed={row.driver}
          onClick={() => onChange({ driver: !row.driver })}
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
            row.driver ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          <UserRound className="size-4" /> Driver paid
        </button>
      </div>

      {reasons.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {reasons.join(' · ')}
        </p>
      )}
    </div>
  )
}
