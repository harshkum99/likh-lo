'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { closeTrip } from '@/app/trips/actions'
import { cn } from '@/lib/utils'
import { Wallet, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

interface TripSummaryCardProps {
  tripId: string
  status: 'running' | 'completed'
  revenue: number
  totalExpense: number
}

export function TripSummaryCard({ tripId, status, revenue, totalExpense }: TripSummaryCardProps) {
  const [isClosing, setIsClosing] = useState(false)
  const netProfit = (revenue || 0) - totalExpense

  return (
    <Card className="bg-[#1a365d] text-white rounded-[2rem] border-none shadow-xl overflow-hidden relative">
      <CardContent className="p-8 space-y-8">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em]">Net Profit</p>
            <p className="text-4xl font-black tracking-tight">₹{netProfit.toLocaleString('en-IN')}</p>
          </div>
          <div className={cn(
            "h-12 w-12 rounded-2xl flex items-center justify-center bg-white/10",
            status === 'completed' ? "text-green-400" : "text-amber-400"
          )}>
            <Wallet className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 opacity-50">
              <TrendingUp className="h-3 w-3" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Revenue</p>
            </div>
            <p className="text-xl font-black">₹{(revenue || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 opacity-50">
              <TrendingDown className="h-3 w-3" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Expenses</p>
            </div>
            <p className="text-xl font-black text-orange-400">₹{totalExpense.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {status === 'running' && (
          <div className="pt-2">
            <form action={async (formData) => {
              const sellAmount = formData.get('sell_amount')
              if (!sellAmount) return
              setIsClosing(true)
              await closeTrip(tripId, parseFloat(sellAmount as string))
              setIsClosing(false)
            }} className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Enter Final Sell Amount</p>
                <div className="flex gap-2">
                  <input 
                    name="sell_amount"
                    type="number" 
                    placeholder="₹ 0.00"
                    className="flex-1 h-14 bg-white/10 rounded-2xl px-5 font-black text-lg border-none placeholder:text-white/20 focus:ring-1 focus:ring-white/30"
                    required
                  />
                  <Button 
                    type="submit"
                    className="h-14 bg-white text-[#1a365d] hover:bg-zinc-100 font-black rounded-2xl px-6 shadow-lg"
                    disabled={isClosing}
                  >
                    {isClosing ? '...' : 'Close'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {status === 'completed' && (
          <div className="flex items-center gap-2 py-2 px-4 bg-green-500/20 border border-green-500/30 rounded-2xl w-fit">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Trip Completed</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
