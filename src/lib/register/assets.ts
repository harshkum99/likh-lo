// Self-hosted OCR runtime + model files (put in public/ by scripts/fetch-ocr-assets.mjs). They live in Cache Storage
// after the first download, so later scans need no network. Used by the OCR worker and the scan page's status line.
import manifest from './ocr-assets.json'

export const ORT_DIR = '/ort/'
export const ORT_GLUE = manifest.files.find(f => f.role === 'glue')!.path
// ORT imports its small JS glue itself; everything else is fetched here (with progress) and handed over as bytes.
const DOWNLOADS = manifest.files.filter(f => f.role !== 'glue')
export const DOWNLOAD_MB = Math.round(DOWNLOADS.reduce((s, f) => s + f.bytes, 0) / 1e6)

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null // not a secure context: fall back to the HTTP cache
  try {
    for (const k of await caches.keys()) if (k.startsWith('likh-lo-ocr') && k !== manifest.cache) void caches.delete(k)
    return await caches.open(manifest.cache)
  } catch {
    return null
  }
}

export async function isOcrCached(): Promise<boolean> {
  const cache = await openCache()
  if (!cache) return false
  return (await Promise.all(DOWNLOADS.map(f => cache.match(f.path)))).every(Boolean)
}

/** All OCR files by role (wasm, detection, recognition, dictionary); `onProgress` gets 0..1 of the total bytes. */
export async function loadOcrAssets(onProgress?: (fraction: number) => void): Promise<Record<string, ArrayBuffer>> {
  const cache = await openCache()
  const total = DOWNLOADS.reduce((s, f) => s + f.bytes, 0)
  const done = new Map<string, number>()
  const report = () => onProgress?.([...done.values()].reduce((a, b) => a + b, 0) / total)

  const entries = await Promise.all(
    DOWNLOADS.map(async f => {
      const hit = await cache?.match(f.path)
      if (hit) {
        const buf = await hit.arrayBuffer()
        if (buf.byteLength === f.bytes) {
          done.set(f.path, f.bytes)
          report()
          return [f.role, buf] as const
        }
      }
      const res = await fetch(f.path)
      if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${f.path}`)
      const out = new Uint8Array(f.bytes)
      let n = 0
      const reader = res.body.getReader()
      for (let r = await reader.read(); !r.done; r = await reader.read()) {
        if (n + r.value.length > f.bytes) throw new Error(`Unexpected file size: ${f.path}`)
        out.set(r.value, n)
        n += r.value.length
        done.set(f.path, n)
        report()
      }
      if (n !== f.bytes) throw new Error(`Incomplete download: ${f.path}`)
      // A full quota only costs a re-download next time; never fail the scan over it.
      await cache?.put(f.path, new Response(out)).catch(() => {})
      return [f.role, out.buffer] as const
    }),
  )
  return Object.fromEntries(entries)
}
