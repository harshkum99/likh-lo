// Formatting + date helpers shared by server and client code. No imports so node --test can load it.

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** ₹1,43,472 */
export function formatINR(n: number | null | undefined): string {
  return inr.format(Math.round(Number(n) || 0))
}

/** 1,43,472 (no currency sign) */
export function formatNumber(n: number | null | undefined): string {
  return num.format(Math.round(Number(n) || 0))
}

/** ₹1.4L, ₹2.1Cr, ₹950 — Indian short scale for KPI tiles and chart axes. */
export function formatCompactINR(n: number | null | undefined): string {
  const v = Number(n) || 0
  const a = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  const short = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''))
  if (a >= 1e7) return `${sign}₹${short(a / 1e7)}Cr`
  if (a >= 1e5) return `${sign}₹${short(a / 1e5)}L`
  if (a >= 1e3) return `${sign}₹${short(a / 1e3)}K`
  return `${sign}₹${Math.round(a)}`
}

/** 0.1234 -> "12%" (one decimal under 10%). */
export function formatPercent(fraction: number | null | undefined): string {
  const p = (Number(fraction) || 0) * 100
  return `${Math.abs(p) < 10 && p !== 0 ? p.toFixed(1) : Math.round(p)}%`
}

/** Local-time YYYY-MM-DD (toISOString() would give yesterday in IST before 05:30). */
export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// shortcut: "today" is pinned to India time so a UTC server and an IST phone agree; make it a user setting if the
// app is ever used outside IST.
const istDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
export function todayISO(): string {
  return istDay.format(new Date())
}

/** Parse a Postgres DATE ("2026-11-05") as a local date, not UTC midnight. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 5 Nov · or 5 Nov 2026 with { year: true } */
export function formatDate(s: string | null | undefined, opts: { year?: boolean; weekday?: boolean } = {}): string {
  if (!s) return '—'
  return parseISODate(s).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(opts.year ? { year: 'numeric' } : {}),
    ...(opts.weekday ? { weekday: 'short' } : {}),
  })
}

/** Inclusive day count between two ISO dates; open-ended ranges run to today. */
export function daysBetween(start: string, end?: string | null): number {
  const a = parseISODate(start).getTime()
  const b = end ? parseISODate(end).getTime() : parseISODate(todayISO()).getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

export function titleCase(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
