import assert from 'node:assert/strict'
import test from 'node:test'
import { currencyInputStep, roundCurrency, setCurrencySettings } from '../src/lib/formatters.js'

test('money inputs use the configured currency precision', () => {
  setCurrencySettings({ currency_code: 'VND', money_decimals: 0 })
  assert.equal(roundCurrency(2174999.01), 2174999)
  assert.equal(roundCurrency(2174999.99), 2175000)
  assert.equal(currencyInputStep(), 1)

  setCurrencySettings({ currency_code: 'USD', money_decimals: 2 })
  assert.equal(roundCurrency(12.345), 12.35)
  assert.equal(currencyInputStep(), 0.01)
})
