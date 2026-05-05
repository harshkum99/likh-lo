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

export async function deleteTrip(tripId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Delete trip error:', error)
    return { success: false, error: 'Failed to delete trip' }
  }

  revalidatePath('/trips')
  revalidatePath('/dashboard')
  
  redirect('/trips')
}

export async function updateTrip(tripId: string, data: { commodity: string, route: string, vehicle_number?: string, sell_amount?: number, status?: 'running' | 'completed', start_date?: string }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase
    .from('trips')
    .update(data)
    .eq('id', tripId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Update trip error:', error)
    return { success: false, error: 'Failed to update trip' }
  }

  revalidatePath('/trips')
  revalidatePath(`/trips/${tripId}`)
  revalidatePath('/dashboard')
  
  return { success: true }
}
