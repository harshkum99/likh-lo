import Link from 'next/link'
import { Plus, ScanLine, Truck } from 'lucide-react'
import { EmptyState, Page } from '@/components/app/page'
import { ExpenseForm, type TripLog } from '@/components/expenses/expense-form'
import { Button } from '@/components/ui/button'
import { getCategories, getExpenses, getTrips, requireUser } from '@/lib/data'

export const metadata = { title: 'Add expense' }

const RECENT_PER_TRIP = 8
const COMPLETED_IN_PICKER = 30

export default async function ExpensesPage({ searchParams }: PageProps<'/expenses'>) {
  const { trip: wanted } = await searchParams
  const { supabase, user } = await requireUser()
  const [allTrips, categories, expenses] = await Promise.all([
    getTrips(supabase, user.id),
    getCategories(supabase, user.id),
    getExpenses(supabase, user.id),
  ])

  // Quick entry offers running trips + the latest completed ones (+ a linked one), which keeps the per-trip payload small.
  let completed = 0
  const trips = allTrips.filter(t => t.status === 'running' || t.id === wanted || completed++ < COMPLETED_IN_PICKER)
  // The linked trip goes first so TripPicker's 30-completed cut never drops it from the list.
  trips.sort((a, b) => Number(b.id === wanted) - Number(a.id === wanted))

  const logs: Record<string, TripLog> = Object.fromEntries(trips.map(t => [t.id, { spent: 0, entries: 0, used: [], recent: [] }]))
  for (const e of expenses) {
    const log = e.trip_id ? logs[e.trip_id] : undefined
    if (!log) continue
    log.spent += e.amount
    log.entries++
    if (log.recent.length < RECENT_PER_TRIP) log.recent.push(e) // expenses arrive newest first
    if (e.category_id && !log.used.includes(e.category_id)) log.used.push(e.category_id)
  }

  const defaultTripId =
    trips.find(t => t.id === wanted)?.id ?? trips.find(t => t.status === 'running')?.id ?? trips[0]?.id ?? ''

  return (
    <Page title="Add expense" subtitle="Quick entry for a trip" width="narrow">
      {trips.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Start a trip first"
          description="Every expense belongs to a trip. Start one for your truck, or scan a register page to create it for you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button render={<Link href="/trips/new" />} nativeButton={false} className="h-11 rounded-xl px-4">
                <Plus /> Start a trip
              </Button>
              <Button render={<Link href="/scan" />} nativeButton={false} variant="outline" className="h-11 rounded-xl px-4">
                <ScanLine /> Scan register
              </Button>
            </div>
          }
        />
      ) : (
        <ExpenseForm trips={trips} categories={categories} logs={logs} defaultTripId={defaultTripId} />
      )}
    </Page>
  )
}
