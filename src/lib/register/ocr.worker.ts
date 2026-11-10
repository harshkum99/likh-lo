// OCR worker: decode + grayscale the photo, load PaddleOCR (WASM, multi-threaded when the page is cross-origin isolated),
// detect text lines, recognise them, and stream progress back. Started by readPhoto() in ./ocr.ts.
import { loadOcrAssets, ORT_DIR, ORT_GLUE } from './assets.ts'
import type { Box } from './layout.ts'
import type { OcrEvent, OcrStage } from './ocr.ts'
import { lineGroups } from './review.ts'

/** Long side for OCR: enough for handwriting, small enough for phone memory (the bake-off ran at 1600). */
const MAX_SIDE = 1600

const post = (e: OcrEvent) => self.postMessage(e)

async function grayCanvas(file: Blob) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const p = img.data
  // Half darkest channel + half luma darkens red/blue ink against the paper (measured best on registers).
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2]
    p[i] = p[i + 1] = p[i + 2] = Math.min(r, g, b) * 0.5 + (0.299 * r + 0.587 * g + 0.114 * b) * 0.5
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

/**
 * WASM threads are module workers of onnxruntime's glue script, started from this worker. Where the browser refuses
 * nested workers (seen in an embedded Chromium) onnxruntime waits for its threads forever, so start one the same way
 * first and fall back to a single thread if the browser rejects it.
 */
async function canStartThreads(): Promise<boolean> {
  if (!self.crossOriginIsolated) return false // no SharedArrayBuffer: onnxruntime is single-threaded anyway
  let w: Worker
  try {
    w = new Worker(ORT_GLUE, { type: 'module', name: 'thread-check' })
  } catch {
    return false // no nested workers here: one thread still reads the page
  }
  // shortcut: a refusal fires `error` almost at once; silence for 600 ms counts as success (runs beside the model load).
  const ok = await new Promise<boolean>(resolve => {
    w.onerror = () => resolve(false)
    setTimeout(() => resolve(true), 600)
  })
  w.terminate()
  return ok
}

async function createEngine() {
  let percent = -1 // post whole percents only, not every network chunk
  const [files, threads] = await Promise.all([
    loadOcrAssets(p => {
      if (Math.floor(p * 100) === percent) return
      percent = Math.floor(p * 100)
      post({ type: 'model', progress: percent / 100 })
    }),
    canStartThreads(),
  ])
  const ort = await import('onnxruntime-web')
  // Self-hosted runtime (the library would point at a CDN); the wasm bytes come from our cache.
  ort.env.wasm.wasmPaths = ORT_DIR
  ort.env.wasm.wasmBinary = files.wasm
  if (!threads) ort.env.wasm.numThreads = 1
  const { PaddleOcrService } = await import('ppu-paddle-ocr/web')

  // Detection and recognition run as two steps (instead of recognize()) so the page can show real progress.
  class RegisterOcr extends PaddleOcrService {
    async read(canvas: OffscreenCanvas) {
      const boxes = await this.detector!.run(canvas)
      post({ type: 'lines', lines: lineGroups(boxes) })
      if (!boxes.length) return []
      // Count recognised lines: each inference reads a batch of line crops (batch = first tensor dimension).
      // One read per worker, so the wrapper is never stacked.
      const session = this.recognitionSession!
      const run = session.run.bind(session) as (feeds: Record<string, { dims: readonly number[] }>) => Promise<unknown>
      let done = 0
      ;(session as unknown as { run: typeof run }).run = async feeds => {
        const out = await run(feeds)
        done += Object.values(feeds)[0]?.dims[0] ?? 1
        post({ type: 'read', done })
        return out
      }
      const words = await this.recognitor!.run(canvas, boxes, undefined, 'per-line')
      // The library logs and swallows recognition errors; boxes but no text means it failed.
      if (!words.length) throw new Error('Text recognition failed')
      return words
    }
  }

  const ocr = new RegisterOcr({
    model: { detection: files.detection, recognition: files.recognition, charactersDictionary: files.dictionary },
    detection: { maxSideLength: 'auto' },
    recognition: { strategy: 'per-line', minimumConfidence: 0.5, charactersDictionary: [] },
    // WASM on purpose: these .ort models are pre-optimised for CPU (NHWC kernels), and the WebGPU provider rejects them
    // ("Failed to find op_id: com.ms.internal.nhwc:Conv"), so asking for WebGPU only costs a failed GPU start-up.
    session: { executionProviders: ['wasm'], graphOptimizationLevel: 'all' },
  })
  await ocr.initialize()
  ort.env.wasm.wasmBinary = undefined // compiled already; let the 15 MB go
  return { ocr, threads: ort.env.wasm.numThreads ?? 1 }
}

self.onmessage = async ({ data: file }: MessageEvent<Blob>) => {
  let stage: OcrStage = 'image'
  try {
    const canvas = await grayCanvas(file)
    post({ type: 'image', width: canvas.width, height: canvas.height })

    stage = 'model'
    const t0 = performance.now()
    const { ocr, threads } = await createEngine()
    post({ type: 'ready', threads, loadMs: Math.round(performance.now() - t0) })

    stage = 'read'
    const t1 = performance.now()
    const words = await ocr.read(canvas)
    post({ type: 'done', words: words.map(w => ({ text: w.text, confidence: w.confidence, box: w.box as Box })), readMs: Math.round(performance.now() - t1) })
  } catch (e) {
    post({ type: 'error', stage, message: e instanceof Error ? e.message : String(e) })
  }
}
