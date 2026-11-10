import { getBusinessData, requireUser, vehicleList } from '@/lib/data'
import { todayISO } from '@/lib/format'
import { DashboardView } from '@/components/dashboard/dashboard-view'

// shortcut: every trip + expense row is sent to the browser so switching period/vehicle is instant; move the
// aggregation server-side (or into a SQL view) once a fleet passes ~5,000 expense rows.
export default async function DashboardPage() {
  const { supabase, user } = await requireUser()
  const [data, { data: notes }] = await Promise.all([
    getBusinessData(supabase, user.id),
    supabase
      .from('dashboard_notes')
      .select('id, content, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <DashboardView
      trips={data.trips}
      expenses={data.expenses}
      categories={data.categories}
      vehicles={vehicleList(data.trips)}
      notes={notes ?? []}
      serverToday={todayISO()}
    />
  )
}
