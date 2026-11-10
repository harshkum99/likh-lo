'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { cleanAmount, cleanDate, cleanText, currentUserId, dbError } from '@/lib/data'
import { todayISO } from '@/lib/format'
import type { ActionResult, TripStatus } from '@/lib/types'

export interface TripInput {
  commodity?: string | null
  route?: string | null
  vehicle_number?: string | null
  start_date?: string
  end_date?: string | null
  sell_amount?: number | null
  driver_advance?: number | null
  status?: TripStatus
  notes?: string | null
}

async function authed() {
  const supabase = await createClient()
  const id = await currentUserId(supabase)
  return { supabase, user: id ? { id } : null }
}

function refreshAll() {
  revalidatePath('/', 'layout')
}

/** Validates a (partial) trip payload; returns the DB patch or an error message. */
function toTripRow(input: TripInput): { row: Record<string, unknown> } | { error: string } {
  const row: Record<string, unknown> = {}
  if (input.commodity !== undefined) row.commodity = cleanText(input.commodity, 80)
  if (input.route !== undefined) row.route = cleanText(input.route, 120)
  if (input.vehicle_number !== undefined) row.vehicle_number = cleanText(input.vehicle_number, 20)?.toUpperCase() ?? null
  if (input.notes !== undefined) row.notes = cleanText(input.notes, 1000)
  if (input.start_date !== undefined) {
    const d = cleanDate(input.start_date)
    if (!d) return { error: 'Invalid start date.' }
    row.start_date = d
  }
  if (input.end_date !== undefined) {
    if (input.end_date === null || input.end_date === '') row.end_date = null
    else {
      const d = cleanDate(input.end_date)
      if (!d) return { error: 'Invalid end date.' }
      row.end_date = d
    }
  }
  if (row.start_date && row.end_date && String(row.end_date) < String(row.start_date)) return { error: 'End date is before the start date.' }
  for (const key of ['sell_amount', 'driver_advance'] as const) {
    const v = input[key]
    if (v === undefined) continue
    if (v === null || Number(v) === 0) row[key] = 0
    else {
      const n = cleanAmount(v)
      if (n === null) return { error: `${key === 'sell_amount' ? 'Sell amount' : 'Driver advance'} must be a positive number.` }
      row[key] = n
    }
  }
  if (input.status !== undefined) {
    if (input.status !== 'running' && input.status !== 'completed') return { error: 'Invalid status.' }
    row.status = input.status
  }
  return { row }
}

export async function createTrip(input: TripInput): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const parsed = toTripRow({ status: 'running', start_date: todayISO(), ...input })
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { data, error } = await supabase
    .from('trips')
    .insert({ ...parsed.row, user_id: user.id })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: dbError(error?.message ?? 'Failed to create trip') }
  refreshAll()
  return { success: true, id: data.id }
}

export async function updateTrip(tripId: string, input: TripInput): Promise<ActionResult> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const parsed = toTripRow(input)
  if ('error' in parsed) return { success: false, error: parsed.error }

  const { error } = await supabase.from('trips').update(parsed.row).eq('id', tripId).eq('user_id', user.id)
  if (error) return { success: false, error: dbError(error.message) }
  refreshAll()
  return { success: true }
}

/** Marks a trip completed with its final sell amount (end date defaults to today). */
export async function closeTrip(tripId: string, sellAmount: number, endDate?: string): Promise<ActionResult> {
  return updateTrip(tripId, { status: 'completed', sell_amount: sellAmount, end_date: endDate || todayISO() })
}

export async function reopenTrip(tripId: string): Promise<ActionResult> {
  return updateTrip(tripId, { status: 'running', end_date: null })
}

export async function deleteTrip(tripId: string): Promise<ActionResult> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const { error } = await supabase.from('trips').delete().eq('id', tripId).eq('user_id', user.id)
  if (error) return { success: false, error: 'Failed to delete trip' }
  refreshAll()
  return { success: true }
}
