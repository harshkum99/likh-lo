'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, MapPin, Calendar, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Trip {
  id: string
  commodity: string
  route: string
  vehicle_number?: string
  status: 'running' | 'completed'
  sell_amount: number
  start_date: string
  end_date?: string
  total_spent: number
}

interface TripListProps {
  initialTrips: Trip[]
}

export function TripList({ initialTrips }: TripListProps) {
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all')

  const filteredTrips = initialTrips.filter(trip => {
    if (filter === 'all') return true
    return trip.status === filter
  })

  const totalTrips = initialTrips.length
  const totalRevenue = initialTrips.reduce((acc, curr) => acc + (curr.sell_amount || 0), 0)
  const totalSpent = initialTrips.reduce((acc, curr) => acc + (curr.total_spent || 0), 0)
  const netPnL = totalRevenue - totalSpent

  return (
    <div className="space-y-6">
      {/* Aggregate Summary Header */}
      <div className="grid grid-cols-3 gap-2 px-6">
        <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Trips</p>
          <p className="text-base font-black text-[#1a365d] dark:text-zinc-100">{totalTrips}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Revenue</p>
          <p className="text-base font-black text-green-600 truncate">₹{totalRevenue}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm space-y-1">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Net P&L</p>
          <p className={cn(
            "text-base font-black truncate",
            netPnL >= 0 ? "text-blue-600" : "text-red-600"
          )}>
            ₹{netPnL}
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex gap-2 px-6 overflow-x-auto no-scrollbar pb-2">
        {(['all', 'running', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
              filter === f 
                ? "bg-[#1a365d] text-white shadow-md" 
                : "bg-white dark:bg-zinc-900 text-zinc-400 border border-zinc-100 dark:border-zinc-800"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Trip Cards */}
      <div className="px-6 space-y-4">
        {filteredTrips.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto">
              <Truck className="h-10 w-10 text-zinc-300" />
            </div>
            <div>
              <p className="text-zinc-500 font-bold">No trips found</p>
              <p className="text-sm text-zinc-400">Try changing your filter or start a new journey.</p>
            </div>
          </div>
        ) : (
          filteredTrips.map((trip) => {
            const pnl = (trip.sell_amount || 0) - (trip.total_spent || 0)
            const dayCount = Math.floor((new Date().getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
            const formattedDate = new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

            return (
              <Link key={trip.id} href={`/trips/${trip.id}`}>
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all active:scale-[0.98]">
                  <CardContent className="p-5 space-y-4">
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-black text-lg leading-tight">
                          {trip.commodity || 'General Load'}
                          {trip.vehicle_number && <span className="text-zinc-400 font-bold ml-1">[{trip.vehicle_number}]</span>}
                        </h3>
                        <div className="flex items-center gap-2 text-zinc-400">
                          <MapPin className="h-3 w-3" />
                          <p className="text-[11px] font-bold uppercase tracking-wider">
                            {trip.route || 'Local'} · {formattedDate} · Day {dayCount}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg",
                        trip.status === 'running' 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
                          : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}>
                        {trip.status}
                      </span>
                    </div>

                    <div className="h-px bg-zinc-50 dark:bg-zinc-800 w-full" />

                    {/* Financial Footer */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">Revenue</p>
                        <p className="text-sm font-black">₹{trip.sell_amount || 0}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">Spent</p>
                        <p className="text-sm font-black text-orange-500">₹{trip.total_spent || 0}</p>
                      </div>
                      <div className="space-y-0.5 text-right">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">P&L</p>
                        <p className={cn(
                          "text-sm font-black",
                          pnl >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          ₹{pnl}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
