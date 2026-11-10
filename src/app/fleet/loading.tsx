import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <Page title="Fleet">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl lg:h-52" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-80 max-w-full lg:hidden" />
        <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-96 rounded-2xl" />
          ))}
        </div>
        <div className="hidden space-y-px overflow-hidden rounded-2xl border lg:block">
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 rounded-none" />
          ))}
        </div>
      </div>
    </Page>
  )
}
