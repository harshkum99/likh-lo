import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function TripsLoading() {
  return (
    <Page title="Trips" subtitle="Loading…">
      <div className="flex flex-col gap-3 lg:flex-row">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-11 w-full lg:ml-auto lg:w-64" />
      </div>
      <Skeleton className="h-[106px] rounded-2xl" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    </Page>
  )
}
