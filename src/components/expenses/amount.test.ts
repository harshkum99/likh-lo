import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanAmountInput } from './amount.ts'

test('cleanAmountInput keeps a typeable rupee amount', () => {
  assert.equal(cleanAmountInput('1,500'), '1500')
  assert.equal(cleanAmountInput('12.5'), '12.5')
  assert.equal(cleanAmountInput('12.'), '12.')
  assert.equal(cleanAmountInput('1.2.3'), '1.23')
  assert.equal(cleanAmountInput('-45e2'), '452')
  assert.equal(cleanAmountInput('9.999'), '9.99')
  assert.equal(cleanAmountInput('12345678901'), '123456789')
})
