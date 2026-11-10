import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <Page title="Add expense" subtitle="Quick entry for a trip" width="narrow">
      <Skeleton className="h-[74px] rounded-2xl" />
      <div className="space-y-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-40 rounded-2xl sm:h-36" />
        <Skeleton className="h-11" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    </Page>
  )
}
