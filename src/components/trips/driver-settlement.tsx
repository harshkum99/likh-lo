'use client'

import { useState, useTransition } from 'react'
import { CircleCheck, HandCoins, Loader2, Pencil, Wallet } from 'lucide-react'
import { updateTrip } from '@/app/trips/actions'
import { Panel } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Register's "Driver Jama" ledger: what the driver paid himself vs cash he was given. */
export function DriverSettlement({ tripId, paid, advance }: { tripId: string; paid: number; advance: number }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [pending, startTransition] = useTransition()
  const balance = Math.round(paid - advance)

  function save(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(value || 0)
    if (!(n >= 0)) return toast.error('Enter an amount of zero or more')
    startTransition(async () => {
      const res = await updateTrip(tripId, { driver_advance: n })
      if (!res.success) return void toast.error(res.error)
      setEditing(false)
      toast.success('Cash given updated')
    })
  }

  const status =
    balance > 0
      ? { icon: HandCoins, text: `You owe the driver ${formatINR(balance)}`, tone: 'bg-warning/12 text-warning' }
      : balance < 0
        ? { icon: Wallet, text: `Driver holds ${formatINR(-balance)} of your money`, tone: 'bg-primary/10 text-primary' }
        : { icon: CircleCheck, text: paid || advance ? 'Settled' : 'Nothing to settle yet', tone: 'bg-positive/12 text-positive' }

  return (
    <Panel className="overflow-hidden">
      <div className="divide-y">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <span className="block text-sm">Paid by driver</span>
            <span className="block text-xs text-muted-foreground">Entries marked “Driver”</span>
          </div>
          <div className="font-semibold tabular-nums">{formatINR(paid)}</div>
        </div>
        <div className="px-4 py-3.5">
          {editing ? (
            <form onSubmit={save} className="space-y-2">
              <label htmlFor="driver-advance" className="block text-sm">
                Cash given to driver
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input
                    id="driver-advance"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    autoFocus
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setEditing(false)}
                    className="h-11 rounded-xl pl-8 tabular-nums"
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => setEditing(false)} className="h-11 rounded-xl px-3.5">
                  Cancel
                </Button>
                <Button type="submit" disabled={pending} className="h-11 rounded-xl px-4">
                  {pending && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block text-sm">Cash given</span>
                <span className="block text-xs text-muted-foreground">Advance handed to the driver</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold tabular-nums">{formatINR(advance)}</span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setValue(advance ? String(advance) : '')
                    setEditing(true)
                  }}
                  aria-label="Edit cash given to driver"
                  className="-mr-2 size-9 rounded-xl text-muted-foreground"
                >
                  <Pencil />
                </Button>
              </div>
            </div>
          )}
        </div>
        {/* wrap: "Driver holds ₹12,345 of your money" does not fit beside the label at 375px */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-muted/40 px-4 py-3.5">
          <div className="text-sm font-medium">Balance</div>
          <div className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', status.tone)}>
            <status.icon className="size-3.5" />
            {status.text}
          </div>
        </div>
      </div>
    </Panel>
  )
}
