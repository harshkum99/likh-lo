import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Page } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { TripsView, type StatusFilter } from '@/components/trips/trips-view'
import { summarizeTrips } from '@/lib/analytics'
import { getExpenses, getTrips, requireUser } from '@/lib/data'

export const metadata: Metadata = { title: 'Trips' }

export default async function TripsPage({ searchParams }: PageProps<'/trips'>) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams])
  const [trips, expenses] = await Promise.all([getTrips(supabase, user.id), getExpenses(supabase, user.id)])
  // Ship per-trip summaries, not every expense row, to the client.
  const summaries = [...summarizeTrips(trips, expenses).values()]
  const status: StatusFilter = sp.status === 'running' || sp.status === 'completed' ? sp.status : 'all'
  const vehicle = typeof sp.vehicle === 'string' ? sp.vehicle : null
  const running = trips.filter(t => t.status === 'running').length

  return (
    <Page
      title="Trips"
      subtitle={trips.length ? `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} · ${running} running` : 'Every load, start to sale'}
      actions={
        <Button render={<Link href="/trips/new" />} nativeButton={false} className="h-11 rounded-xl px-4">
          <Plus /> New trip
        </Button>
      }
    >
      {/* key: a new ?status / ?vehicle link resets the client filters */}
      <TripsView key={`${status}|${vehicle}`} summaries={summaries} initialStatus={status} initialVehicle={vehicle} />
    </Page>
  )
}
