'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { CategoryGrid } from './category-grid'
import { syncTripExpenses } from '../../app/expenses/actions'
import { createClient } from '@/utils/supabase/client'

import { cn } from '@/lib/utils'

interface Trip {
  id: string
  commodity: string
  route: string
  status: 'running' | 'completed'
  start_date: string
}

interface Category {
  id: string
  name: string
  is_default: boolean
  is_active: boolean
  category_group?: string
  user_id?: string
}

export function ExpenseForm({ trips, categories }: { trips: Trip[], categories: Category[] }) {
  const activeTrip = trips.find(t => t.status === 'running')
  
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [tripId, setTripId] = useState<string>(activeTrip?.id || trips[0]?.id || '')
  const [usedCategoryIds, setUsedCategoryIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Fetch existing expenses for the selected trip to pre-fill
  useEffect(() => {
    async function fetchExistingExpenses() {
      if (!tripId) {
        setAmounts({})
        setUsedCategoryIds(new Set())
        return
      }

      setLoading(true)
      const { data } = await supabase
        .from('expenses')
        .select('category_id, amount')
        .eq('trip_id', tripId)
      
      if (data) {
        const newAmounts: Record<string, string> = {}
        const usedIds = new Set<string>()
        
        data.forEach(exp => {
          newAmounts[exp.category_id] = exp.amount.toString()
          usedIds.add(exp.category_id)
        })
        
        setAmounts(newAmounts)
        setUsedCategoryIds(usedIds)
      } else {
        setAmounts({})
        setUsedCategoryIds(new Set())
      }
      setLoading(false)
    }
    fetchExistingExpenses()
  }, [tripId, supabase])

  const handleAmountChange = (categoryId: string, amount: string) => {
    setAmounts(prev => ({
      ...prev,
      [categoryId]: amount
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // We send ALL amounts to sync (including 0 to delete)
    const expensesToSync = Object.entries(amounts).map(([catId, amt]) => ({
      categoryId: catId,
      amount: parseFloat(amt) || 0
    }))

    if (!tripId) return

    setLoading(true)
    try {
      const result = await syncTripExpenses(tripId, expensesToSync)
      
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error || 'Failed to save expenses')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const selectedTrip = trips.find(t => t.id === tripId)
  const totalAmount = Object.values(amounts).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Trip Selector Section */}
      <div className="px-6 py-4 space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">
          Active Trip
        </label>
        <Select value={tripId} onValueChange={(val) => val && setTripId(val)}>
          <SelectTrigger className="w-full h-16 px-5 rounded-[1.5rem] border-none bg-zinc-50 dark:bg-zinc-900 shadow-sm focus:ring-1 focus:ring-zinc-200">
            <SelectValue placeholder="Select a trip">
              {selectedTrip && (
                <div className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      selectedTrip.status === 'running' ? "bg-green-500" : "bg-zinc-400"
                    )} />
                    <span className="font-black text-sm tracking-tight text-[#1a365d] dark:text-zinc-100">
                      {selectedTrip.commodity || 'Unnamed Trip'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-3">
                    {selectedTrip.route || 'Local'}
                  </span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-[1.5rem] border-none shadow-2xl p-2">
            {trips.length === 0 && (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm font-bold text-zinc-400">No trips found</p>
                <Link href="/trips/new">
                  <Button variant="outline" size="sm" className="rounded-xl font-bold">Start New Trip</Button>
                </Link>
              </div>
            )}
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id} className="py-4 rounded-xl focus:bg-zinc-50 dark:focus:bg-zinc-800">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      t.status === 'running' ? "bg-green-500" : "bg-zinc-300"
                    )} />
                    <span className="font-black tracking-tight">{t.commodity || 'Unnamed'}</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-3">
                    {t.route || 'Local'} • {new Date(t.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-6 my-2" />

      {/* Category Section */}
      <div className="px-6 py-4 space-y-4">
        <CategoryGrid 
          categories={categories} 
          amounts={amounts}
          onAmountChange={handleAmountChange}
          usedCategoryIds={usedCategoryIds}
        />
      </div>

      {/* Action Section */}
      <div className="px-6 py-6 sticky bottom-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10 border-t border-zinc-100 dark:border-zinc-800 mt-4">
        <Button 
          type="submit"
          size="lg" 
          className="w-full h-16 text-lg font-black bg-[#1a365d] hover:bg-[#1a365d]/90 text-white rounded-[1.5rem] shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest"
          disabled={!tripId || loading}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </div>
          ) : (
            `Update Log ₹${totalAmount.toLocaleString('en-IN')}`
          )}
        </Button>
      </div>
    </form>
  )
}
