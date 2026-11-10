import type { Metadata } from 'next'
import { Page } from '@/components/app/page'
import { TripForm } from '@/components/trips/trip-form'
import { commodityList } from '@/components/trips/shared'
import { getTrips, requireUser, vehicleList } from '@/lib/data'

export const metadata: Metadata = { title: 'New trip' }

export default async function NewTripPage({ searchParams }: PageProps<'/trips/new'>) {
  const [{ supabase, user }, sp] = await Promise.all([requireUser(), searchParams])
  const trips = await getTrips(supabase, user.id)

  return (
    <Page title="New trip" subtitle="A truck is leaving with a load" back="/trips" width="narrow">
      <TripForm
        vehicles={vehicleList(trips)}
        commodities={commodityList(trips)}
        defaultVehicle={typeof sp.vehicle === 'string' ? sp.vehicle : ''}
      />
    </Page>
  )
}
