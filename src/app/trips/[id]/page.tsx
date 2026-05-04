import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, MapPin, Calendar, Wallet, Receipt, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { closeTrip } from '../actions'
import { TripActions } from '@/components/trips/trip-actions'



export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch trip details
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single()

  if (!trip) return <div>Trip not found</div>

  // Fetch expenses for this trip
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, categories(name)')
    .eq('trip_id', id)
    .order('date', { ascending: false })

  const totalExpense = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <div className="p-6 pb-2 space-y-4">
          <Link href="/trips" className="flex items-center gap-1 text-zinc-500 text-sm font-bold uppercase tracking-wider">
            <ChevronLeft className="h-4 w-4" />
            Back to Trips
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tight">{trip.commodity || 'Trip Details'}</h1>
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
              trip.status === 'running' ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
            )}>
              {trip.status}
            </span>
          </div>
        </div>

        <div className="px-6 space-y-6">
          {/* Summary Card */}
          <Card className="bg-[#1a365d] text-white rounded-3xl border-none shadow-xl overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Revenue</p>
                  <p className="text-xl font-black">₹{trip.sell_amount || 0}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Total Expense</p>
                  <p className="text-xl font-black">₹{totalExpense}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <p className="text-sm font-bold opacity-80">Net Profit</p>
                <p className="text-2xl font-black">₹{(trip.sell_amount || 0) - totalExpense}</p>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-none shadow-sm rounded-2xl p-4 space-y-2">
              <MapPin className="h-4 w-4 text-zinc-400" />
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Route</p>
              <p className="text-sm font-bold">{trip.route || 'Local'}</p>
            </Card>
            <Card className="border-none shadow-sm rounded-2xl p-4 space-y-2">
              <Calendar className="h-4 w-4 text-zinc-400" />
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Started</p>
              <p className="text-sm font-bold">{new Date(trip.start_date).toLocaleDateString()}</p>
            </Card>
          </div>

          {/* Expense List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Expense Breakdown
            </h3>
            <div className="space-y-2">
              {expenses?.length === 0 ? (
                <p className="text-center py-8 text-zinc-400 text-sm">No expenses logged yet.</p>
              ) : (
                expenses?.map((expense) => (
                  <div key={expense.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <p className="font-bold text-sm">{expense.categories?.name}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(expense.date).toLocaleDateString()}</p>
                    </div>
                    <p className="font-black text-red-500">₹{expense.amount}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Close Trip Button */}
          {trip.status === 'running' && (
            <form action={async (formData) => {
              'use server'
              const sellAmount = formData.get('sell_amount')
              if (!sellAmount) return
              await closeTrip(id, parseFloat(sellAmount as string))
            }} className="pt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Enter Final Sell Amount (₹)</label>
                <input 
                  name="sell_amount"
                  type="number" 
                  placeholder="e.g. 50000"
                  className="w-full h-14 bg-zinc-100 dark:bg-zinc-900 rounded-xl px-4 font-bold text-lg border-none"
                  required
                />
              </div>
              <Button 
                type="submit"
                className="w-full h-16 bg-red-500 hover:bg-red-600 text-white font-black text-lg rounded-2xl shadow-lg"
              >
                Close Trip & Mark Completed
              </Button>
            </form>
          )}

          <TripActions tripId={id} />
        </div>
      </div>
    </div>
  )
}
