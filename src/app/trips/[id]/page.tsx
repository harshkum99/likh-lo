import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Truck, MapPin, Calendar, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TripActions } from '@/components/trips/trip-actions'
import { TripSummaryCard } from '@/components/trips/trip-summary-card'
import { ExpenseBreakdown } from '@/components/trips/expense-breakdown'
import { TripExpenseList } from '@/components/trips/trip-expense-list'

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
  const { data: expensesData } = await supabase
    .from('expenses')
    .select('*, categories(name)')
    .eq('trip_id', id)
    .order('date', { ascending: false })

  const expenses = expensesData?.map(exp => ({
    ...exp,
    category_name: Array.isArray(exp.categories) ? exp.categories[0]?.name : exp.categories?.name || 'General'
  })) || []

  const totalExpense = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const dayCount = Math.floor((new Date().getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black pb-24 px-6">
      <div className="max-w-md mx-auto space-y-8">
        <div className="pt-6 space-y-4">
          <Link href="/trips" className="flex items-center gap-1 text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-[#1a365d] transition-colors">
            <ChevronLeft className="h-3 w-3" />
            Back to Trips
          </Link>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight leading-tight">
                {trip.commodity || 'General Load'}
              </h1>
              <div className="flex items-center gap-2 text-zinc-400">
                <MapPin className="h-3 w-3" />
                <p className="text-[11px] font-bold uppercase tracking-wider">
                  {trip.route || 'Local'} · Day {dayCount}
                </p>
              </div>
            </div>
            {trip.vehicle_number && (
              <div className="bg-[#1a365d]/5 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-[#1a365d]/10 dark:border-white/10">
                <p className="text-[10px] font-black text-[#1a365d] dark:text-zinc-400 tracking-wider">
                  {trip.vehicle_number}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <TripSummaryCard 
          tripId={id} 
          status={trip.status} 
          revenue={trip.sell_amount} 
          totalExpense={totalExpense} 
        />

        {/* Expense Breakdown Visualization */}
        {expenses.length > 0 && <ExpenseBreakdown expenses={expenses} />}

        {/* Action Buttons */}
        <TripActions tripId={id} />

        <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full" />

        {/* Expense List */}
        <TripExpenseList expenses={expenses} tripId={id} />
      </div>
    </div>
  )
}
