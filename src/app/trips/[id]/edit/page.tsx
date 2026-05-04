import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { TripEditForm } from '@/components/trips/trip-edit-form'

export default async function EditTripPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!trip) notFound()

  return (
    <div className="min-h-screen bg-white dark:bg-black p-6 pb-24">
      <div className="max-w-md mx-auto">
        <TripEditForm trip={trip} />
      </div>
    </div>
  )
}
