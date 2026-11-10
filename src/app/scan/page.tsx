import type { Metadata } from 'next'
import { Page } from '@/components/app/page'
import { Scanner } from '@/components/scan/scanner'
import { getCategories, getExpenses, getTrips, requireUser } from '@/lib/data'

export const metadata: Metadata = { title: 'Scan register' }

export default async function ScanPage({ searchParams }: PageProps<'/scan'>) {
  const [{ supabase, user }, { trip }] = await Promise.all([requireUser(), searchParams])
  const [trips, categories, expenses] = await Promise.all([
    getTrips(supabase, user.id),
    getCategories(supabase, user.id),
    getExpenses(supabase, user.id),
  ])
  // Only what the category matcher and the duplicate check need.
  const history = expenses.map(e => ({ trip_id: e.trip_id, category_id: e.category_id, notes: e.notes, amount: e.amount }))

  return (
    <Page title="Scan register" subtitle="AI reads your handwriting on this device — nothing is uploaded">
      <Scanner trips={trips} categories={categories} history={history} wantedTripId={typeof trip === 'string' ? trip : undefined} />
    </Page>
  )
}
