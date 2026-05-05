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

export async function addBatchExpenses(tripId: string, expenses: { categoryId: string, amount: number }[]) {
  const supabase = await createClient()
  
  if (!tripId || !expenses || expenses.length === 0) {
    return { success: false, error: 'Trip and at least one expense are required' }
  }

  // 1. Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // 2. Insert the expenses
  const expensesToInsert = expenses.map(exp => ({
    amount: exp.amount,
    category_id: exp.categoryId,
    trip_id: tripId,
    user_id: user.id,
    date: new Date().toISOString().split('T')[0] // Today
  }))

  const { error: insertError } = await supabase
    .from('expenses')
    .insert(expensesToInsert)

  if (insertError) {
    console.error('Insert error:', insertError)
    return { success: false, error: insertError.message }
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  
  return { success: true }
}

export async function updateExpense(expenseId: string, data: { category_id?: string, amount?: number, date?: string, notes?: string }) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('expenses')
    .update(data)
    .eq('id', expenseId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Update expense error:', error)
    return { success: false, error: 'Failed to update expense' }
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  // We don't know the trip ID here, so we might need to pass it or revalidate all trips
  revalidatePath('/trips')
  
  return { success: true }
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Delete expense error:', error)
    return { success: false, error: 'Failed to delete expense' }
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  revalidatePath('/trips')
  
  return { success: true }
}

export async function deactivateCategory(categoryId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Set is_active to false to hide it from the grid.
  // We remove the user_id check to allow hiding default categories too.
  const { error } = await supabase
    .from('categories')
    .update({ is_active: false })
    .eq('id', categoryId)

  if (error) {
    console.error('Category deactivation error:', error)
    return { success: false, error: 'Failed to deactivate category' }
  }

  revalidatePath('/expenses')
  return { success: true }
}

export async function reactivateCategory(categoryId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('categories')
    .update({ is_active: true })
    .eq('id', categoryId)

  if (error) {
    console.error('Category reactivation error:', error)
    return { success: false, error: 'Failed to reactivate category' }
  }

  revalidatePath('/expenses')
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
    .select('id, is_active')
    .ilike('name', cleanName)
    .or(`is_default.eq.true,user_id.eq.${user.id}`)
    .maybeSingle()

  if (existing) {
    if (!existing.is_active) {
      // Reactivate if it was hidden
      return await reactivateCategory(existing.id)
    }
    return { success: false, error: 'A category with this name already exists.' }
  }

  // 2. Create the new category
  const { error } = await supabase
    .from('categories')
    .insert({
      name: cleanName,
      is_default: false,
      is_active: true,
      user_id: user.id
    })


  if (error) {
    console.error('Category creation error:', error)
    return { success: false, error: 'Failed to create category' }
  }

  revalidatePath('/expenses')
  return { success: true }
}

