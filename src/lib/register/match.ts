// Maps a handwritten register label ("Balu Dalal", "Khorakhi", "5/8 Police") to an expense category.
// Order: learned from the user's own past saves -> Hinglish alias dictionary -> fuzzy match -> suggest a new category.
import type { Category } from '../types.ts'

export interface CategoryMatch {
  categoryId: string | null
  /** Set when no existing category fits: the name to create on save. */
  newName: string | null
  score: number
  via: 'learned' | 'alias' | 'fuzzy' | 'new'
}

/** Canonical category name -> words seen in registers (Hinglish + common OCR slips). */
export const ALIASES: Record<string, string[]> = {
  Diesel: ['diesel', 'disel', 'deisel', 'desel', 'dsl', 'diesal', 'hsd', 'tel', 'oil', 'pump'],
  Toll: ['toll', 'tol', 'tolll', 'tax', 'fastag', 'naka'],
  Dalal: ['dalal', 'dalali', 'dalaal', 'dlal', 'broker', 'dalel'],
  'Loading Dalal': ['loading dalal'],
  'Dalal Commission': ['dalal commission', 'dalal comision'],
  'Driver Commission': ['commission', 'commision', 'comision', 'comission', 'kamishan', 'kamisan', 'driver commission', 'bhatta'],
  'Driver Food': ['khoraki', 'khorakhi', 'khoraaki', 'khuraki', 'khurak', 'khana', 'food', 'bhojan', 'nasta', 'chai'],
  Labour: ['labour', 'labor', 'lebar', 'labar', 'leber', 'majdoor', 'mazdoor', 'hamali', 'palledar'],
  'Labour Milai': ['milai', 'labour milai'],
  Loader: ['loading', 'loder', 'loader', 'lodig', 'loding', 'unloading', 'unload'],
  Chanda: ['chanda', 'chnda', 'chandaa', 'donation'],
  Santhali: ['santhali', 'santali'],
  Material: ['balu', 'baalu', 'sand', 'material', 'gitti', 'chips', 'stone', 'maal'],
  Parking: ['parking', 'parkin', 'parkng'],
  Border: ['border', 'rto', 'checkpost', 'check post', 'barrier'],
  JCB: ['jcb'],
  Tyre: ['tyre', 'tire', 'tayar', 'tyer', 'tayre', 'puncture', 'panchar', 'tube'],
  'Vehicle Fault': ['welding', 'repair', 'mistri', 'mechanic', 'fault', 'servicing', 'service', 'grease', 'hawa', 'battery', 'clutch', 'parts'],
  // Not seeded as defaults; created on first save if the user keeps the suggestion.
  Police: ['police', 'pulis', 'polis', 'palice', 'thana', 'challan', 'chalan'],
  Kata: ['kata', 'kanta', 'kaanta', 'weighbridge', 'dharam kanta', 'weight'],
  Urea: ['urea', 'uria', 'def', 'adblue'],
  GPS: ['gps', 'g p s'],
  Misc: ['misc', 'miscellaneous', 'other', 'extra', 'mix'],
}

/** Words that name the load, written before the real head ("Balu Dalal", "5/8 Kata"); dropped before matching. */
const LOAD_PREFIX = /^(?:\d+\s*\/\s*\d+|balu|baalu|sand|gitti|chips|stone|coal|koyla|cement|rice|chawal)\s+(?=\S)/i

export const normalizeLabel = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Jaro-Winkler: rewards a shared prefix, which suits OCR slips at the end of a word ("Dieod" ~ "Diesel"). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aHit = new Array<boolean>(a.length).fill(false)
  const bHit = new Array<boolean>(b.length).fill(false)
  let m = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - window); j <= Math.min(b.length - 1, i + window); j++) {
      if (bHit[j] || a[i] !== b[j]) continue
      aHit[i] = bHit[j] = true
      m++
      break
    }
  }
  if (!m) return 0
  let t = 0
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aHit[i]) continue
    while (!bHit[j]) j++
    if (a[i] !== b[j]) t++
    j++
  }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3
  let prefix = 0
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++
  return jaro + prefix * 0.1 * (1 - jaro)
}

const titleCase = (s: string) => s.replace(/\b[a-z]/g, c => c.toUpperCase())

/**
 * Build a matcher for this user's categories.
 * `history` = past expenses' (notes, category_id): register scans save the raw label as the note, so the user's own
 * corrections are learned automatically.
 */
export function buildMatcher(categories: Category[], history: { notes: string | null; category_id: string | null }[] = []) {
  const active = categories.filter(c => c.is_active)
  const byName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]))

  const learnedVotes = new Map<string, Map<string, number>>()
  for (const h of history) {
    if (!h.notes || !h.category_id) continue
    const key = normalizeLabel(h.notes)
    if (!key) continue
    const votes = learnedVotes.get(key) ?? new Map<string, number>()
    votes.set(h.category_id, (votes.get(h.category_id) ?? 0) + 1)
    learnedVotes.set(key, votes)
  }
  const validIds = new Set(categories.map(c => c.id))

  // alias word -> canonical name; longer (multi-word) aliases are tried first
  const aliasList = Object.entries(ALIASES)
    .flatMap(([canon, words]) => words.map(w => ({ w, canon })))
    .sort((a, b) => b.w.length - a.w.length)

  const resolveCanon = (canon: string, score: number, via: CategoryMatch['via']): CategoryMatch => {
    const cat = byName.get(canon.toLowerCase())
    return cat ? { categoryId: cat.id, newName: null, score, via } : { categoryId: null, newName: canon, score, via }
  }

  return function match(label: string): CategoryMatch {
    const full = normalizeLabel(label)
    if (!full) return { categoryId: null, newName: null, score: 0, via: 'new' }

    const learned = learnedVotes.get(full)
    if (learned) {
      const [id] = [...learned.entries()].filter(([cid]) => validIds.has(cid)).sort((a, b) => b[1] - a[1])[0] ?? []
      if (id) return { categoryId: id, newName: null, score: 1, via: 'learned' }
    }

    const exact = byName.get(full)
    if (exact) return { categoryId: exact.id, newName: null, score: 1, via: 'alias' }

    // Try without the load prefix first ("Balu Kata" -> "kata", not Material), then the full label.
    const stripped = full.replace(LOAD_PREFIX, '')
    for (const candidate of stripped !== full ? [stripped, full] : [full]) {
      const words = candidate.split(' ')
      for (const { w, canon } of aliasList) {
        const hit = w.includes(' ') ? candidate.includes(w) : words.includes(w)
        if (hit) return resolveCanon(canon, 0.95, 'alias')
      }
    }

    // Fuzzy: compare each word (and the whole label) with category names and aliases.
    let best: { canon: string | null; cat: Category | null; score: number } = { canon: null, cat: null, score: 0 }
    const probes = [stripped, ...stripped.split(' ').filter(w => w.length >= 3)]
    for (const p of probes) {
      for (const c of active) {
        const s = similarity(p, c.name.toLowerCase())
        if (s > best.score) best = { canon: null, cat: c, score: s }
      }
      for (const { w, canon } of aliasList) {
        if (Math.abs(w.length - p.length) > 3) continue
        const s = similarity(p, w)
        if (s > best.score) best = { canon, cat: null, score: s }
      }
    }
    if (best.score >= 0.78) {
      if (best.cat) return { categoryId: best.cat.id, newName: null, score: best.score, via: 'fuzzy' }
      if (best.canon) return resolveCanon(best.canon, best.score, 'fuzzy')
    }
    return { categoryId: null, newName: titleCase(stripped).slice(0, 40), score: 0.3, via: 'new' }
  }
}
