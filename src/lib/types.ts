// Row shapes as returned by Supabase (see supabase/migrations). NUMERIC columns arrive as numbers.

export type TripStatus = 'running' | 'completed'
export type PaidBy = 'owner' | 'driver'

export interface Trip {
  id: string
  start_date: string
  end_date: string | null
  commodity: string | null
  route: string | null
  vehicle_number: string | null
  sell_amount: number
  status: TripStatus
  notes: string | null
  /** "Driver Jama": cash handed to the driver for this trip. */
  driver_advance: number
  created_at: string
}

export interface Category {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
  sort_order: number
  category_group: string | null
  user_id: string | null
}

export interface Expense {
  id: string
  trip_id: string | null
  category_id: string | null
  amount: number
  date: string
  notes: string | null
  /** 'driver' = paid out of the driver's pocket (ticked in the register). */
  paid_by: PaidBy
  created_at: string
}

export const CATEGORY_GROUPS = ['Fuel', 'Labour', 'Material', 'Other'] as const
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

export type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string }
