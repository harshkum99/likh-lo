'use client'

import { useSyncExternalStore } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}
interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

/** Promise-based replacement for window.confirm(). Requires <ConfirmHost /> in the layout. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false)
  return new Promise(resolve => {
    pending = { ...opts, resolve }
    emit()
  })
}

function settle(ok: boolean) {
  pending?.resolve(ok)
  pending = null
  emit()
}

export function ConfirmHost() {
  const p = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => pending,
    () => null,
  )
  return (
    <Dialog open={!!p} onOpenChange={open => { if (!open) settle(false) }}>
      <DialogContent showCloseButton={false} className="gap-5 rounded-3xl p-6 sm:max-w-sm">
        <div className="flex gap-4">
          {p?.destructive && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
          )}
          <div className="space-y-1.5">
            <DialogTitle className="text-base font-semibold">{p?.title}</DialogTitle>
            {p?.description && <DialogDescription>{p.description}</DialogDescription>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => settle(false)}>Cancel</Button>
          <Button
            className={p?.destructive ? 'h-11 rounded-xl bg-destructive text-white hover:bg-destructive/90' : 'h-11 rounded-xl'}
            onClick={() => settle(true)}
            autoFocus
          >
            {p?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
