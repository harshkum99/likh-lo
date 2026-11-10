// Pure helpers behind the scanner's reading + review screens (no React, no engine), so they are unit-tested.
import type { Box } from './layout.ts'
import { normalizeLabel } from './match.ts'
import { parseRegister, type OcrLine, type ParsedRegister } from './parse.ts'

/** Parse with the current year; a page dated > 30 days ahead was written last year (Dec page scanned in Jan). */
export function parsePage(lines: OcrLine[], today: string): ParsedRegister {
  const year = Number(today.slice(0, 4))
  const page = parseRegister(lines, { year })
  // Both strings parse as UTC midnight, so the difference is exact whatever the device timezone.
  const ahead = page.dateFrom ? (Date.parse(page.dateFrom) - Date.parse(today)) / 86_400_000 : 0
  return ahead > 30 ? parseRegister(lines, { year: year - 1 }) : page
}

const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map(b => b.x))
  const y = Math.min(...boxes.map(b => b.y))
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x, height: Math.max(...boxes.map(b => b.y + b.height)) - y }
}

/**
 * Detected boxes -> one box per text line, grouped exactly like ppu-paddle-ocr's per-line recognition (a box joins
 * the line while its top is within half the line's average height of the previous box), so "Reading line 12 of 31"
 * counts the same crops the engine recognises.
 */
export function lineGroups(boxes: Box[]): Box[] {
  const sorted = boxes.filter(b => b.width > 0 && b.height > 0).sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: Box[][] = []
  let avg = 0
  sorted.forEach((b, i) => {
    const line = lines[lines.length - 1]
    if (line && Math.abs(b.y - sorted[i - 1].y) <= avg * 0.5) {
      line.push(b)
      avg = line.reduce((s, x) => s + x.height, 0) / line.length
    } else {
      lines.push([b])
      avg = b.height
    }
  })
  return lines.map(union)
}

/**
 * CSS to show one line of the photo as a crop: a div with the photo as background-image, at most `maxHeight` px tall
 * and never wider than its container, keeping the line's aspect. Percentages make it independent of the photo's real
 * resolution (boxes are in OCR pixels).
 */
export function cropStyle(box: Box, page: { width: number; height: number }, maxHeight = 40, pad = 4) {
  const x = Math.max(0, box.x - pad)
  const y = Math.max(0, box.y - pad)
  const w = Math.min(page.width, box.x + box.width + pad) - x
  const h = Math.min(page.height, box.y + box.height + pad) - y
  // background-position p% puts point p% of the image at p% of the box: solve for the crop's top-left.
  const pos = (start: number, size: number, total: number) => (total > size ? (start / (total - size)) * 100 : 0)
  return {
    width: `min(100%, ${Math.round((maxHeight * w) / h)}px)`,
    aspectRatio: `${w} / ${h}`,
    backgroundSize: `${(page.width / w) * 100}% ${(page.height / h) * 100}%`,
    backgroundPosition: `${pos(x, w, page.width)}% ${pos(y, h, page.height)}%`,
  }
}

/** How many rows already exist on the trip (same note + amount; each saved entry matches one row at most). */
export function countDuplicates(rows: { label: string; amount: number | null }[], existing: { notes: string | null; amount: number }[]): number {
  const pool = new Map<string, number>()
  for (const e of existing) {
    const k = `${normalizeLabel(e.notes ?? '')}|${Math.round(e.amount)}`
    pool.set(k, (pool.get(k) ?? 0) + 1)
  }
  let dupes = 0
  for (const r of rows) {
    const k = `${normalizeLabel(r.label)}|${Math.round(r.amount ?? -1)}`
    const left = pool.get(k) ?? 0
    if (left > 0) {
      pool.set(k, left - 1)
      dupes++
    }
  }
  return dupes
}
