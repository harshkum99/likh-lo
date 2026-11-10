import { Page } from '@/components/app/page'
import { Skeleton } from '@/components/ui/skeleton'

export default function NewTripLoading() {
  return (
    <Page title="New trip" back="/trips" width="narrow">
      <Skeleton className="h-96 rounded-2xl" />
    </Page>
  )
}
