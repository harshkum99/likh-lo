// Helpers shared by the trip screens. No 'use client': used from Server and Client Components alike.
import { formatDate } from '@/lib/format'
import { CATEGORY_GROUPS, type Category, type CategoryGroup, type Trip } from '@/lib/types'

/** "5 Nov → 10 Nov · 6 days", or "Since 5 Nov · Day 6" while running. `days` comes from summarizeTrips. */
export function tripDates(trip: Pick<Trip, 'start_date' | 'end_date' | 'status'>, days: number): string {
  if (trip.status === 'running') return `Since ${formatDate(trip.start_date)} · Day ${days}`
  return `${formatDate(trip.start_date)} → ${formatDate(trip.end_date)} · ${days} ${days === 1 ? 'day' : 'days'}`
}

/** Colour follows the category group, never the rank. */
export const GROUP_COLOR: Record<CategoryGroup, string> = {
  Fuel: 'var(--color-chart-1)',
  Labour: 'var(--color-chart-2)',
  Material: 'var(--color-chart-3)',
  Other: 'var(--color-chart-7)',
}

export function groupOf(c: Category | undefined): CategoryGroup {
  const g = c?.category_group
  return (CATEGORY_GROUPS as readonly string[]).includes(g ?? '') ? (g as CategoryGroup) : 'Other'
}

/** Distinct loads carried before, most recent first (case-insensitive), for form suggestions. */
export function commodityList(trips: Trip[]): string[] {
  const seen = new Map<string, string>()
  for (const t of trips) {
    const c = t.commodity?.trim()
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c)
  }
  return [...seen.values()]
}
