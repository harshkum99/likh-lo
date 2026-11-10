// Turns OCR'd register lines into structured rows. Pure + engine-agnostic: input is text lines in reading order.
//
// A register page looks like:
//   5 NOV -> 10 NOV                    header: trip date range
//   Balu -> 16600                      item: label, arrow, amount
//   Diesel -> 30932 + 16800            amount can be an expression
//   Khorakhi -> 500 x 6 => 3000 ✓      "=>" introduces the written result; ✓ = paid by driver
//   143472                             written total (numeric-only line ≈ sum of items)
//   Driver Kharcha / 72170             footer: driver spent, cash given (Jama), balance (Nikla)

export interface OcrLine {
  text: string
  /** 0..1 engine confidence, if the engine reports one. */
  confidence?: number
}

export interface ParsedItem {
  /** Stable index into the input lines (for highlighting / debugging). */
  line: number
  raw: string
  label: string
  /** Normalised arithmetic as written, e.g. "30932 + 16800". Empty when no amount was read. */
  expr: string
  amount: number | null
  ticked: boolean
  /** 0..1: engine confidence lowered by parse doubts (missing amount, result mismatch, odd label). */
  confidence: number
  warnings: string[]
}

export interface ParsedRegister {
  dateFrom: string | null
  dateTo: string | null
  items: ParsedItem[]
  writtenTotal: number | null
  driver: { spent: number | null; advance: number | null; advanceExpr: string; balance: number | null }
  /** Lines we could not place, shown to the user so nothing is silently dropped. */
  unparsed: { line: number; text: string }[]
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** "NOV", "N0V", "Nou", "November" -> 10 (0-based); null if unrecognised. */
function monthIndex(word: string): number | null {
  const w = word.toLowerCase().replace(/0/g, 'o').replace(/[^a-z]/g, '').slice(0, 3)
  if (w.length < 3) return null
  const exact = MONTHS.indexOf(w)
  if (exact >= 0) return exact
  // one-letter OCR slip (e.g. "nou", "ocl"): accept if exactly one month differs by one char
  const near = MONTHS.filter(m => [...m].filter((c, i) => c !== w[i]).length === 1)
  return near.length === 1 ? MONTHS.indexOf(near[0]) : null
}

// An impossible day ("31 Nov", "29 Feb" in 2026, usually a misread) becomes the month's last day: a date input shows
// the invalid one as blank and the database rejects it on save.
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate())).padStart(2, '0')}`

function parseHeaderDates(text: string, year: number): { from: string; to: string | null } | null {
  const re = /(\d{1,2})\s*(?:st|nd|rd|th)?\s*([a-z0-9]{3,9})/gi
  const found: { d: number; m: number }[] = []
  for (const m of text.matchAll(re)) {
    const day = Number(m[1])
    const mon = monthIndex(m[2])
    if (mon !== null && day >= 1 && day <= 31) found.push({ d: day, m: mon })
  }
  if (!found.length) return null
  const from = found[0]
  const to = found[1]
  // A range crossing new year ("28 Dec -> 3 Jan") puts the end in the next year.
  return { from: iso(year, from.m, from.d), to: to ? iso(to.m < from.m ? year + 1 : year, to.m, to.d) : null }
}

// Letters OCR engines produce for handwritten digits. Only applied to runs that already contain 2+ real digits.
const DIGIT_LOOKALIKE: Record<string, string> = { o: '0', O: '0', D: '0', s: '5', S: '5', G: '6', b: '6', l: '1', I: '1', '|': '1', Z: '2', B: '8', g: '9', q: '9' }

/** Fix digit look-alikes inside numeric runs ("35oo" -> 3500, "s000" -> 5000) and Indian digit grouping. */
function fixDigits(s: string): string {
  return s
    .replace(/[\doODsSGblI|ZBgq]{2,}/g, run => ((run.match(/\d/g)?.length ?? 0) >= 2 ? run.replace(/[^\d]/g, c => DIGIT_LOOKALIKE[c] ?? c) : run))
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1') // 1,43,472 -> 143472
}

/** Undo systematic OCR slips on handwritten registers before splitting a line. */
export function normalizeOcrLine(raw: string): string {
  const s = raw
    .trim()
    .replace(/[\s。.,·•—–_~-]+$/u, '') // trailing ticks/dashes/dots the engine turns into punctuation
    .replace(/^5\s*[1lI|/]\s*8(?=\s*\d*[A-Za-z])/, '5/8 ') // "518 Dalal", "518Ualal": the slash in 5/8 read as 1
    .replace(/=\s*7(?=\s+\d)/g, '=>') // "=>" read as "=7"
    .replace(/(\d[\doO]*)[vV](?=\s|$)/g, '$1 ✓') // "200v": tick glued to the amount
    .replace(/(?<=\d)\s*[xX×*]\s*([oODsSGbIlZBgq])(?=\s*(?:=|$|\s))/g, (_, c: string) => ` x ${DIGIT_LOOKALIKE[c]}`) // "500XG" -> 500 x 6
    .replace(/(?<=\d)\s*[X×*]\s*(?=\d)/g, ' x ')
  return fixDigits(s)
}

const TICK_RE = /(?:\s*[✓✔√☑]|\s+[vVrL~^/]{1,2})\s*$/
const ARROW_RE = /\s*(?:-+>|—+>|–+>|→|~>|(?<!=)>{1,2}|-{1,2}(?=\s*\d))\s*/

interface Amount { expr: string; value: number | null; warnings: string[] }

/** Evaluate "30932 + 16800", "500 x 6 => 3000", "72170 - 68000". */
export function evalAmount(input: string): Amount {
  const warnings: string[] = []
  const s = fixDigits(input).replace(/[×X*]/g, 'x').replace(/\s+/g, ' ')
  // Written result after "=>", "=", "->" at the end wins (it's what the owner totalled), but we check it.
  const resMatch = s.match(/^(.*?)(?:=+>?|⇒|->)\s*(\d+(?:\.\d+)?)\s*$/)
  const body = resMatch ? resMatch[1] : s
  const tokens = body.match(/\d+(?:\.\d+)?|[+\-x]/g) ?? []
  // Rebuild a clean expression of numbers joined by operators.
  const parts: (number | string)[] = []
  for (const [i, t] of tokens.entries()) {
    if (/^\d/.test(t)) {
      // A lone 2/3/7 before the real amount is usually the handwritten arrow ("Toll 7 3500").
      if (!parts.length && /^[2378]$/.test(t) && /^\d{2,}/.test(tokens[i + 1] ?? '')) { warnings.push(`Ignored "${t}" before the amount`); continue }
      // Two numbers with no operator between them: keep the first, flag it (often a stray mark or a neighbouring column).
      if (parts.length && typeof parts[parts.length - 1] === 'number') { warnings.push(`Ignored extra number ${t}`); break }
      parts.push(Number(t))
    } else if (parts.length && typeof parts[parts.length - 1] === 'number') parts.push(t)
  }
  while (parts.length && typeof parts[parts.length - 1] === 'string') parts.pop()
  // x binds tighter than +/-
  const terms: number[] = []
  let sign = 1
  let acc: number | null = null
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (typeof p === 'number') acc = acc === null ? p : acc * p
    else if (p === 'x') continue
    else {
      if (acc !== null) terms.push(sign * acc)
      sign = p === '-' ? -1 : 1
      acc = null
    }
  }
  if (acc !== null) terms.push(sign * acc)
  const computed = terms.length ? terms.reduce((a, b) => a + b, 0) : null
  const expr = parts.map(p => (p === 'x' ? '×' : p)).join(' ')

  if (resMatch) {
    const written = Number(resMatch[2])
    if (computed !== null && Math.abs(computed - written) > 0.5) warnings.push(`Written ${written} but ${expr} = ${computed}`)
    return { expr: computed === null ? String(written) : `${expr} = ${written}`, value: written, warnings }
  }
  return { expr, value: computed, warnings }
}

/** Any real letter, ignoring ordinals ("1st"), tick marks and the multiply sign in "500x6". */
const hasLetters = (s: string) =>
  /[a-z]/i.test(s.replace(TICK_RE, '').replace(/\d+\s*(st|nd|rd|th)\b/gi, '1').replace(/(?<=\d\s*)[xX×](?=\s*\d)/g, ' '))
const isNumericLine = (s: string) => !hasLetters(s) && /\d/.test(s)

const FOOTER = [
  { key: 'spent', re: /\b(kh?[ae]r?ch[ae]?|kharach|kharcha|expense)\b/i },
  { key: 'advance', re: /\b(jam+a|jma|advance|diya)\b/i },
  { key: 'balance', re: /\b(nik?a?la|nikal|baki|baaki|balance)\b/i },
] as const

/** Split "Balu Dalal -> 1000 ✓" into label / amount text / tick. */
function splitItem(raw: string): { label: string; amountText: string; ticked: boolean } {
  let s = raw.trim()
  const ticked = TICK_RE.test(s)
  if (ticked) s = s.replace(TICK_RE, '')
  const arrow = s.match(ARROW_RE)
  if (arrow && arrow.index !== undefined && hasLetters(s.slice(0, arrow.index))) {
    return { label: s.slice(0, arrow.index), amountText: s.slice(arrow.index + arrow[0].length), ticked }
  }
  // No arrow: label is everything up to the first number that is followed only by numbers/operators.
  const m = s.match(/^(.*?[a-z].*?)\s+((?:\d[\d.,]*\s*(?:[+\-x×*]|=+>?|⇒)?\s*)+)$/i)
  if (m) return { label: m[1], amountText: m[2], ticked }
  return { label: s, amountText: '', ticked }
}

function cleanLabel(s: string): string {
  return s
    .replace(/[→⇒>~|_=]+/g, ' ')
    .replace(/[^\p{L}\p{N}/+&.\s-]/gu, ' ')
    .replace(/\s+-\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseRegister(lines: OcrLine[], opts: { year: number }): ParsedRegister {
  const out: ParsedRegister = {
    dateFrom: null,
    dateTo: null,
    items: [],
    writtenTotal: null,
    driver: { spent: null, advance: null, advanceExpr: '', balance: null },
    unparsed: [],
  }
  let inFooter = false
  let footerKey: (typeof FOOTER)[number]['key'] | null = null
  let footerExpr = ''

  const flushFooter = () => {
    if (!footerKey || !footerExpr) return
    const a = evalAmount(footerExpr)
    if (footerKey === 'spent') out.driver.spent = a.value
    if (footerKey === 'advance') { out.driver.advance = a.value; out.driver.advanceExpr = a.expr }
    if (footerKey === 'balance') out.driver.balance = a.value
    footerExpr = ''
  }

  lines.forEach((l, idx) => {
    const raw = normalizeOcrLine(l.text)
    if (!raw) return
    const conf = l.confidence ?? 0.8

    // Header date range: only before the first item.
    if (!out.items.length && !out.dateFrom) {
      const d = parseHeaderDates(raw, opts.year)
      if (d) { out.dateFrom = d.from; out.dateTo = d.to; return }
    }

    const footer = FOOTER.find(f => f.re.test(raw))
    if (footer && (out.items.length >= 3 || /dr[a-z]*v/i.test(raw) || inFooter)) {
      flushFooter()
      inFooter = true
      footerKey = footer.key
      footerExpr = raw.replace(/^[^\d]*/, '')
      // The page total is often written on the same row as "Driver Kharcha"; it equals the sum of the items.
      const onLine = evalAmount(footerExpr).value
      const sum = out.items.reduce((s, it) => s + (it.amount ?? 0), 0)
      if (out.writtenTotal === null && onLine !== null && sum > 0 && Math.abs(onLine - sum) <= sum * 0.02) {
        out.writtenTotal = onLine
        footerExpr = ''
      }
      return
    }
    if (inFooter) {
      if (isNumericLine(raw) || /^\s*(=+>?|⇒|->)/.test(raw)) { footerExpr += ' ' + raw; return }
      flushFooter()
      footerKey = null
      out.unparsed.push({ line: idx, text: raw })
      return
    }

    if (isNumericLine(raw)) {
      const a = evalAmount(raw.replace(TICK_RE, ''))
      const prev = out.items[out.items.length - 1]
      const sum = out.items.reduce((s, it) => s + (it.amount ?? 0), 0)
      // A number right under a label that had no amount belongs to that label.
      if (prev && prev.amount === null && prev.line === idx - 1 && a.value !== null) {
        prev.amount = a.value
        prev.expr = a.expr
        prev.warnings = prev.warnings.filter(w => w !== 'No amount read')
        return
      }
      // A big number after several items is the written total.
      if (out.items.length >= 3 && a.value !== null && out.writtenTotal === null && a.value >= sum * 0.5) {
        out.writtenTotal = a.value
        return
      }
      out.unparsed.push({ line: idx, text: raw })
      return
    }

    const { label: rawLabel, amountText, ticked } = splitItem(raw)
    const label = cleanLabel(rawLabel)
    if ((label.match(/\p{L}/gu)?.length ?? 0) < 2) { out.unparsed.push({ line: idx, text: raw }); return }
    const a = amountText ? evalAmount(amountText) : { expr: '', value: null, warnings: [] as string[] }
    const warnings = [...a.warnings]
    if (a.value === null) warnings.push('No amount read')
    let confidence = conf
    if (a.value === null) confidence *= 0.4
    if (a.warnings.length) confidence *= 0.6
    if (label.length < 3) confidence *= 0.7
    out.items.push({ line: idx, raw, label, expr: a.expr, amount: a.value, ticked, confidence: Math.round(confidence * 100) / 100, warnings })
  })
  flushFooter()
  return out
}

/** Sum of item amounts, and whether it agrees with the written total. */
export function reconcile(p: Pick<ParsedRegister, 'items' | 'writtenTotal'>, includedLines?: Set<number>) {
  const items = includedLines ? p.items.filter(i => includedLines.has(i.line)) : p.items
  const sum = items.reduce((s, i) => s + (i.amount ?? 0), 0)
  return { sum, matches: p.writtenTotal !== null && Math.abs(sum - p.writtenTotal) < 1, diff: p.writtenTotal === null ? null : p.writtenTotal - sum }
}
