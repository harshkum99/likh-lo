import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, Plus, Receipt } from 'lucide-react'
import Link from 'next/link'
import { NotesArea } from '@/components/dashboard/notes-area'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>Unauthorized</div>

  // Fetch summary data from views
  const { data: reportData } = await supabase
    .from('monthly_report')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: false })
    .maybeSingle()

  const { data: activeTrip } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .maybeSingle()

  const { count: totalTrips } = await supabase
    .from('trips')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Fetch total expenses for active trip
  let activeTripSpent = 0
  if (activeTrip) {
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('trip_id', activeTrip.id)
    
    activeTripSpent = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  }

  // Fetch 3 most recent expenses
  const { data: recentExpenses } = await supabase
    .from('expenses')
    .select('*, categories(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  // Fetch dashboard notes
  const { data: notesData } = await supabase
    .from('dashboard_notes')
    .select('id, content, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const dayCount = activeTrip 
    ? Math.floor((new Date().getTime() - new Date(activeTrip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Likh-Lo</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Driver Dashboard</p>
          </div>
          <Link href="/trips/new">
            <Button size="sm" className="rounded-full bg-[#1a365d] h-10 w-10 p-0 shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        {/* Active Trip Card */}
        {activeTrip ? (
          <Card className="bg-[#1a365d] text-white rounded-3xl border-none shadow-xl overflow-hidden relative">
            <div className="absolute right-0 top-0 p-4 opacity-5">
              <Truck className="h-32 w-32 rotate-12" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em]">
                Active Trip · Day {dayCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-2xl font-black tracking-tight">{activeTrip.commodity || 'General Load'}</p>
                <p className="text-sm opacity-70 font-medium">{activeTrip.route || 'Local Route'}</p>
              </div>

              <div className="h-px bg-white/10 w-full" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold opacity-50 uppercase">Revenue</p>
                  <p className={cn(
                    "text-xl font-black",
                    activeTrip.sell_amount === 0 && "opacity-40"
                  )}>
                    ₹{activeTrip.sell_amount || 0}
                  </p>
                  {activeTrip.sell_amount === 0 && (
                    <p className="text-[9px] opacity-40 italic">Pending sell amount</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold opacity-50 uppercase">Spent</p>
                  <p className="text-xl font-black text-orange-400">₹{activeTripSpent}</p>
                </div>
              </div>

              <Link href="/expenses" className="block">
                <Button className="w-full bg-white text-[#1a365d] hover:bg-zinc-100 font-bold rounded-2xl h-14 shadow-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Expense
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2 border-zinc-200 dark:border-zinc-800 bg-transparent rounded-3xl p-8 text-center flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
              <Truck className="h-8 w-8 text-zinc-400" />
            </div>
            <div>
              <p className="font-bold text-lg text-zinc-400">No Active Trip</p>
              <p className="text-sm text-zinc-500">Start a new journey to track expenses</p>
            </div>
            <Link href="/trips/new">
              <Button className="bg-[#1a365d] rounded-xl px-8 h-12 font-bold shadow-lg">
                Start Trip
              </Button>
            </Link>
          </Card>
        )}

        {/* Simplified Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-sm rounded-3xl p-4 bg-white dark:bg-zinc-900">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Trips</p>
            <p className="text-2xl font-black text-[#1a365d] dark:text-zinc-100">{totalTrips || 0}</p>
          </Card>
          <Card className="border-none shadow-sm rounded-3xl p-4 bg-white dark:bg-zinc-900">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Net P&L</p>
            <p className={cn(
              "text-2xl font-black",
              (reportData?.profit || 0) >= 0 ? "text-green-600" : "text-red-600"
            )}>
              ₹{reportData?.profit || 0}
            </p>
          </Card>
        </div>

        {/* Recent Expenses Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Recent Expenses
            </h2>
            <Link href="/expenses" className="text-[10px] font-bold text-blue-600 uppercase hover:underline">
              See all
            </Link>
          </div>
          <div className="space-y-2">
            {!recentExpenses || recentExpenses.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl">No recent expenses</p>
            ) : (
              recentExpenses.map((expense) => {
                const categoryName = Array.isArray(expense.categories) 
                  ? expense.categories[0]?.name 
                  : expense.categories?.name;
                
                return (
                  <div key={expense.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">{categoryName || 'General'}</p>
                      <p className="text-[10px] text-zinc-500 font-medium">
                        {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <p className="font-black text-zinc-900 dark:text-zinc-100">₹{expense.amount}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Notes Area */}
        <div className="pt-2">
          <NotesArea initialNotes={notesData || []} />
        </div>
      </div>
    </div>
  )
}
