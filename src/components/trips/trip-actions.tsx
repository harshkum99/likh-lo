'use client'

import { Button } from '@/components/ui/button'
import { deleteTrip } from '@/app/trips/actions'
import { Trash2, Edit } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export function TripActions({ tripId }: { tripId: string }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this trip and all its expenses?')) {
      setIsDeleting(true)
      await deleteTrip(tripId)
      setIsDeleting(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 pt-4">
      <Link href={`/trips/${tripId}/edit`}>
        <Button variant="outline" className="w-full h-14 rounded-2xl font-bold gap-2">
          <Edit className="h-4 w-4" />
          Edit Trip
        </Button>
      </Link>
      <Button 
        variant="destructive" 
        className="w-full h-14 rounded-2xl font-bold gap-2"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        <Trash2 className="h-4 w-4" />
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  )
}
