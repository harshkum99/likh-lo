'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { cleanAmount, cleanDate, cleanText, currentUserId, dbError, getCategories, resolveCategoryNames } from '@/lib/data'
import { createTrip, type TripInput } from '@/app/trips/actions'
import type { ActionResult, PaidBy } from '@/lib/types'

export interface ScanRowInput {
  /** Existing category, or null with newCategoryName to create one. */
  categoryId: string | null
  newCategoryName?: string | null
  amount: number
  /** The label as written in the register; stored as the expense note so future scans learn the mapping. */
  label: string
  paidBy: PaidBy
}

export interface ScanSaveInput {
  tripId?: string | null
  /** Used when tripId is empty: creates the trip first. */
  newTrip?: TripInput | null
  /** Expense date for every row (register pages are usually one trip / date range). */
  date: string
  rows: ScanRowInput[]
  /** "Driver Jama" read from the page: added to the trip's driver advance. */
  driverAdvance?: number | null
}

/** Saves reviewed register rows as expenses in one go. */
export async function saveRegisterScan(input: ScanSaveInput): Promise<ActionResult<{ tripId: string; count: number; warning?: string }>> {
  const supabase = await createClient()
  const userId = await currentUserId(supabase)
  const user = userId ? { id: userId } : null
  if (!user) return { success: false, error: 'Please sign in again.' }

  const date = cleanDate(input?.date)
  if (!date) return { success: false, error: 'Pick a valid date for these entries.' }
  const rows = Array.isArray(input.rows) ? input.rows : []
  if (rows.length === 0) return { success: false, error: 'Select at least one row to save.' }
  if (rows.length > 200) return { success: false, error: 'Too many rows (max 200 per page).' }

  const clean: { categoryId: string | null; newName: string | null; amount: number; label: string | null; paidBy: PaidBy }[] = []
  for (const [i, r] of rows.entries()) {
    const amount = cleanAmount(r?.amount)
    if (!amount) return { success: false, error: `Row ${i + 1}: amount must be above zero.` }
    // A non-string id must not slip through as "neither": the insert would then crash after a new trip was created.
    const categoryId = typeof r.categoryId === 'string' && r.categoryId ? r.categoryId : null
    const newName = categoryId ? null : cleanText(r.newCategoryName, 60)
    if (!categoryId && !newName) return { success: false, error: `Row ${i + 1}: choose a category.` }
    clean.push({ categoryId, newName, amount, label: cleanText(r.label, 120), paidBy: r.paidBy === 'driver' ? 'driver' : 'owner' })
  }

  // Validate the advance before any write so a bad value can't leave a half-saved scan.
  const advance = input.driverAdvance ? cleanAmount(input.driverAdvance) : null
  if (input.driverAdvance && !advance) return { success: false, error: 'Driver advance must be a positive amount.' }

  // Categories: existing ids must be visible to this user; new names are created (or reused, case-insensitively).
  const visible = new Set((await getCategories(supabase, user.id)).map(c => c.id))
  if (clean.some(r => r.categoryId && !visible.has(r.categoryId))) return { success: false, error: 'A selected category no longer exists. Refresh and try again.' }
  let created: Map<string, string>
  try {
    created = await resolveCategoryNames(supabase, user.id, clean.flatMap(r => (r.newName ? [r.newName] : [])))
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Could not create categories.' }
  }

  // Trip: existing (must belong to the user) or new.
  let tripId = input.tripId || null
  let currentAdvance = 0
  if (tripId) {
    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).eq('user_id', user.id).maybeSingle()
    if (!trip) return { success: false, error: 'Trip not found.' }
    currentAdvance = Number(trip.driver_advance ?? 0)
  } else {
    if (!input.newTrip) return { success: false, error: 'Choose a trip or start a new one.' }
    const res = await createTrip(input.newTrip)
    if (!res.success) return res
    tripId = res.id
  }

  const { error } = await supabase.from('expenses').insert(
    clean.map(r => ({
      trip_id: tripId,
      user_id: user.id,
      category_id: r.categoryId ?? created.get(r.newName!.toLowerCase())!,
      amount: r.amount,
      date,
      notes: r.label,
      ...(r.paidBy === 'driver' ? { paid_by: 'driver' } : {}),
    })),
  )
  if (error) {
    // Don't leave an empty trip behind; a retry would create a second one.
    if (!input.tripId) await supabase.from('trips').delete().eq('id', tripId!).eq('user_id', user.id)
    return { success: false, error: dbError(error.message) }
  }

  let warning: string | undefined
  if (advance) {
    const { error: advErr } = await supabase
      .from('trips')
      .update({ driver_advance: Math.round((currentAdvance + advance) * 100) / 100 })
      .eq('id', tripId)
      .eq('user_id', user.id)
    // Entries are already saved; report instead of failing so a retry doesn't duplicate them.
    if (advErr) warning = `Entries saved, but the driver advance was not: ${dbError(advErr.message)}`
  }

  revalidatePath('/', 'layout')
  return { success: true, tripId: tripId!, count: clean.length, warning }
}
