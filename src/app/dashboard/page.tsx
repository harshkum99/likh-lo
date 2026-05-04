import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, TrendingUp, TrendingDown, Wallet, Plus } from 'lucide-react'
import Link from 'next/link'

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


  const stats = [
    { label: 'Revenue', value: `₹${reportData?.total_revenue || 0}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Expense', value: `₹${reportData?.total_expense || 0}`, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' },
    { label: 'Profit', value: `₹${reportData?.profit || 0}`, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-100' },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/trips/new">
            <Button size="sm" className="rounded-full bg-[#1a365d] h-10 w-10 p-0 shadow-lg">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        {/* Active Trip Card */}
        {activeTrip ? (
          <Card className="bg-[#1a365d] text-white rounded-3xl border-none shadow-xl overflow-hidden relative">
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <Truck className="h-24 w-24 rotate-12" />
            </div>
            <CardHeader>
              <CardTitle className="text-sm font-medium opacity-80 uppercase tracking-widest">Active Trip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-2xl font-bold">{activeTrip.commodity || 'Empty'}</p>
                <p className="text-sm opacity-80">{activeTrip.route || 'No route set'}</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white/10 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs opacity-60">Status</p>
                  <p className="text-sm font-bold">Running</p>
                </div>
                <div className="bg-white/10 rounded-xl px-4 py-2 text-center">
                  <p className="text-xs opacity-60">Started</p>
                  <p className="text-sm font-bold">{new Date(activeTrip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
              <Link href="/expenses">
                <Button variant="secondary" className="w-full mt-2 font-bold rounded-xl h-12">
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

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="border-none shadow-sm rounded-2xl">
                <CardContent className="p-3 flex flex-col items-center gap-1 text-center">
                  <div className={`${stat.bg} ${stat.color} p-2 rounded-xl`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">{stat.label}</p>
                  <p className="text-sm font-bold truncate w-full">{stat.value}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
