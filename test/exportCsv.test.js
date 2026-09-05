import test from 'node:test'
import assert from 'node:assert/strict'
import { toCsv } from '../src/lib/exportCsv.js'

test('CSV giữ tiếng Việt và escape dấu phẩy, dấu nháy', () => {
  const csv = toCsv(
    [{ key: 'name', label: 'Khách hàng' }, { key: 'note', label: 'Ghi chú' }],
    [{ name: 'Nguyễn Văn A', note: 'Giao nhanh, gọi "trước"' }],
  )
  assert.equal(csv, '"Khách hàng","Ghi chú"\r\n"Nguyễn Văn A","Giao nhanh, gọi ""trước"""')
})

