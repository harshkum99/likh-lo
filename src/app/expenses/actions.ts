'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addExpense(formData: FormData) {
  const supabase = await createClient()
  
  const amountStr = formData.get('amount') as string
  const categoryName = formData.get('categoryName') as string
  const tripId = formData.get('tripId') as string
  
  if (!amountStr || !categoryName || !tripId) {
    return { success: false, error: 'Amount, category, and trip are required' }
  }


  const amount = parseFloat(amountStr)

  // 1. Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Get category ID from name
  console.log('Looking up category:', categoryName)
  const { data: categoryData, error: catError } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName)
    .order('is_default', { ascending: false }) // Prefer default categories if there's a conflict
    .limit(1)
    .maybeSingle()

  if (catError || !categoryData) {
    console.error('Category lookup error:', catError)
    return { success: false, error: `Category "${categoryName}" not found` }
  }

  // 3. Insert the expense
  console.log('Inserting expense for trip:', tripId)
  const { error: insertError } = await supabase
    .from('expenses')
    .insert({
      amount,
      category_id: categoryData.id,
      trip_id: tripId,
      user_id: user.id,
      date: new Date().toISOString().split('T')[0] // Today
    })

  if (insertError) {
    console.error('Insert error:', insertError)
    return { success: false, error: insertError.message }
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  
  return { success: true }
}

export async function createCategory(name: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const cleanName = name.trim()

  // 1. Check if category already exists (case-insensitive)
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', cleanName)
    .or(`is_default.eq.true,user_id.eq.${user.id}`)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'A category with this name already exists.' }
  }

  // 2. Create the new category
  const { error } = await supabase
    .from('categories')
    .insert({
      name: cleanName,
      is_default: false,
      user_id: user.id
    })


  if (error) {
    console.error('Category creation error:', error)
    return { success: false, error: 'Failed to create category' }
  }

  revalidatePath('/expenses')
  return { success: true }
}

