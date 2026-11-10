import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucketKey, change, computeDashboard, resolvePeriod, summarizeTrips } from './analytics.ts'
import type { Category, Expense, Trip } from './types.ts'

const trip = (p: Partial<Trip>): Trip => ({
  id: 't', start_date: '2026-11-01', end_date: null, commodity: 'Balu', route: null, vehicle_number: 'JH01AB1234',
  sell_amount: 0, status: 'running', notes: null, driver_advance: 0, created_at: '', ...p,
})
const exp = (p: Partial<Expense>): Expense => ({
  id: Math.random().toString(36), trip_id: 't', category_id: 'diesel', amount: 100, date: '2026-11-02', notes: null, paid_by: 'owner', created_at: '', ...p,
})
const cats: Category[] = [
  { id: 'diesel', name: 'Diesel', is_default: true, is_active: true, sort_order: 1, category_group: 'Fuel', user_id: null },
  { id: 'toll', name: 'Toll', is_default: true, is_active: true, sort_order: 2, category_group: 'Other', user_id: null },
]

test('resolvePeriod: 30d has a previous window of equal length', () => {
  const p = resolvePeriod('30d', '2026-11-10')
  assert.equal(p.from, '2026-10-12')
  assert.equal(p.days, 30)
  assert.deepEqual(p.prev, { from: '2026-09-12', to: '2026-10-11' })
  assert.equal(p.bucket, 'day')
})

test('bucketKey: weeks start on Monday', () => {
  assert.equal(bucketKey('2026-11-10', 'week'), '2026-11-09') // Tue -> Mon
  assert.equal(bucketKey('2026-11-10', 'month'), '2026-11-01')
})

test('summarizeTrips: register example settles driver balance', () => {
  // 72,170 paid by driver, 68,000 advanced -> driver is owed 4,170
  const t = trip({ id: 't1', driver_advance: 68000, sell_amount: 200000, status: 'completed', end_date: '2026-11-10', start_date: '2026-11-05' })
  const s = summarizeTrips([t], [
    exp({ trip_id: 't1', amount: 72170, paid_by: 'driver' }),
    exp({ trip_id: 't1', amount: 71302 }),
  ]).get('t1')!
  assert.equal(s.spent, 143472)
  assert.equal(s.driverBalance, 4170)
  assert.equal(s.profit, 200000 - 143472)
  assert.equal(s.days, 6)
})

test('computeDashboard: revenue on end date, expenses on their date, vehicle filter', () => {
  const trips = [
    trip({ id: 'a', vehicle_number: 'jh01', status: 'completed', start_date: '2026-11-01', end_date: '2026-11-05', sell_amount: 50000 }),
    trip({ id: 'b', vehicle_number: 'JH02', status: 'running', start_date: '2026-11-06' }),
    trip({ id: 'c', vehicle_number: 'JH02', status: 'completed', start_date: '2026-08-01', end_date: '2026-08-03', sell_amount: 9999 }),
  ]
  const expenses = [
    exp({ trip_id: 'a', amount: 20000, date: '2026-11-02' }),
    exp({ trip_id: 'a', amount: 1000, date: '2026-11-03', category_id: 'toll' }),
    exp({ trip_id: 'b', amount: 5000, date: '2026-11-07', paid_by: 'driver' }),
  ]
  const d = computeDashboard({ trips, expenses, categories: cats }, { period: '30d', today: '2026-11-10' })
  assert.equal(d.totals.revenue, 50000)
  assert.equal(d.totals.expense, 26000)
  assert.equal(d.totals.profit, 24000)
  assert.equal(d.totals.tripsCompleted, 1)
  assert.equal(d.live.activeTrips, 1)
  assert.equal(d.live.runningSpend, 5000)
  assert.equal(d.live.driverBalance, 5000)
  assert.equal(d.categories[0].name, 'Diesel')
  assert.equal(d.groups.find(g => g.group === 'Fuel')!.amount, 25000)
  assert.equal(d.series.reduce((s, p) => s + p.expense, 0), 26000)
  assert.equal(d.vehicles[0].vehicle, 'JH01') // best profit first, vehicle numbers normalised
  // utilisation of JH01: 5 running days out of 30
  assert.ok(Math.abs(d.vehicles[0].utilization! - 5 / 30) < 1e-9)

  const only2 = computeDashboard({ trips, expenses, categories: cats }, { period: '30d', vehicle: 'JH02', today: '2026-11-10' })
  assert.equal(only2.totals.expense, 5000)
  assert.equal(only2.totals.revenue, 0)
  assert.equal(only2.vehicles.length, 1)
})

test('change: null without a baseline', () => {
  assert.equal(change(10, 0), null)
  assert.equal(change(15, 10), 0.5)
})
