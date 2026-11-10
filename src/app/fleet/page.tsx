import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { requireUser, getBusinessData, vehicleList } from '@/lib/data'
import { vehicleOf } from '@/lib/analytics'
import { todayISO } from '@/lib/format'
import { EmptyState, Page } from '@/components/app/page'
import { Button } from '@/components/ui/button'
import { FleetView } from '@/components/fleet/fleet-view'

export const metadata = { title: 'Fleet' }

export default async function FleetPage() {
  const { supabase, user } = await requireUser()
  const { trips, expenses } = await getBusinessData(supabase, user.id)
  const vehicles = vehicleList(trips).length
  const onRoad = new Set(trips.filter(t => t.status === 'running' && t.vehicle_number?.trim()).map(vehicleOf)).size

  return (
    <Page
      title="Fleet"
      subtitle={`${vehicles} vehicle${vehicles === 1 ? '' : 's'} · ${onRoad} on the road`}
      actions={
        <Button render={<Link href="/trips/new" />} nativeButton={false} className="h-11 rounded-xl px-4">
          <Plus /> New trip
        </Button>
      }
    >
      {trips.length ? (
        <FleetView trips={trips} expenses={expenses} today={todayISO()} />
      ) : (
        <EmptyState
          icon={Truck}
          title="No vehicles yet"
          description="Vehicles show up here on their own once you start a trip with a vehicle number."
          action={
            <Button render={<Link href="/trips/new" />} nativeButton={false} className="h-11 rounded-xl px-5">
              <Plus /> Start a trip
            </Button>
          }
        />
      )}
    </Page>
  )
}
