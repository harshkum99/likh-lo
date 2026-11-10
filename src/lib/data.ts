// Server-side data access shared by pages. Import only from Server Components / Server Actions.
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import type { Category, Expense, Trip } from '@/lib/types'

export type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Signed-in user's id. getClaims() verifies the session JWT locally (cached signing keys) instead of asking the Auth
 * server on every call like getUser() does; projects still on a shared JWT secret fall back to getUser() automatically.
 */
export async function currentUserId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims()
  return data?.claims.sub ?? null
}

/** For pages: returns the client + user, or redirects to /login. */
export async function requireUser() {
  const supabase = await createClient()
  const id = await currentUserId(supabase)
  if (!id) redirect('/login')
  return { supabase, user: { id } }
}

/** Supabase caps responses at 1000 rows (config.toml max_rows); page through so totals are never silently truncated. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

// Normalisers keep pages working against a DB that hasn't run the latest migration yet (missing columns -> defaults).
export function normalizeTrip(t: Record<string, unknown>): Trip {
  return {
    ...(t as unknown as Trip),
    sell_amount: Number(t.sell_amount ?? 0),
    driver_advance: Number(t.driver_advance ?? 0),
  }
}

export function normalizeExpense(e: Record<string, unknown>): Expense {
  return {
    ...(e as unknown as Expense),
    amount: Number(e.amount ?? 0),
    paid_by: e.paid_by === 'driver' ? 'driver' : 'owner',
  }
}

export async function getCategories(supabase: Supabase, userId: string): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,user_id.eq.${userId}`)
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  return (data ?? []) as Category[]
}

export async function getTrips(supabase: Supabase, userId: string): Promise<Trip[]> {
  const rows = await fetchAll<Record<string, unknown>>((a, b) =>
    supabase.from('trips').select('*').eq('user_id', userId)
      .order('start_date', { ascending: false }).order('id').range(a, b))
  return rows.map(normalizeTrip)
}

export async function getExpenses(supabase: Supabase, userId: string, tripId?: string): Promise<Expense[]> {
  const rows = await fetchAll<Record<string, unknown>>((a, b) => {
    let q = supabase.from('expenses').select('*').eq('user_id', userId)
    if (tripId) q = q.eq('trip_id', tripId)
    return q.order('date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(a, b)
  })
  return rows.map(normalizeExpense)
}

/** Everything the dashboard / fleet / trips views aggregate over. */
export async function getBusinessData(supabase: Supabase, userId: string) {
  const [trips, expenses, categories] = await Promise.all([
    getTrips(supabase, userId),
    getExpenses(supabase, userId),
    getCategories(supabase, userId),
  ])
  return { trips, expenses, categories }
}

/** Distinct vehicle numbers, most recently used first (for pickers and filters). */
export function vehicleList(trips: Trip[]): string[] {
  const seen = new Set<string>()
  for (const t of trips) {
    const v = t.vehicle_number?.trim().toUpperCase()
    if (v) seen.add(v)
  }
  return [...seen]
}

// ---- Validation for Server Action inputs (trust boundary: never trust client payloads) ----

export function cleanAmount(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n >= 1e9) return null
  return Math.round(n * 100) / 100
}

export function cleanDate(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null
}

export function cleanText(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

/** Guess the category group for a user-created category from its name. */
export function guessGroup(name: string): string {
  const n = name.toLowerCase()
  if (/diesel|petrol|fuel|cng|urea|def|oil/.test(n)) return 'Fuel'
  if (/labou?r|driver|dalal|khoraki|food|commission|loader|helper|khalasi|majdoor|hamali/.test(n)) return 'Labour'
  if (/material|balu|sand|tyre|tire|welding|repair|grease|jcb|parts|fault|service/.test(n)) return 'Material'
  return 'Other'
}

/**
 * Resolve category names to ids for this user: reuse an existing default/own category (case-insensitive,
 * reactivating hidden ones) or create it. Returns a map keyed by lower-cased name.
 */
export async function resolveCategoryNames(supabase: Supabase, userId: string, names: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(names.map(n => n.trim()).filter(Boolean).map(n => n.slice(0, 60)))]
  const out = new Map<string, string>()
  if (!wanted.length) return out
  const existing = await getCategories(supabase, userId)
  for (const name of wanted) {
    const key = name.toLowerCase()
    if (out.has(key)) continue
    const hit = existing.find(c => c.name.trim().toLowerCase() === key)
    if (hit) {
      if (!hit.is_active) await supabase.from('categories').update({ is_active: true }).eq('id', hit.id)
      out.set(key, hit.id)
      continue
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, is_default: false, is_active: true, user_id: userId, category_group: guessGroup(name), sort_order: 100 })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Could not create category "${name}": ${error?.message ?? 'unknown error'}`)
    out.set(key, data.id)
  }
  return out
}

/** Friendly message when a write fails because the DB is missing the latest migration. */
export function dbError(message: string): string {
  if (/paid_by|driver_advance/.test(message) && /column|schema cache/i.test(message)) {
    return 'Database is missing the latest update. Run supabase/migrations/20261110000000_register_scan_driver_ledger.sql in Supabase, then try again.'
  }
  return message
}
