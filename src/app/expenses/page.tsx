import { ExpenseForm } from '@/components/expenses/expense-form'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function ExpensesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch all trips for selection
  const { data: trips } = await supabase
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('status', { ascending: false }) // 'running' first
    .order('start_date', { ascending: false })

  // Fetch all categories (default + user's custom)
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .or(`is_default.eq.true,user_id.eq.${user.id}`)
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-24">
      <div className="max-w-md mx-auto">
        <div className="p-6 pb-2">
          <h1 className="text-3xl font-black tracking-tight">Add Expense</h1>
          <p className="text-sm text-zinc-500 font-medium">Log costs for your journeys</p>
        </div>
        
        <ExpenseForm 
          trips={trips || []} 
          categories={categories || []} 
        />
      </div>
    </div>
  )
}
