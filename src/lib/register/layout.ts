// Turns OCR word boxes into clean reading-order lines for the parser.
// Engine-agnostic: any OCR that returns words with pixel boxes can feed this.
import type { OcrLine } from './parse.ts'

export interface Box { x: number; y: number; width: number; height: number }
export interface OcrWord { text: string; confidence: number; box: Box }

export interface LayoutLine extends OcrLine {
  /** Union box of the line's words, in page pixels (for highlighting rows on the photo). */
  box: Box
}

/**
 * Phone photos of a register often catch a sliver of the next column or the facing page. Those fragments touch the
 * image edge, so drop words that are cut by the left/right frame and sit in the outer quarter of the page.
 */
export function isEdgeFragment(b: Box, pageWidth: number): boolean {
  const edge = pageWidth * 0.015
  const touchesRight = b.x + b.width >= pageWidth - edge && b.x >= pageWidth * 0.75
  const touchesLeft = b.x <= edge && b.x + b.width <= pageWidth * 0.25
  return touchesRight || touchesLeft
}

const union = (boxes: Box[]): Box => {
  const x0 = Math.min(...boxes.map(b => b.x))
  const y0 = Math.min(...boxes.map(b => b.y))
  const x1 = Math.max(...boxes.map(b => b.x + b.width))
  const y1 = Math.max(...boxes.map(b => b.y + b.height))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

/**
 * @param groups words grouped into lines by the engine (or one group per word); regrouped by vertical position here
 * because engines sometimes glue two handwritten rows together.
 */
export function assembleLines(groups: OcrWord[][], pageWidth: number): LayoutLine[] {
  const words = groups.flat().filter(w => w.text.trim() && !isEdgeFragment(w.box, pageWidth))
  if (!words.length) return []
  const heights = words.map(w => w.box.height).sort((a, b) => a - b)
  const medianH = heights[Math.floor(heights.length / 2)]
  const cy = (w: OcrWord) => w.box.y + w.box.height / 2

  // Cluster by vertical centre: a word joins the current row when its centre is within ~half a line height.
  const sorted = [...words].sort((a, b) => cy(a) - cy(b))
  const rows: OcrWord[][] = []
  for (const w of sorted) {
    const row = rows[rows.length - 1]
    const rowCy = row ? row.reduce((s, r) => s + cy(r), 0) / row.length : -Infinity
    if (row && Math.abs(cy(w) - rowCy) <= medianH * 0.5) row.push(w)
    else rows.push([w])
  }

  return rows.map(row => {
    row.sort((a, b) => a.box.x - b.box.x)
    const chars = row.reduce((s, w) => s + w.text.length, 0)
    return {
      text: row.map(w => w.text.trim()).join(' '),
      confidence: row.reduce((s, w) => s + w.confidence * w.text.length, 0) / Math.max(1, chars),
      box: union(row.map(w => w.box)),
    }
  })
}
