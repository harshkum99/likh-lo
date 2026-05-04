'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function closeTrip(tripId: string, sellAmount: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('trips')
    .update({
      status: 'completed',
      sell_amount: sellAmount,
      end_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', tripId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Close trip error:', error)
    return { success: false, error: 'Failed to close trip' }
  }

  revalidatePath('/trips')
  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dashboard')
  
  redirect('/trips')
}
