import test from 'node:test'
import assert from 'node:assert/strict'
import { generateProductCode } from '../src/lib/productCode.js'

test('mã sản phẩm tự sinh ngắn gọn và không chứa dấu', () => {
  const code = generateProductCode(new Date(2026, 8, 5), 'a1b2c3')
  assert.equal(code, 'SP-20260905-A1B2C3')
})
