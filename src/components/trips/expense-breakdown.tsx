'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ExpenseBreakdownProps {
  expenses: {
    amount: number
    category_name: string
  }[]
}

export function ExpenseBreakdown({ expenses }: ExpenseBreakdownProps) {
  // Aggregate by category
  const breakdown = expenses.reduce((acc, curr) => {
    const name = curr.category_name || 'Others'
    acc[name] = (acc[name] || 0) + Number(curr.amount)
    return acc
  }, {} as Record<string, number>)

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  
  // Sort by amount descending and take top 5, group others
  const sorted = Object.entries(breakdown)
    .sort(([, a], [, b]) => b - a)
  
  const topCategories = sorted.slice(0, 4)
  const otherAmount = sorted.slice(4).reduce((acc, [, val]) => acc + val, 0)
  
  if (otherAmount > 0) {
    topCategories.push(['Others', otherAmount])
  }

  // Normalize Title Case helper
  const toTitleCase = (str: string) => {
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 px-1">Expense Breakdown</h3>
      <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-zinc-900">
        <CardContent className="p-6 space-y-5">
          {topCategories.map(([name, amount]) => {
            const percentage = total > 0 ? (amount / total) * 100 : 0
            return (
              <div key={name} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{toTitleCase(name)}</p>
                    <p className="text-sm font-black">₹{amount.toLocaleString('en-IN')}</p>
                  </div>
                  <p className="text-[10px] font-black text-zinc-300">{Math.round(percentage)}%</p>
                </div>
                <div className="h-2 bg-zinc-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1a365d] dark:bg-zinc-700 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
