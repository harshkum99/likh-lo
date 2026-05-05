'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteExpense } from '@/app/expenses/actions'
import { Trash2, Edit2, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Expense {
  id: string
  amount: number
  category_name: string
  date: string
}

export function TripExpenseList({ expenses, tripId }: { expenses: Expense[], tripId: string }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return
    setDeletingId(id)
    const result = await deleteExpense(id)
    if (!result.success) {
      alert(result.error)
    }
    setDeletingId(null)
    router.refresh()
  }

  // Normalize Title Case helper
  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formattedDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  return (
    <div className="space-y-4 pb-10">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 px-1 flex items-center gap-2">
        <Receipt className="h-3 w-3" />
        Expense History
      </h3>
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <p className="text-center py-10 text-zinc-400 text-sm font-medium">No expenses logged yet.</p>
        ) : (
          expenses.map((expense) => (
            <div 
              key={expense.id} 
              className={cn(
                "bg-white dark:bg-zinc-900 p-4 rounded-3xl flex items-center justify-between shadow-sm group transition-all",
                deletingId === expense.id && "opacity-50 animate-pulse"
              )}
            >
              <div className="flex-1">
                <p className="font-black text-sm text-[#1a365d] dark:text-zinc-100">
                  {toTitleCase(expense.category_name)}
                </p>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  {formattedDate(expense.date)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-black text-red-500 text-lg">₹{Number(expense.amount).toLocaleString('en-IN')}</p>
                <button 
                  onClick={() => handleDelete(expense.id)}
                  className="p-2 text-zinc-200 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
