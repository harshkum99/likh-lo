import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { TripList } from '@/components/trips/trip-list'

export default async function TripsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch trips with their expenses to calculate totals
  const { data: tripsData } = await supabase
    .from('trips')
    .select(`
      *,
      expenses (
        amount
      )
    `)
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  const trips = tripsData?.map(trip => ({
    ...trip,
    total_spent: trip.expenses?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0
  })) || []

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
      <div className="max-w-md mx-auto">
        <div className="p-6 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">My Trips</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Journey History</p>
          </div>
          <Link href="/trips/new">
            <Button size="sm" className="rounded-full bg-[#1a365d] h-12 w-12 p-0 shadow-lg transition-transform active:scale-95">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        <TripList initialTrips={trips} />
      </div>
    </div>
  )
}
