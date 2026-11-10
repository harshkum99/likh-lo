import { CATEGORY_GROUPS, type CategoryGroup } from '@/lib/types'

/** Fixed colour per category group (colour follows the group, never its rank). */
export const GROUP_COLOR: Record<CategoryGroup, string> = {
  Fuel: 'var(--color-chart-1)',
  Labour: 'var(--color-chart-2)',
  Material: 'var(--color-chart-3)',
  Other: 'var(--color-chart-7)',
}
export const groupOf = (g: string): CategoryGroup => (CATEGORY_GROUPS.includes(g as CategoryGroup) ? (g as CategoryGroup) : 'Other')
