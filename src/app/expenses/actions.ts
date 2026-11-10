'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { cleanAmount, cleanDate, cleanText, currentUserId, dbError, guessGroup } from '@/lib/data'
import { todayISO } from '@/lib/format'
import type { ActionResult, PaidBy } from '@/lib/types'

export interface NewExpenseInput {
  categoryId: string
  amount: number
  notes?: string
  date?: string
  paidBy?: PaidBy
}

async function authed() {
  const supabase = await createClient()
  const id = await currentUserId(supabase)
  return { supabase, user: id ? { id } : null }
}

/** Every page shows aggregates, so any write refreshes the whole app. */
function refreshAll() {
  revalidatePath('/', 'layout')
}

/** Adds new expense rows to a trip (quick entry). Amounts are additions, never totals. */
export async function addBatchExpenses(tripId: string, rows: NewExpenseInput[]): Promise<ActionResult<{ count: number }>> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  if (!tripId || !Array.isArray(rows) || rows.length === 0) return { success: false, error: 'Pick a trip and enter at least one amount.' }
  if (rows.length > 200) return { success: false, error: 'Too many rows in one save (max 200).' }

  const { data: trip } = await supabase.from('trips').select('id').eq('id', tripId).eq('user_id', user.id).maybeSingle()
  if (!trip) return { success: false, error: 'Trip not found.' }

  const insert = []
  for (const r of rows) {
    const amount = cleanAmount(r.amount)
    if (!amount || typeof r.categoryId !== 'string') return { success: false, error: 'Every row needs a category and an amount above zero.' }
    insert.push({
      trip_id: tripId,
      user_id: user.id,
      category_id: r.categoryId,
      amount,
      notes: cleanText(r.notes),
      date: cleanDate(r.date) ?? todayISO(),
      ...(r.paidBy === 'driver' ? { paid_by: 'driver' } : {}),
    })
  }

  const { error } = await supabase.from('expenses').insert(insert)
  if (error) return { success: false, error: dbError(error.message) }
  refreshAll()
  return { success: true, count: insert.length }
}

export async function updateExpense(
  expenseId: string,
  patch: { category_id?: string; amount?: number; date?: string; notes?: string | null; paid_by?: PaidBy },
): Promise<ActionResult> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }

  const update: Record<string, unknown> = {}
  if (patch.category_id !== undefined) update.category_id = patch.category_id
  if (patch.amount !== undefined) {
    const amount = cleanAmount(patch.amount)
    if (!amount) return { success: false, error: 'Amount must be above zero.' }
    update.amount = amount
  }
  if (patch.date !== undefined) {
    const date = cleanDate(patch.date)
    if (!date) return { success: false, error: 'Invalid date.' }
    update.date = date
  }
  if (patch.notes !== undefined) update.notes = cleanText(patch.notes)
  if (patch.paid_by !== undefined) update.paid_by = patch.paid_by === 'driver' ? 'driver' : 'owner'

  const { error } = await supabase.from('expenses').update(update).eq('id', expenseId).eq('user_id', user.id)
  if (error) return { success: false, error: dbError(error.message) }
  refreshAll()
  return { success: true }
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const { error } = await supabase.from('expenses').delete().eq('id', expenseId).eq('user_id', user.id)
  if (error) return { success: false, error: error.message }
  refreshAll()
  return { success: true }
}

// shortcut: RLS only lets a user update categories they own, so hiding a *default* category is a silent no-op; needs an
// owner-scoped "hidden categories" table if hiding defaults matters.
export async function deactivateCategory(categoryId: string): Promise<ActionResult> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const { error } = await supabase.from('categories').update({ is_active: false }).eq('id', categoryId)
  if (error) return { success: false, error: 'Failed to hide category' }
  refreshAll()
  return { success: true }
}

export async function reactivateCategory(categoryId: string): Promise<ActionResult> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const { error } = await supabase.from('categories').update({ is_active: true }).eq('id', categoryId)
  if (error) return { success: false, error: 'Failed to restore category' }
  refreshAll()
  return { success: true }
}

export async function createCategory(name: string, group?: string): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await authed()
  if (!user) return { success: false, error: 'Please sign in again.' }
  const cleanName = cleanText(name, 60)
  if (!cleanName) return { success: false, error: 'Enter a category name.' }

  const { data: existing } = await supabase
    .from('categories')
    .select('id, is_active')
    .ilike('name', cleanName)
    .or(`is_default.eq.true,user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (existing.is_active) return { success: false, error: 'A category with this name already exists.' }
    const res = await reactivateCategory(existing.id)
    return res.success ? { success: true, id: existing.id } : res
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: cleanName,
      is_default: false,
      is_active: true,
      user_id: user.id,
      sort_order: 100,
      category_group: group && ['Fuel', 'Labour', 'Material', 'Other'].includes(group) ? group : guessGroup(cleanName),
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Failed to create category' }
  refreshAll()
  return { success: true, id: data.id }
}
