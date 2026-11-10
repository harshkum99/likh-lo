'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-negative/10 text-negative">
        <TriangleAlert className="size-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight">Couldn’t load this page</h1>
        <p className="text-sm text-muted-foreground">
          Check your internet connection and try again. Your saved data is safe.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button className="h-11 rounded-xl px-5" onClick={() => unstable_retry()}>
          <RefreshCw /> Try again
        </Button>
        <Button variant="outline" className="h-11 rounded-xl px-5" render={<Link href="/dashboard" />} nativeButton={false}>
          Go to overview
        </Button>
      </div>
    </div>
  )
}
