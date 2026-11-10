import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evalAmount, parseRegister, reconcile } from './parse.ts'
import { buildMatcher } from './match.ts'
import type { Category } from '../types.ts'

// Transcription of the sample register page (5 Nov -> 10 Nov) as a clean OCR engine would return it.
const PAGE = `5 NOV -> 10 NOV
Balu -> 16600
Urea -> 1680 v
Misc -> 1600 v
tyre ->
toll -> 3500
Balu Dalal -> 1000
Balu Kata ->
5/8 Loading -> 46100 v + 100 v
1st P -> 2170
5/8 Dalal -> 300
5/8 Ualal -> 1000 v
5/8 kata -> 300 v
Diesel -> 30932 + 16800
Podan -> 100 v
Labour -> 50 v
G.P.S -> 200 v
Chanda -> 200 v
Police -> 2000 + 120 v
Kata -> 300 v
tyre -> 500 v
5/8 Police -> 2120 v
Diesel -> 5000 v
5/8 Labour -> 500 v
Welding -> 300 v
Khorakhi -> 500 x 6 => 3000 v
Commision -> 6500 v
Grease + Hawa -> 500 v
143472
Driver Kharcha
72170
Driver Jama
5000 + 60000 + 3000
=> 68000
Driver Nikla
72170 - 68000`.split('\n').map(text => ({ text }))

test('parses the sample register page end to end', () => {
  const p = parseRegister(PAGE, { year: 2026 })
  assert.equal(p.dateFrom, '2026-11-05')
  assert.equal(p.dateTo, '2026-11-10')
  assert.equal(p.items.length, 27)
  assert.equal(p.writtenTotal, 143472)
  const r = reconcile(p)
  assert.equal(r.sum, 143472)
  assert.equal(r.matches, true)
  assert.equal(p.driver.spent, 72170)
  assert.equal(p.driver.advance, 68000)
  assert.equal(p.driver.balance, 4170)
  assert.deepEqual(p.unparsed, [])

  const diesel = p.items.find(i => i.label === 'Diesel')!
  assert.equal(diesel.amount, 47732)
  const khoraki = p.items.find(i => i.label === 'Khorakhi')!
  assert.equal(khoraki.amount, 3000)
  assert.equal(khoraki.ticked, true)
  assert.equal(p.items.find(i => i.label === '1st P')!.amount, 2170)
  assert.equal(p.items.find(i => i.label === 'tyre')!.amount, null)
  // ticked = paid by driver; the register's "Driver Kharcha" is exactly the ticked items
  const ticked = p.items.filter(i => i.ticked).reduce((s, i) => s + (i.amount ?? 0), 0)
  assert.equal(ticked, 72170)
})

test('evalAmount handles expressions, written results and OCR digit slips', () => {
  assert.equal(evalAmount('30932 + 16800').value, 47732)
  assert.equal(evalAmount('500 x 6 => 3000').value, 3000)
  assert.equal(evalAmount('500x6').value, 3000)
  assert.equal(evalAmount('35oo').value, 3500)
  assert.equal(evalAmount('1,43,472').value, 143472)
  assert.equal(evalAmount('72170 - 68000').value, 4170)
  const bad = evalAmount('500 x 6 => 3100')
  assert.equal(bad.value, 3100)
  assert.equal(bad.warnings.length, 1)
})

test('tolerates noisy OCR: unicode arrows, ticks, no arrow, amount on next line', () => {
  const p = parseRegister(
    ['Toll → 3500 ✓', 'Diesel 5000', 'Police -', '2120', 'Kata — 300'].map(text => ({ text })),
    { year: 2026 },
  )
  assert.deepEqual(p.items.map(i => [i.label, i.amount, i.ticked]), [
    ['Toll', 3500, true],
    ['Diesel', 5000, false],
    ['Police', 2120, false],
    ['Kata', 300, false],
  ])
})

const cat = (id: string, name: string, group = 'Other'): Category =>
  ({ id, name, is_default: true, is_active: true, sort_order: 0, category_group: group, user_id: null })
const CATS = [
  cat('diesel', 'Diesel', 'Fuel'), cat('toll', 'Toll'), cat('dalal', 'Dalal', 'Labour'), cat('food', 'Driver Food', 'Labour'),
  cat('comm', 'Driver Commission', 'Labour'), cat('labour', 'Labour', 'Labour'), cat('loader', 'Loader', 'Labour'),
  cat('chanda', 'Chanda'), cat('material', 'Material', 'Material'), cat('tyre', 'Tyre', 'Material'),
  cat('fault', 'Vehicle Fault', 'Material'),
]

test('matcher maps Hinglish register labels to categories', () => {
  const m = buildMatcher(CATS)
  const id = (l: string) => m(l).categoryId
  assert.equal(id('Diesel'), 'diesel')
  assert.equal(id('Disel'), 'diesel')
  assert.equal(id('Balu'), 'material')
  assert.equal(id('Balu Dalal'), 'dalal')
  assert.equal(id('5/8 Ualal'), 'dalal') // fuzzy
  assert.equal(id('Khorakhi'), 'food')
  assert.equal(id('Commision'), 'comm')
  assert.equal(id('5/8 Loading'), 'loader')
  assert.equal(id('Grease + Hawa'), 'fault')
  assert.equal(id('tyre'), 'tyre')
  // Not seeded: suggest creating a canonical category instead of a junk name
  assert.deepEqual([m('5/8 Police').newName, m('Balu Kata').newName, m('G.P.S').newName, m('Urea').newName], ['Police', 'Kata', 'GPS', 'Urea'])
  assert.equal(m('1st P').via, 'new')
})

test('matcher learns from past saves', () => {
  const m = buildMatcher(CATS, [{ notes: 'Podan', category_id: 'chanda' }, { notes: 'podan', category_id: 'chanda' }])
  assert.deepEqual([m('Podan').categoryId, m('Podan').via], ['chanda', 'learned'])
})

test('end to end on real PaddleOCR output of the sample photo', async () => {
  const { readFileSync } = await import('node:fs')
  const { assembleLines } = await import('./layout.ts')
  const fx = JSON.parse(readFileSync(new URL('./fixtures/paddle-sample.json', import.meta.url), 'utf8'))
  const lines = assembleLines(fx.lines, fx.width)
  // cut-off right-hand column fragments ("→ 6", "500", "Balu") are dropped
  assert.ok(!lines.some(l => /→ 6|^500$/.test(l.text)))
  const p = parseRegister(lines, { year: 2026 })
  assert.equal(p.dateFrom, '2026-11-05')
  assert.equal(p.items.length, 27)
  const expected = [16600, 1680, 1600, null, 3500, 1000, null, 46200, 2170, 300, 1000, 300, 47732, 100, 50, 200, 200, 2120, 300, 500, 2120, 5000, 500, 300, 3000, 6500, 500]
  assert.deepEqual(p.items.map(i => i.amount), expected)
  assert.equal(p.writtenTotal, 143472)
  assert.equal(reconcile(p).matches, true)
  assert.equal(p.driver.spent, 72170)

  const m = buildMatcher(CATS)
  const byLabel = Object.fromEntries(p.items.map(i => [i.label, m(i.label)]))
  assert.equal(byLabel['Dieod'].categoryId, 'diesel')
  assert.equal(byLabel['Bale'].categoryId, 'material')
  assert.equal(byLabel['Laliour'].categoryId, 'labour')
  assert.equal(byLabel['weldiry'].categoryId, 'fault')
  assert.equal(byLabel['5/8 Palice'].newName, 'Police')
})

test('review helpers: year rollover, line groups, crops, duplicates', async () => {
  const { parsePage, lineGroups, cropStyle, countDuplicates } = await import('./review.ts')
  const page = (header: string) => [{ text: header }, { text: 'Toll -> 3500' }]
  assert.equal(parsePage(page('5 NOV -> 10 NOV'), '2026-11-11').dateFrom, '2026-11-05')
  // A December page scanned in early January belongs to last year; a page a few weeks ahead stays this year.
  assert.equal(parsePage(page('28 Dec -> 3 Jan'), '2027-01-04').dateFrom, '2026-12-28')
  assert.equal(parsePage(page('28 Dec -> 3 Jan'), '2027-01-04').dateTo, '2027-01-03')
  assert.equal(parsePage(page('1 Dec'), '2026-11-11').dateFrom, '2026-12-01')
  // Impossible days (a misread "30") clamp to the month's end instead of producing a date the database rejects.
  assert.equal(parsePage(page('31 Nov -> 3 Dec'), '2026-12-04').dateFrom, '2026-11-30')
  assert.equal(parsePage(page('25 Feb -> 29 Feb'), '2026-03-01').dateTo, '2026-02-28')
  assert.equal(parsePage(page('25 Feb -> 29 Feb'), '2028-03-01').dateTo, '2028-02-29')

  const b = (x: number, y: number, width = 50, height = 30) => ({ x, y, width, height })
  // two boxes on one line (tops 6px apart), a new line 40px lower, zero-size boxes ignored
  assert.deepEqual(lineGroups([b(200, 106), b(10, 100), b(10, 140), b(0, 0, 0, 5)]), [b(10, 100, 240, 36), b(10, 140)])

  const s = cropStyle({ x: 100, y: 200, width: 400, height: 40 }, { width: 900, height: 1600 }, 40, 0)
  assert.equal(s.aspectRatio, '400 / 40')
  assert.equal(s.width, 'min(100%, 400px)')
  assert.equal(s.backgroundSize, '225% 4000%')
  assert.equal(s.backgroundPosition, '20% 12.82051282051282%')
  // box covering the whole width: no division by zero
  assert.equal(cropStyle({ x: 0, y: 0, width: 900, height: 40 }, { width: 900, height: 1600 }).backgroundPosition, '0% 0%')

  const saved = [{ notes: 'Diesel', amount: 47732 }, { notes: 'toll', amount: 3500 }, { notes: null, amount: 100 }]
  assert.equal(countDuplicates([{ label: 'diesel', amount: 47732 }, { label: 'Toll', amount: 3500 }, { label: 'Toll', amount: 3500 }, { label: 'Kata', amount: 300 }], saved), 2)
})
