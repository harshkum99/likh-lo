'use client'

import { useSyncExternalStore } from 'react'
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'error' | 'info'
interface ToastItem { id: number; title: string; description?: string; tone: Tone }

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const EMPTY: ToastItem[] = []

function dismiss(id: number) {
  items = items.filter(t => t.id !== id)
  emit()
}

function push(tone: Tone, title: string, description?: string) {
  const id = nextId++
  items = [...items.slice(-2), { id, title, description, tone }]
  emit()
  setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500)
}

/** Fire-and-forget notifications. Replaces window.alert(). */
export const toast = {
  success: (title: string, description?: string) => push('success', title, description),
  error: (title: string, description?: string) => push('error', title, description),
  info: (title: string, description?: string) => push('info', title, description),
}

const ICON = { success: CheckCircle2, error: XCircle, info: Info }
const ICON_CLASS = { success: 'text-positive', error: 'text-destructive', info: 'text-primary' }

export function Toaster() {
  const list = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => items,
    () => EMPTY,
  )
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end"
    >
      {list.map(t => {
        const Icon = ICON[t.tone]
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-popover/95 p-3.5 text-popover-foreground shadow-lg shadow-black/5 backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_CLASS[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
