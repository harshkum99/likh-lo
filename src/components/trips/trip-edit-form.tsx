'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Truck, MapPin, Package, Calendar, ChevronLeft, CreditCard, Receipt, Loader2 } from 'lucide-react'
import { updateTrip } from '@/app/trips/actions'
import { syncTripExpenses } from '@/app/expenses/actions'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CategoryGrid } from '@/components/expenses/category-grid'

interface Trip {
  id: string
  commodity: string
  route: string
  vehicle_number?: string
  status: 'running' | 'completed'
  sell_amount: number
  start_date: string
  end_date?: string
}

interface Expense {
  id: string
  amount: number
  category_id: string
  date: string
}

interface Category {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
  category_group?: string
}

export function TripEditForm({ 
  trip, 
  expenses: initialExpenses, 
  categories 
}: { 
  trip: Trip, 
  expenses: Expense[], 
  categories: Category[] 
}) {
  const [commodity, setCommodity] = useState(trip.commodity || '')
  const [route, setRoute] = useState(trip.route || '')
  const [vehicleNumber, setVehicleNumber] = useState(trip.vehicle_number || '')
  const [sellAmount, setSellAmount] = useState(trip.sell_amount?.toString() || '0')
  const [startDate, setStartDate] = useState(trip.start_date || new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState<'running' | 'completed'>(trip.status)
  const [loading, setLoading] = useState(false)
  
  // Initialize amounts from current trip expenses
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const initialAmounts: Record<string, string> = {}
    initialExpenses.forEach(exp => {
      initialAmounts[exp.category_id] = exp.amount.toString()
    })
    return initialAmounts
  })
  
  const router = useRouter()

  const handleUpdateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await updateTrip(trip.id, {
        commodity,
        route,
        vehicle_number: vehicleNumber,
        sell_amount: parseFloat(sellAmount),
        status,
        start_date: startDate
      })

      if (result.success) {
        // Sync expenses
        const expensesToSync = Object.entries(amounts).map(([catId, amt]) => ({
          categoryId: catId,
          amount: parseFloat(amt) || 0
        }))
        await syncTripExpenses(trip.id, expensesToSync)
        
        router.push(`/trips/${trip.id}`)
        router.refresh()
      } else {
        alert(result.error || 'Failed to update trip')
      }
    } catch (error: any) {
      alert(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAmountChange = (categoryId: string, amount: string) => {
    setAmounts(prev => ({
      ...prev,
      [categoryId]: amount
    }))
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/trips/${trip.id}`} className="h-10 w-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center">
          <ChevronLeft className="h-6 w-6 text-zinc-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Trip</h1>
          <p className="text-sm text-zinc-500">Update journey & expenses</p>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-1">Trip Details</h2>
          <Card className="border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <form onSubmit={handleUpdateTrip} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    Trip Status
                  </Label>
                  <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setStatus('running')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                        status === 'running' 
                          ? "bg-white dark:bg-zinc-800 text-green-600 shadow-sm" 
                          : "text-zinc-500"
                      )}
                    >
                      Running
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('completed')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                        status === 'completed' 
                          ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm" 
                          : "text-zinc-500"
                      )}
                    >
                      Completed
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commodity" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Commodity
                    </Label>
                    <div className="relative">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input 
                        id="commodity"
                        className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl font-bold"
                        value={commodity}
                        onChange={(e) => setCommodity(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleNumber" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Vehicle Number
                    </Label>
                    <div className="relative">
                      <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input 
                        id="vehicleNumber"
                        className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl font-bold"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        placeholder="e.g. RJ 14 GB 1234"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="route" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Route
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input 
                        id="route"
                        className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl font-bold"
                        value={route}
                        onChange={(e) => setRoute(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sellAmount" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Sell Amount (₹)
                    </Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input 
                        id="sellAmount"
                        type="number"
                        className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl font-bold"
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                      Started On
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
                      <Input 
                        id="startDate"
                        type="date"
                        className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl font-bold"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full h-16 text-lg font-bold bg-[#1a365d] hover:bg-[#1a365d]/90 text-white rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Save All Changes'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-1 flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Edit Trip Expenses
          </h2>
          <CategoryGrid 
            categories={categories} 
            amounts={amounts} 
            onAmountChange={handleAmountChange} 
          />
        </section>
      </div>
    </div>
  )
}
