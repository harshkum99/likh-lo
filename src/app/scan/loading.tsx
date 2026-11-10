import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function ScanLoading() {
  return (
    <Page title="Scan register" subtitle="AI reads your handwriting on this device — nothing is uploaded">
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-[104px] rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    </Page>
  )
}
