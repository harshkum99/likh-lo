// Page-side handle on the OCR worker. onnxruntime + PaddleOCR load only inside the worker, never in a page bundle.
import type { Box, OcrWord } from './layout.ts'

export type OcrStage = 'image' | 'model' | 'read'
export type OcrEvent =
  /** Photo decoded; boxes below are in this pixel space. */
  | { type: 'image'; width: number; height: number }
  /** Model download, 0..1 (instant when cached). */
  | { type: 'model'; progress: number }
  | { type: 'ready'; threads: number; loadMs: number }
  /** Text lines found by the detector (one box per line the recogniser will read). */
  | { type: 'lines'; lines: Box[] }
  /** Lines recognised so far. */
  | { type: 'read'; done: number }
  | { type: 'done'; words: OcrWord[]; readMs: number }
  | { type: 'error'; stage: OcrStage; message: string }

/** Reads a register photo in a Web Worker. Returns cancel(), which kills the worker and frees its memory. */
export function readPhoto(file: Blob, onEvent: (e: OcrEvent) => void): () => void {
  const worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' })
  let live = true
  const stop = () => {
    live = false
    worker.terminate()
  }
  // Messages already queued when cancel() ran must not reach a page that moved on (or started another read).
  worker.onmessage = ({ data }: MessageEvent<OcrEvent>) => {
    if (!live) return
    if (data.type === 'done' || data.type === 'error') stop()
    onEvent(data)
  }
  worker.onerror = e => {
    if (!live) return
    stop()
    onEvent({ type: 'error', stage: 'model', message: e.message || 'The AI reader stopped unexpectedly' })
  }
  worker.postMessage(file)
  return stop
}
