'use client'

import { Panel } from '@/components/app/page'
import { NEW_TRIP, TripPicker } from '@/components/app/trip-picker'
import { commodityList } from '@/components/trips/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Trip } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Details for a trip created by the scan (dates prefill from the page header). */
export interface TripDraft {
  vehicle: string
  commodity: string
  route: string
  start: string
  end: string
}
export const EMPTY_DRAFT: TripDraft = { vehicle: '', commodity: '', route: '', start: '', end: '' }

const INPUT = 'h-11 rounded-xl bg-card px-3.5'

/** Trip picker; "New trip" reveals the new trip's details. `children` go under the picker (e.g. the entry date). */
export function TripFields({
  trips,
  tripId,
  onTripChange,
  draft,
  onDraftChange,
  showDates = false,
  children,
}: {
  trips: Trip[]
  tripId: string
  onTripChange: (id: string) => void
  draft: TripDraft
  onDraftChange: (d: TripDraft) => void
  showDates?: boolean
  children?: React.ReactNode
}) {
  const set = (k: keyof TripDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onDraftChange({ ...draft, [k]: k === 'vehicle' ? e.target.value.toUpperCase() : e.target.value })
  const vehicles = [...new Set(trips.flatMap(t => (t.vehicle_number ? [t.vehicle_number.toUpperCase()] : [])))]

  return (
    <Panel className="space-y-4 p-4 sm:p-5">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Save to trip</p>
        <TripPicker trips={trips} value={tripId} onChange={onTripChange} allowNew />
      </div>
      {tripId === NEW_TRIP && (
        <div className="grid animate-in gap-3 fade-in-0 sm:grid-cols-2">
          <Field id="scan-vehicle" label="Vehicle number">
            <Input id="scan-vehicle" list="scan-vehicles" value={draft.vehicle} onChange={set('vehicle')} placeholder="JH 01 AB 1234" autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${INPUT} font-mono tracking-wide`} />
            <datalist id="scan-vehicles">
              {vehicles.map(v => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </Field>
          <Field id="scan-load" label="Load">
            <Input id="scan-load" list="scan-loads" value={draft.commodity} onChange={set('commodity')} placeholder="Balu, stone chips…" autoComplete="off" className={INPUT} />
            <datalist id="scan-loads">
              {commodityList(trips).map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field id="scan-route" label="Route" className="sm:col-span-2">
            <Input id="scan-route" value={draft.route} onChange={set('route')} placeholder="Dhanbad → Ranchi" autoComplete="off" className={INPUT} />
          </Field>
          {showDates && (
            <>
              <Field id="scan-start" label="Trip start">
                <Input id="scan-start" type="date" value={draft.start} onChange={set('start')} className={INPUT} />
              </Field>
              <Field id="scan-end" label="Trip end (optional)">
                <Input id="scan-end" type="date" value={draft.end} min={draft.start || undefined} onChange={set('end')} className={INPUT} />
              </Field>
            </>
          )}
        </div>
      )}
      {children}
    </Panel>
  )
}

export function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
