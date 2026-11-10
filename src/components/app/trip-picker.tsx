'use client'

import { Plus, Truck } from 'lucide-react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LiveDot } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Trip } from '@/lib/types'

export const NEW_TRIP = '__new__'

function tripTitle(t: Trip) {
  return t.vehicle_number?.toUpperCase() || t.commodity || 'Trip'
}
function tripSub(t: Trip) {
  return [t.vehicle_number ? t.commodity : null, t.route, `from ${formatDate(t.start_date)}`].filter(Boolean).join(' · ')
}

/** Trip selector used by quick entry and the register scanner. Running trips are listed first. */
export function TripPicker({
  trips,
  value,
  onChange,
  allowNew = false,
  className,
}: {
  trips: Trip[]
  value: string
  onChange: (id: string) => void
  allowNew?: boolean
  className?: string
}) {
  const running = trips.filter(t => t.status === 'running')
  const done = trips.filter(t => t.status !== 'running')
  const selected = trips.find(t => t.id === value)

  return (
    <Select value={value || null} onValueChange={v => v && onChange(v)}>
      <SelectTrigger className={cn('h-14 w-full rounded-xl bg-card px-3.5 shadow-sm data-[size=default]:h-14', className)} aria-label="Trip">
        <SelectValue placeholder="Choose a trip">
          {() =>
            value === NEW_TRIP ? (
              <span className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plus className="size-4" /></span>
                <span className="font-medium">New trip</span>
              </span>
            ) : selected ? (
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Truck className="size-4" /></span>
                <span className="flex min-w-0 flex-col items-start">
                  <span className="flex max-w-full items-center gap-1.5 font-medium">
                    <span className="truncate">{tripTitle(selected)}</span>
                    {selected.status === 'running' && <LiveDot />}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{tripSub(selected)}</span>
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Choose a trip</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-80 rounded-xl p-1">
        {allowNew && (
          <>
            <SelectItem value={NEW_TRIP} className="py-2.5">
              <Plus className="text-primary" />
              <span className="font-medium">Start a new trip</span>
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {running.length > 0 && (
          <SelectGroup>
            <SelectLabel>Running</SelectLabel>
            {running.map(t => (
              <SelectItem key={t.id} value={t.id} className="py-2">
                <span className="flex flex-col">
                  <span className="font-medium">{tripTitle(t)}</span>
                  <span className="text-xs text-muted-foreground">{tripSub(t)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {done.length > 0 && (
          <SelectGroup>
            <SelectLabel>Completed</SelectLabel>
            {done.slice(0, 30).map(t => (
              <SelectItem key={t.id} value={t.id} className="py-2">
                <span className="flex flex-col">
                  <span className="font-medium">{tripTitle(t)}</span>
                  <span className="text-xs text-muted-foreground">{tripSub(t)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {trips.length === 0 && !allowNew && <p className="p-4 text-center text-sm text-muted-foreground">No trips yet</p>}
      </SelectContent>
    </Select>
  )
}
