'use client'

import { useState } from 'react'
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
import { addBatchExpenses } from '../../app/expenses/actions'

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
}

export function ExpenseForm({ trips, categories }: { trips: Trip[], categories: Category[] }) {

  const activeTrip = trips.find(t => t.status === 'running')
  
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [tripId, setTripId] = useState<string>(activeTrip?.id || trips[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAmountChange = (categoryId: string, amount: string) => {
    setAmounts(prev => ({
      ...prev,
      [categoryId]: amount
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validExpenses = Object.entries(amounts)
      .filter(([_, amt]) => amt && parseFloat(amt) > 0)
      .map(([catId, amt]) => ({
        categoryId: catId,
        amount: parseFloat(amt)
      }))

    if (validExpenses.length === 0 || !tripId) {
      return
    }

    setLoading(true)
    try {
      const result = await addBatchExpenses(tripId, validExpenses)
      
      if (result.success) {
        setAmounts({})
        router.refresh()
      } else {
        alert(result.error || 'Failed to add expenses')
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
      <div className="px-6 py-4 space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Selected Trip
        </label>
        <Select value={tripId} onValueChange={(val) => val && setTripId(val)}>

          <SelectTrigger className="w-full h-14 px-4 rounded-2xl border-zinc-100 bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm">
            <SelectValue placeholder="Select a trip">
              {selectedTrip && (
                <span className="flex items-center gap-2">
                  <span className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    selectedTrip.status === 'running' ? "bg-green-500" : "bg-zinc-400"
                  )} />
                  <span className="font-bold text-sm">
                    {selectedTrip.commodity || 'Unnamed Trip'} · {selectedTrip.route || 'Local'}
                  </span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
            {trips.length === 0 && (
              <div className="p-4 text-center text-sm text-zinc-500">
                No trips found. <Link href="/trips/new" className="text-blue-500 underline">Start one</Link>
              </div>
            )}
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id} className="py-3 rounded-xl">
                <span className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      t.status === 'running' ? "bg-green-500" : "bg-zinc-400"
                    )} />
                    <span className="font-bold">{t.commodity || 'Unnamed'}</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 pl-3">
                    {t.route || 'Local'} • {t.start_date}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-6 my-2" />

      {/* Category Section */}
      <div className="px-6 py-4 space-y-4">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Enter Expenses
        </label>
        <CategoryGrid 
          categories={categories} 
          amounts={amounts}
          onAmountChange={handleAmountChange}
        />
      </div>


      {/* Action Section */}
      <div className="px-6 py-6 sticky bottom-0 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <Button 
          type="submit"
          size="lg" 
          className="w-full h-16 text-lg font-bold bg-[#1a365d] hover:bg-[#1a365d]/90 text-white rounded-2xl shadow-xl transition-all active:scale-[0.98]"
          disabled={totalAmount === 0 || !tripId || loading}
        >
          {loading ? 'Adding...' : `Add ${totalAmount > 0 ? `₹${totalAmount}` : 'Expenses'}`}
        </Button>

      </div>
    </form>
  )
}
