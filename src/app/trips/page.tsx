import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, Calendar, MapPin, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function TripsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
      <div className="max-w-md mx-auto">
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Trips</h1>
            <p className="text-sm text-zinc-500 font-medium">Your journey history</p>
          </div>
          <Link href="/trips/new">
            <Button size="sm" className="rounded-full bg-[#1a365d] h-12 w-12 p-0 shadow-lg transition-transform active:scale-95">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        <div className="px-6 space-y-4">
          {trips?.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <Truck className="h-10 w-10 text-zinc-300" />
              </div>
              <p className="text-zinc-500 font-medium">No trips recorded yet.</p>
              <Link href="/trips/new">
                <Button variant="outline" className="rounded-xl">Start your first trip</Button>
              </Link>
            </div>
          ) : (
            trips?.map((trip) => (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="mb-4 border-none shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow active:scale-[0.99] transition-transform">
                  <CardContent className="p-0">
                    <div className="flex">
                      <div className={cn(
                        "w-2",
                        trip.status === 'completed' ? "bg-green-500" : "bg-amber-400"
                      )} />
                      <div className="flex-1 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-lg">{trip.commodity || 'General Load'}</h3>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md",
                            trip.status === 'completed' 
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          )}>
                            {trip.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-zinc-500">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="text-sm font-medium">{trip.route || 'Local Route'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="text-sm font-medium">
                              {new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              {trip.end_date && ` - ${new Date(trip.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center pr-4">
                        <ChevronRight className="h-5 w-5 text-zinc-300" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
