'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Truck, MapPin, Package, Calendar } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function NewTripPage() {
  const [commodity, setCommodity] = useState('')
  const [route, setRoute] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('trips').insert({
        commodity,
        route,
        user_id: user.id,
        status: 'running',
        start_date: startDate
      })

      if (error) throw error

      router.push('/expenses')
      router.refresh()
    } catch (error: any) {
      alert(error.message || 'Failed to start trip')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-6 pb-24">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Truck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">New Trip</h1>
            <p className="text-sm text-zinc-500">Start a new journey</p>
          </div>
        </div>

        <Card className="border-zinc-100 dark:border-zinc-800 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleStartTrip} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="commodity" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Commodity (What are you carrying?)
                </Label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input 
                    id="commodity"
                    placeholder="e.g. Coal, Steel, Rice"
                    className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl"
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="route" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Route (From → To)
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input 
                    id="route"
                    placeholder="e.g. Delhi → Mumbai"
                    className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl"
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Start Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
                  <Input 
                    id="startDate"
                    type="date"
                    className="pl-10 h-14 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-16 text-lg font-bold bg-[#1a365d] hover:bg-[#1a365d]/90 text-white rounded-2xl shadow-lg transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? 'Starting Journey...' : 'Start Trip'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
