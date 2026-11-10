'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { deleteTrip } from '@/app/trips/actions'
import { Button } from '@/components/ui/button'
import { confirmDialog } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'

export function TripHeaderActions({ id, entries }: { id: string; entries: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function remove() {
    const ok = await confirmDialog({
      title: 'Delete this trip?',
      description: `The trip${entries ? ` and its ${entries} ${entries === 1 ? 'entry' : 'entries'}` : ''} will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete trip',
      destructive: true,
    })
    if (!ok) return
    // Navigate inside the same transition so the refreshed (now missing) trip page never flashes a 404.
    startTransition(async () => {
      const res = await deleteTrip(id)
      if (!res.success) return void toast.error(res.error)
      toast.success('Trip deleted')
      router.push('/trips')
    })
  }

  return (
    <>
      <Button
        render={<Link href={`/trips/${id}/edit`} />}
        nativeButton={false}
        variant="outline"
        className="h-9 rounded-xl px-3"
        aria-label="Edit trip"
      >
        <Pencil />
        <span className="hidden sm:inline">Edit</span>
      </Button>
      <Button
        variant="ghost"
        onClick={remove}
        disabled={pending}
        aria-label="Delete trip"
        className="size-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      </Button>
    </>
  )
}
