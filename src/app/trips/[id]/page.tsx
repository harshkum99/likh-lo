import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus, ScanLine } from 'lucide-react'
import { Page, Panel, Section } from '@/components/app/page'
import { DriverSettlement } from '@/components/trips/driver-settlement'
import { tripDates } from '@/components/trips/shared'
import { SpendBreakdown } from '@/components/trips/spend-breakdown'
import { TripEntries } from '@/components/trips/trip-entries'
import { TripHeaderActions } from '@/components/trips/trip-header-actions'
import { TripHero } from '@/components/trips/trip-hero'
import { summarizeTrips } from '@/lib/analytics'
import { getCategories, getExpenses, normalizeTrip, requireUser } from '@/lib/data'

export const metadata: Metadata = { title: 'Trip' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function TripPage({ params }: PageProps<'/trips/[id]'>) {
  const [{ supabase, user }, { id }] = await Promise.all([requireUser(), params])
  // A malformed id would make Postgres throw (500) instead of returning nothing.
  if (!UUID.test(id)) notFound()

  const [{ data }, expenses, categories] = await Promise.all([
    supabase.from('trips').select('*').eq('id', id).eq('user_id', user.id).maybeSingle(),
    getExpenses(supabase, user.id, id),
    getCategories(supabase, user.id),
  ])
  if (!data) notFound()
  const trip = normalizeTrip(data)
  const s = summarizeTrips([trip], expenses).get(trip.id)!
  const vehicle = trip.vehicle_number?.toUpperCase()

  return (
    <Page
      back="/trips"
      title={vehicle || trip.commodity || 'Trip'}
      subtitle={[vehicle ? trip.commodity : null, trip.route, tripDates(trip, s.days)].filter(Boolean).join(' · ')}
      actions={<TripHeaderActions id={trip.id} entries={s.entries} />}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
        <div className="space-y-6">
          <TripHero summary={s} />

          <div className="grid grid-cols-2 gap-3">
            <QuickAction href={`/scan?trip=${trip.id}`} icon={ScanLine} title="Scan register page" hint="Fill entries from a photo" primary />
            <QuickAction href={`/expenses?trip=${trip.id}`} icon={Plus} title="Add expense" hint="Type it in yourself" />
          </div>

          <Section title="Driver settlement">
            <DriverSettlement tripId={trip.id} paid={s.driverPaid} advance={trip.driver_advance} />
          </Section>

          {s.spent > 0 && (
            <Section title="Where the money went">
              <SpendBreakdown expenses={expenses} categories={categories} />
            </Section>
          )}

          {trip.notes && (
            <Section title="Notes">
              <Panel className="p-4 text-sm whitespace-pre-line text-muted-foreground">{trip.notes}</Panel>
            </Section>
          )}
        </div>

        <Section title={`Entries${s.entries ? ` · ${s.entries}` : ''}`}>
          <TripEntries tripId={trip.id} expenses={expenses} categories={categories} />
        </Section>
      </div>
    </Page>
  )
}

function QuickAction({
  href,
  icon: Icon,
  title,
  hint,
  primary,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  primary?: boolean
}) {
  return (
    <Link
      href={href}
      // Stacked: two side-by-side cards are only ~165px wide at 375px (and in the lg left column).
      className="flex flex-col gap-3 rounded-2xl border bg-card p-3.5 shadow-sm shadow-black/[0.03] transition outline-none hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <span
        className={
          primary
            ? 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30'
            : 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground'
        }
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
    </Link>
  )
}
