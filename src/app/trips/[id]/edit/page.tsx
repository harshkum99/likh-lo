import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Page } from '@/components/app/page'
import { TripForm } from '@/components/trips/trip-form'
import { commodityList } from '@/components/trips/shared'
import { tripName } from '@/lib/analytics'
import { getTrips, requireUser, vehicleList } from '@/lib/data'

export const metadata: Metadata = { title: 'Edit trip' }

export default async function EditTripPage({ params }: PageProps<'/trips/[id]/edit'>) {
  const [{ supabase, user }, { id }] = await Promise.all([requireUser(), params])
  // All trips (not just this one) so the form can suggest earlier vehicles and loads.
  const trips = await getTrips(supabase, user.id)
  const trip = trips.find(t => t.id === id)
  if (!trip) notFound()

  return (
    <Page title="Edit trip" subtitle={tripName(trip)} back={`/trips/${trip.id}`} width="narrow">
      <TripForm trip={trip} vehicles={vehicleList(trips)} commodities={commodityList(trips)} />
    </Page>
  )
}
