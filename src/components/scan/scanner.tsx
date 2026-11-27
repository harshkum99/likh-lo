'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Circle, CloudDownload, ImageUp, Loader2, PenLine, RotateCcw, ScanLine, ScanText, Sun, X } from 'lucide-react'
import { Panel } from '@/components/app/page'
import { NEW_TRIP } from '@/components/app/trip-picker'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { todayISO } from '@/lib/format'
import { DOWNLOAD_MB, isOcrCached, loadOcrAssets } from '@/lib/register/assets'
import { assembleLines, type Box, type LayoutLine } from '@/lib/register/layout'
import { readPhoto, type OcrStage } from '@/lib/register/ocr'
import type { ParsedRegister } from '@/lib/register/parse'
import { parsePage } from '@/lib/register/review'
import type { Category, Trip } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PhotoWithBoxes, type Size } from './photo'
import { Review, type HistoryEntry } from './review'
import { EMPTY_DRAFT, TripFields, type TripDraft } from './trip-fields'

type Phase =
  /** `again`: back from a scan, so focus returns to "Take photo". */
  | { step: 'capture'; again?: boolean }
  | { step: 'reading'; size: Size | null; model: number; ready: boolean; lines: Box[] | null; read: number }
  | { step: 'failed'; stage: OcrStage; message: string; size: Size | null }
  | { step: 'review'; id: number; size: Size | null; lines: LayoutLine[]; parsed: ParsedRegister; manual: boolean }

const NO_TEXT = 'No writing found'
const EMPTY_PAGE: ParsedRegister = {
  dateFrom: null,
  dateTo: null,
  items: [],
  writtenTotal: null,
  driver: { spent: null, advance: null, advanceExpr: '', balance: null },
  unparsed: [],
}

/** Register scanner: capture -> reading (on-device OCR in a worker) -> review -> save. */
export function Scanner({
  trips,
  categories,
  history,
  wantedTripId,
}: {
  trips: Trip[]
  categories: Category[]
  history: HistoryEntry[]
  wantedTripId?: string
}) {
  const [tripId, setTripId] = useState(
    () => trips.find(t => t.id === wantedTripId)?.id ?? trips.find(t => t.status === 'running')?.id ?? NEW_TRIP,
  )
  const [draft, setDraft] = useState<TripDraft>(EMPTY_DRAFT)
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [phase, setPhase] = useState<Phase>({ step: 'capture' })
  const cancel = useRef<(() => void) | null>(null)
  const scans = useRef(0)

  // Stop the reader when leaving the page; free each photo once it is replaced or the page closes.
  useEffect(() => () => cancel.current?.(), [])
  useEffect(() => (photo ? () => URL.revokeObjectURL(photo.url) : undefined), [photo])

  function read(file: File) {
    cancel.current?.()
    let size: Size | null = null
    setPhase({ step: 'reading', size: null, model: 0, ready: false, lines: null, read: 0 })
    cancel.current = readPhoto(file, e => {
      if (e.type === 'error' || e.type === 'done') cancel.current = null
      if (e.type === 'error') return setPhase({ step: 'failed', stage: e.stage, message: e.message, size })
      if (e.type === 'done') {
        if (!e.words.length || !size) return setPhase({ step: 'failed', stage: 'read', message: NO_TEXT, size })
        const lines = assembleLines([e.words], size.width)
        const parsed = parsePage(lines, todayISO())
        setDraft(d => ({ ...d, start: d.start || parsed.dateFrom || '', end: d.end || parsed.dateTo || '' }))
        return setPhase({ step: 'review', id: ++scans.current, size, lines, parsed, manual: false })
      }
      if (e.type === 'image') size = { width: e.width, height: e.height }
      setPhase(p =>
        p.step !== 'reading'
          ? p
          : e.type === 'image'
            ? { ...p, size }
            : e.type === 'model'
              ? { ...p, model: e.progress }
              : e.type === 'ready'
                ? { ...p, ready: true }
                : e.type === 'lines'
                  ? { ...p, lines: e.lines }
                  : { ...p, read: e.done },
      )
    })
  }

  function pick(file: File | undefined) {
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) return toast.error('That file isn’t a photo', 'Pick a JPG or PNG of the register page.')
    setPhoto({ file, url: URL.createObjectURL(file) })
    read(file)
  }

  function startOver() {
    cancel.current?.()
    cancel.current = null
    setPhoto(null)
    // A new page brings its own date range; keep the typed vehicle/load.
    setDraft(d => ({ ...d, start: '', end: '' }))
    setPhase({ step: 'capture', again: true })
  }

  function enterManually(size: Size | null) {
    const id = ++scans.current
    setPhase({ step: 'review', id, size, lines: [], parsed: EMPTY_PAGE, manual: true })
  }

  if (phase.step === 'review' && photo)
    return (
      <Review
        key={phase.id}
        url={photo.url}
        size={phase.size}
        lines={phase.lines}
        parsed={phase.parsed}
        manual={phase.manual}
        categories={categories}
        history={history}
        trips={trips}
        tripId={tripId}
        onTripChange={setTripId}
        draft={draft}
        onDraftChange={setDraft}
        onRestart={startOver}
      />
    )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {phase.step === 'reading' && photo ? (
        <Reading url={photo.url} phase={phase} onCancel={startOver} />
      ) : phase.step === 'failed' && photo ? (
        <Failed
          url={photo.url}
          stage={phase.stage}
          message={phase.message}
          onRetry={() => read(photo.file)}
          onManual={() => enterManually(phase.size)}
          onOtherPhoto={startOver}
        />
      ) : (
        <>
          <TripFields trips={trips} tripId={tripId} onTripChange={setTripId} draft={draft} onDraftChange={setDraft} />
          <Capture onPick={pick} autoFocus={phase.step === 'capture' && phase.again} />
          <Tips />
          <ModelStatus />
        </>
      )}
    </div>
  )
}

function Capture({ onPick, autoFocus }: { onPick: (file: File | undefined) => void; autoFocus?: boolean }) {
  const camera = useRef<HTMLInputElement>(null)
  const upload = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Desktop: paste a photo or screenshot straight in.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'))
      if (file) onPick(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [onPick])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPick(e.target.files?.[0])
    e.target.value = '' // picking the same photo again still fires
  }

  return (
    <Panel
      onDragOver={e => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={e => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        onPick(e.dataTransfer.files[0])
      }}
      className={cn('flex flex-col items-center gap-5 px-5 py-8 text-center transition-colors sm:py-10', dragging && 'border-primary bg-primary/5')}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-hero text-white shadow-lg shadow-primary/25">
        <ScanText className="size-8" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Photograph the register page</h2>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">Every entry is filled in for you to check: amounts, categories and who paid.</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Button autoFocus={autoFocus} onClick={() => camera.current?.click()} className="h-12 rounded-xl text-base active:scale-[0.98]">
          <Camera className="size-5" /> Take photo
        </Button>
        <Button variant="outline" onClick={() => upload.current?.click()} className="h-11 rounded-xl">
          <ImageUp /> Upload image
        </Button>
      </div>
      <p className="hidden text-xs text-muted-foreground lg:block">or drop an image here, or paste one with Ctrl+V</p>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={upload} type="file" accept="image/*" hidden onChange={onFile} />
    </Panel>
  )
}

const TIPS = [
  { icon: ScanLine, title: 'Flat page', hint: 'Press the register open' },
  { icon: Sun, title: 'Good light', hint: 'No shadow on the writing' },
  { icon: ScanText, title: 'Whole page', hint: 'Every row and the total' },
]

function Tips() {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {TIPS.map(t => (
        <li key={t.title} className="space-y-1.5 rounded-2xl bg-muted/60 p-3">
          <t.icon className="size-4 text-primary" />
          <p className="text-xs font-medium">{t.title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{t.hint}</p>
        </li>
      ))}
    </ul>
  )
}

/** "AI model ready" or the one-time download note, with a way to fetch it ahead of the first scan. */
function ModelStatus() {
  const [cached, setCached] = useState<boolean | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  useEffect(() => {
    void isOcrCached().then(setCached)
  }, [])

  async function download() {
    setPercent(0)
    try {
      await loadOcrAssets(p => setPercent(Math.floor(p * 100)))
      setCached(true)
    } catch {
      toast.error('Download failed', 'Check your internet and try again.')
    }
    setPercent(null)
  }

  if (cached === null) return null
  return (
    <p aria-live="polite" className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-2 text-center text-xs text-muted-foreground">
      {cached ? (
        <>
          <CheckCircle2 className="size-3.5 text-positive" /> AI model ready · works offline
        </>
      ) : percent !== null ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Downloading the AI model…{' '}
          <span aria-hidden className="tabular-nums">
            {percent}%
          </span>
        </>
      ) : (
        <>
          <CloudDownload className="size-3.5" /> First scan downloads the AI model (~{DOWNLOAD_MB} MB), then it works offline.
          <button type="button" onClick={download} className="font-medium text-primary hover:underline">
            Download now
          </button>
        </>
      )}
    </p>
  )
}

function Reading({ url, phase, onCancel }: { url: string; phase: Extract<Phase, { step: 'reading' }>; onCancel: () => void }) {
  const { size, model, ready, lines, read } = phase
  const total = lines?.length ?? 0
  const heading = useFocusOnMount()
  // Announced once per step; the per-line counter would flood a screen reader.
  const status = !ready ? 'Loading the AI model' : !lines ? 'Finding lines on the page' : `${total} lines found. Reading the handwriting`
  const steps: { label: string; detail?: string; state: 'done' | 'active' | 'todo'; progress?: number }[] = [
    ready
      ? { label: 'AI model ready', state: 'done' }
      : model < 1
        ? { label: 'Loading AI model', detail: `First time only · ${Math.round(model * 100)}%`, state: 'active', progress: model }
        : { label: 'Loading AI model', detail: 'Starting up…', state: 'active' },
    lines ? { label: 'Finding lines', detail: `${total} found`, state: 'done' } : { label: 'Finding lines', state: ready ? 'active' : 'todo' },
    lines
      ? { label: `Reading line ${Math.min(read + 1, total)} of ${total}`, state: 'active', progress: total ? read / total : 0 }
      : { label: 'Reading the handwriting', state: 'todo' },
  ]

  return (
    <Panel className="grid gap-5 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:p-5">
      <PhotoWithBoxes
        url={url}
        size={size}
        boxes={lines ?? []}
        appear
        className="mx-auto w-full"
        // Leave room for the steps below on a phone.
        style={{ maxWidth: `calc((100dvh - 20rem) * ${size ? size.width / size.height : 0.75})` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-in duration-[2400ms] ease-in-out repeat-infinite direction-alternate slide-in-from-top motion-reduce:hidden"
        >
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary shadow-[0_0_12px_2px] shadow-primary/60" />
        </div>
      </PhotoWithBoxes>

      <div className="space-y-5">
        <div className="space-y-1">
          <h2 ref={heading} tabIndex={-1} className="text-base font-semibold tracking-tight outline-none">
            Reading your register…
          </h2>
          <p className="text-sm text-muted-foreground">Right here on this device, nothing is uploaded. Usually a few seconds.</p>
        </div>
        <p role="status" className="sr-only">
          {status}
        </p>
        <ol className="space-y-4">
          {steps.map(s => (
            <li key={s.label.slice(0, 8)} className="flex gap-3">
              {s.state === 'done' ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
              ) : s.state === 'active' ? (
                <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-primary" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/40" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className={cn('text-sm font-medium tabular-nums', s.state === 'todo' && 'text-muted-foreground')}>{s.label}</p>
                {s.detail && <p className="text-xs text-muted-foreground tabular-nums">{s.detail}</p>}
                {s.progress !== undefined && (
                  <div role="progressbar" aria-label={s.label} aria-valuenow={Math.round(s.progress * 100)} className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${s.progress * 100}%` }} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        <Button variant="outline" onClick={onCancel} className="h-11 w-full rounded-xl">
          <X /> Cancel
        </Button>
      </div>
    </Panel>
  )
}

function Failed({
  url,
  stage,
  message,
  onRetry,
  onManual,
  onOtherPhoto,
}: {
  url: string
  stage: OcrStage
  message: string
  onRetry: () => void
  onManual: () => void
  onOtherPhoto: () => void
}) {
  const copy =
    stage === 'image'
      ? { title: 'This photo couldn’t be opened', hint: 'Try another photo. A JPG or PNG from the camera works best.' }
      : /memory|alloc/i.test(message)
        ? { title: 'This phone ran out of memory', hint: 'Close other apps and try again, or type the rows yourself.' }
        : stage === 'model'
          ? {
              title: 'The AI model couldn’t load',
              hint: `Check your internet and try again. The first scan downloads the model (~${DOWNLOAD_MB} MB); after that it works offline.`,
            }
          : message === NO_TEXT
            ? { title: 'No writing found', hint: 'Make sure the whole page is in the photo and well lit, or type the rows yourself.' }
            : { title: 'The page couldn’t be read', hint: 'Try a sharper photo in good light, or type the rows while looking at the photo.' }
  const heading = useFocusOnMount()

  return (
    <Panel className="grid animate-in gap-5 p-4 fade-in-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-center sm:p-5">
      {stage !== 'image' && <PhotoWithBoxes url={url} size={null} className="mx-auto w-full max-w-40 sm:max-w-none" />}
      <div className="space-y-4">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <AlertTriangle className="size-5" />
          </span>
          <div className="space-y-1">
            <h2 ref={heading} tabIndex={-1} className="font-semibold tracking-tight outline-none">
              {copy.title}
            </h2>
            <p className="text-sm text-muted-foreground">{copy.hint}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <Button onClick={stage === 'image' ? onOtherPhoto : onRetry} className="h-11 rounded-xl">
            <RotateCcw /> {stage === 'image' ? 'Choose another photo' : 'Try again'}
          </Button>
          <Button variant="outline" onClick={onManual} className="h-11 rounded-xl">
            <PenLine /> Enter rows manually
          </Button>
          {stage !== 'image' && (
            <Button variant="ghost" onClick={onOtherPhoto} className="h-11 rounded-xl text-muted-foreground">
              Use a different photo
            </Button>
          )}
        </div>
        {message !== NO_TEXT && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer py-1">Technical details</summary>
            <p className="break-words">{message}</p>
          </details>
        )}
      </div>
    </Panel>
  )
}

/** Moves keyboard / screen-reader focus to a new screen's heading (without scrolling) when the scan changes state. */
function useFocusOnMount<T extends HTMLElement = HTMLHeadingElement>() {
  const ref = useRef<T>(null)
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])
  return ref
}
