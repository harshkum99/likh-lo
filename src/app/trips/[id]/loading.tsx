import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function TripLoading() {
  return (
    <Page back="/trips" title={<span className="inline-block h-6 w-40 animate-pulse rounded-lg bg-muted align-middle" />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
        <div className="space-y-6">
          <Skeleton className="h-60 rounded-3xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-[70px] rounded-2xl" />
            <Skeleton className="h-[70px] rounded-2xl" />
          </div>
          <Skeleton className="h-44 rounded-2xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </Page>
  )
}
