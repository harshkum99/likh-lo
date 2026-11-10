import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCompactINR, formatINR, daysBetween, toISODate, titleCase } from './format.ts'

test('formatINR uses Indian grouping', () => {
  assert.equal(formatINR(143472), '₹1,43,472')
})

test('formatCompactINR uses lakh/crore', () => {
  assert.equal(formatCompactINR(143472), '₹1.4L')
  assert.equal(formatCompactINR(25_000_000), '₹2.5Cr')
  assert.equal(formatCompactINR(-3500), '-₹3.5K')
  assert.equal(formatCompactINR(950), '₹950')
})

test('daysBetween is inclusive', () => {
  assert.equal(daysBetween('2026-11-05', '2026-11-10'), 6)
  assert.equal(daysBetween('2026-11-05', '2026-11-05'), 1)
})

test('toISODate uses local calendar date', () => {
  assert.equal(toISODate(new Date(2026, 10, 5, 0, 30)), '2026-11-05')
})

test('titleCase', () => {
  assert.equal(titleCase('DRIVER commission'), 'Driver Commission')
})
