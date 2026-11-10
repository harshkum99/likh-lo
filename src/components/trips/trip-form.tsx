'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createTrip, updateTrip, type TripInput } from '@/app/trips/actions'
import { Panel } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { formatPlate } from '@/components/fleet/vehicle-plate'
import { todayISO } from '@/lib/format'
import type { Trip, TripStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const noSubscribe = () => () => {}
const INPUT = 'h-11 rounded-xl bg-card px-3.5'
const squash = (v: string) => v.replace(/[\s-]+/g, '').toUpperCase()
/** Reuse a known vehicle's spelling so "JH01AB1234" and "JH 01 AB 1234" stay one truck in the fleet stats. */
const canonicalVehicle = (v: string, known: string[]) => (v.trim() ? (known.find(k => squash(k) === squash(v)) ?? formatPlate(v)) : '')

/** New trip (no `trip`) or edit an existing one. Expenses are edited on the trip page, not here. */
export function TripForm({
  trip,
  vehicles,
  commodities,
  defaultVehicle = '',
}: {
  trip?: Trip
  vehicles: string[]
  commodities: string[]
  defaultVehicle?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The browser's date, not the server's: a UTC server is a day behind IST until 05:30.
  const today = useSyncExternalStore(noSubscribe, todayISO, () => '')
  const [vehicle, setVehicle] = useState(trip?.vehicle_number?.toUpperCase() ?? canonicalVehicle(defaultVehicle, vehicles))
  const [commodity, setCommodity] = useState(trip?.commodity ?? '')
  const [route, setRoute] = useState(trip?.route ?? '')
  const [startDate, setStartDate] = useState(trip?.start_date ?? '')
  const [status, setStatus] = useState<TripStatus>(trip?.status ?? 'running')
  const [endDate, setEndDate] = useState(trip?.end_date ?? '')
  const [sell, setSell] = useState(trip?.sell_amount ? String(trip.sell_amount) : '')
  const [advance, setAdvance] = useState(trip?.driver_advance ? String(trip.driver_advance) : '')
  const [notes, setNotes] = useState(trip?.notes ?? '')
  const start = startDate || today

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle.trim() && !commodity.trim()) return toast.error('Add a vehicle number or what the truck is carrying')
    const sellAmount = Number(sell || 0)
    const advanceAmount = Number(advance || 0)
    if (!(sellAmount >= 0) || !(advanceAmount >= 0)) return toast.error('Amounts must be numbers of zero or more')

    const input: TripInput = {
      vehicle_number: canonicalVehicle(vehicle, vehicles),
      commodity,
      route,
      start_date: start,
      driver_advance: advanceAmount,
      ...(trip && { status, end_date: status === 'completed' ? endDate || today : null, sell_amount: sellAmount, notes }),
    }

    startTransition(async () => {
      const res = trip ? await updateTrip(trip.id, input) : await createTrip(input)
      if (!res.success) return void toast.error(res.error)
      toast.success(trip ? 'Trip updated' : 'Trip started', trip ? undefined : 'Now scan or add its expenses as they happen.')
      router.push(`/trips/${trip?.id ?? ('id' in res ? res.id : '')}`)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Panel className="space-y-4 p-4 sm:p-5">
        <Field id="vehicle" label="Vehicle number">
          <Input
            id="vehicle"
            list="trip-vehicles"
            value={vehicle}
            onChange={e => setVehicle(e.target.value.toUpperCase())}
            placeholder="JH 01 AB 1234"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={cn(INPUT, 'font-mono tracking-wide')}
          />
          <datalist id="trip-vehicles">
            {vehicles.map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>
          {!trip && vehicles.length > 0 && (
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pt-1">
              {vehicles.slice(0, 6).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVehicle(v)}
                  aria-pressed={vehicle === v}
                  className={cn(
                    'h-8 shrink-0 rounded-lg border px-2.5 font-mono text-xs font-medium transition',
                    vehicle === v ? 'border-primary bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field id="commodity" label="Load (what is the truck carrying?)">
          <Input
            id="commodity"
            list="trip-commodities"
            value={commodity}
            onChange={e => setCommodity(e.target.value)}
            placeholder="Balu, stone chips, coal…"
            autoComplete="off"
            className={INPUT}
          />
          <datalist id="trip-commodities">
            {commodities.map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field id="route" label="Route" hint="From → To">
          <Input id="route" value={route} onChange={e => setRoute(e.target.value)} placeholder="Dhanbad → Ranchi" autoComplete="off" className={INPUT} />
        </Field>
      </Panel>

      <Panel className="space-y-4 p-4 sm:p-5">
        {trip && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Segmented
              aria-label="Trip status"
              value={status}
              onChange={v => {
                setStatus(v)
                if (v === 'completed' && !endDate) setEndDate(today)
              }}
              options={[
                { value: 'running', label: 'Running' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="start" label="Start date">
            <Input id="start" type="date" value={start} onChange={e => setStartDate(e.target.value)} required className={INPUT} />
          </Field>
          {trip && status === 'completed' && (
            <Field id="end" label="End date">
              <Input id="end" type="date" value={endDate} min={start} onChange={e => setEndDate(e.target.value)} required className={INPUT} />
            </Field>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {trip && (
            <Field id="sell" label="Sold for" hint={status === 'running' ? 'Fill in when the load is sold' : undefined}>
              <Money id="sell" value={sell} onChange={setSell} />
            </Field>
          )}
          <Field id="advance" label="Driver advance (optional)" hint="Cash given to driver for this trip">
            <Money id="advance" value={advance} onChange={setAdvance} />
          </Field>
        </div>
        {trip && (
          <Field id="notes" label="Notes">
            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="rounded-xl bg-card px-3.5" placeholder="Anything worth remembering" />
          </Field>
        )}
      </Panel>

      <div className="flex gap-2">
        <Button
          render={<Link href={trip ? `/trips/${trip.id}` : '/trips'} />}
          nativeButton={false}
          variant="outline"
          className="h-11 rounded-xl px-5"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="h-11 flex-1 rounded-xl active:scale-[0.98]">
          {pending && <Loader2 className="animate-spin" />}
          {trip ? 'Save changes' : 'Start trip'}
        </Button>
      </div>
    </form>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Money({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className={cn(INPUT, 'pl-8 tabular-nums')}
      />
    </div>
  )
}
