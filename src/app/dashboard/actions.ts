'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createDashboardNote(content: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error: insertError } = await supabase
    .from('dashboard_notes')
    .insert({ content, user_id: user.id })

  if (insertError) {
    console.error('Insert error:', insertError)
    return { success: false, error: insertError.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateDashboardNote(id: string, content: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error: updateError } = await supabase
    .from('dashboard_notes')
    .update({ content })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Update error:', updateError)
    return { success: false, error: updateError.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteDashboardNote(id: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error: deleteError } = await supabase
    .from('dashboard_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('Delete error:', deleteError)
    return { success: false, error: deleteError.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
