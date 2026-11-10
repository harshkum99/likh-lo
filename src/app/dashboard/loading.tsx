import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <Page title="Overview">
      <div aria-busy className="space-y-6">
        <span className="sr-only">Loading your dashboard…</span>
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-56 rounded-3xl lg:h-44" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[7.75rem] rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    </Page>
  )
}
