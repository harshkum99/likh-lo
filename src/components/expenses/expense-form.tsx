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
import { AmountInput } from './amount-input'
import { addExpense } from '@/app/expenses/actions'
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
  
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [tripId, setTripId] = useState<string>(activeTrip?.id || trips[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitting...', { amount, category, tripId })
    if (!amount || !category || !tripId) {
      console.warn('Missing required fields:', { amount, category, tripId })
      return
    }


    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('amount', amount)
      formData.append('categoryName', category)
      formData.append('tripId', tripId)
      
      const result = await addExpense(formData)
      
      if (result.success) {
        setAmount('')
        setCategory(null)
        router.refresh()
      } else {
        alert(result.error || 'Failed to add expense')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const selectedTrip = trips.find(t => t.id === tripId)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Trip Selector Section */}
      <div className="px-6 py-4 space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Selected Trip
        </label>
        <Select value={tripId} onValueChange={setTripId}>
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

      {/* Amount and Numpad Section */}
      <div className="px-6 py-4">
        <AmountInput value={amount} onChange={setAmount} />
      </div>

      <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-6 my-2" />

      {/* Category Section */}
      <div className="px-6 py-4 space-y-4">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
          Select Category
        </label>
        <CategoryGrid 
          categories={categories} 
          selectedCategory={category} 
          onSelect={setCategory} 
        />
      </div>


      {/* Action Section */}
      <div className="px-6 py-6 sticky bottom-0 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <Button 
          type="submit"
          size="lg" 
          className="w-full h-16 text-lg font-bold bg-[#1a365d] hover:bg-[#1a365d]/90 text-white rounded-2xl shadow-xl transition-all active:scale-[0.98]"
          disabled={!amount || !category || !tripId || loading}
        >
          {loading ? 'Adding...' : 'Add expense'}
        </Button>

      </div>
    </form>
  )
}
