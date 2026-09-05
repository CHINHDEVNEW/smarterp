import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccess } from '../src/lib/permissions.js'

test('owner có toàn quyền', () => {
  assert.equal(canAccess('owner', 'settings'), true)
  assert.equal(canAccess('owner', 'finance'), true)
})

test('nhân viên bán hàng không vào tài chính hoặc mua hàng', () => {
  assert.equal(canAccess('sales', 'pos'), true)
  assert.equal(canAccess('sales', 'finance'), false)
  assert.equal(canAccess('sales', 'purchases'), false)
})

test('kế toán chỉ vào chức năng tài chính và báo cáo cần thiết', () => {
  assert.equal(canAccess('accountant', 'finance'), true)
  assert.equal(canAccess('accountant', 'reports'), true)
  assert.equal(canAccess('accountant', 'pos'), false)
  assert.equal(canAccess('accountant', 'products_manage'), false)
})

test('chỉ vai trò quản lý danh mục được sửa sản phẩm', () => {
  assert.equal(canAccess('manager', 'products_manage'), true)
  assert.equal(canAccess('warehouse', 'products_manage'), true)
  assert.equal(canAccess('sales', 'products_manage'), false)
  assert.equal(canAccess('owner', 'products_delete'), true)
  assert.equal(canAccess('manager', 'products_delete'), false)
})

test('phân quyền module sản xuất theo vai trò', () => {
  assert.equal(canAccess('manager', 'production'), true)
  assert.equal(canAccess('warehouse', 'production_manage'), true)
  assert.equal(canAccess('accountant', 'production'), true)
  assert.equal(canAccess('accountant', 'production_manage'), false)
  assert.equal(canAccess('sales', 'production'), false)
})

test('vai trò không xác định không nhận quyền nhạy cảm', () => {
  assert.equal(canAccess('', 'settings'), false)
  assert.equal(canAccess('unknown', 'finance'), false)
})
