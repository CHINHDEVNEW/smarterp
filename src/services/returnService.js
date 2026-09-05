import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === 'PGRST202') throw new Error('Chức năng tạo phiếu trả hàng chưa được cài đặt trong Supabase.')
  throw new Error(error.message || fallback)
}

const candidate = (row, keys, fallback = '') => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null && row[key] !== '') return row[key]
  }
  return fallback
}

export async function createSalesReturn(businessId, values) {
  const { data, error } = await supabase.rpc('app_create_sales_return', {
    p_business_id: businessId,
    p_return: values.return,
    p_items: values.items,
  })
  throwIfError(error, 'Không thể tạo phiếu trả hàng bán.')
  return data
}

export async function createPurchaseReturn(businessId, values) {
  const { data, error } = await supabase.rpc('app_create_purchase_return', {
    p_business_id: businessId,
    p_return: values.return,
    p_items: values.items,
  })
  throwIfError(error, 'Không thể tạo phiếu trả hàng nhập.')
  return data
}

export async function settleReturn(businessId, values) {
  const { data, error } = await supabase.rpc('app_settle_return', {
    p_business_id: businessId,
    p_return_type: values.type,
    p_return_id: values.returnId,
    p_amount: values.amount,
    p_account_id: values.accountId,
    p_payment_method: values.paymentMethod,
    p_note: values.note || null,
  })
  throwIfError(error, 'Không thể đối soát tiền trả hàng.')
  return data
}

export async function listReturnItems(businessId, row) {
  if (!row?.rawId) return []
  const table = row.type === 'sales' ? 'sales_return_items' : 'purchase_return_items'
  const parentField = row.type === 'sales' ? 'sales_return_id' : 'purchase_return_id'
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('business_id', businessId)
    .eq(parentField, row.rawId)
  throwIfError(error, 'Không tải được chi tiết phiếu trả hàng.')
  return data ?? []
}

export function subscribeToReturns(businessId, onChange) {
  const channel = supabase
    .channel('returns:' + businessId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_returns', filter: 'business_id=eq.' + businessId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_returns', filter: 'business_id=eq.' + businessId }, onChange)
    .subscribe()

  return () => supabase.removeChannel(channel)
}

function normalizeReturn(row, type) {
  const rawId = row.id ?? row.code ?? row.return_code ?? JSON.stringify(row)
  const total = Number(candidate(row, ['net_total', 'total', 'total_amount', 'amount', 'refund_amount', 'return_amount', 'tong_tien'], 0)) || 0
  const refundedAmount = Number(candidate(row, ['refunded_amount'], 0)) || 0
  const status = String(candidate(row, ['status', 'return_status', 'state', 'trang_thai', 'trangThai'], ''))
  const storedRefundStatus = String(candidate(row, ['refund_status'], 'pending'))
  return {
    ...row,
    rawId,
    key: `${type}-${rawId}`,
    type,
    code: String(candidate(row, ['code', 'return_code', 'return_number', 'document_code', 'ma_phieu', 'maPhieu'], `#${String(rawId).slice(0, 8)}`)),
    date: candidate(row, ['return_date', 'returned_at', 'document_date', 'date', 'ngay_tra', 'ngayTra', 'created_at']),
    partner: String(candidate(row, type === 'sales'
      ? ['customer_name', 'customer', 'customer_display_name', 'khach_hang', 'tenKhachHang']
      : ['supplier_name', 'supplier', 'supplier_display_name', 'nha_cung_cap', 'tenNhaCungCap'], '')),
    total,
    refundedAmount,
    remainingAmount: Math.max(0, total - refundedAmount),
    refundStatus: refundedAmount >= total && total > 0 ? 'refunded' : refundedAmount > 0 ? 'partial' : storedRefundStatus,
    status,
  }
}

export async function listReturns(businessId) {
  return withOfflineFallback(`returns:${businessId}`, async () => {
    const [salesResult, purchasesResult] = await Promise.all([
      supabase.from('sales_returns').select('*').eq('business_id', businessId),
      supabase.from('purchase_returns').select('*').eq('business_id', businessId),
    ])

    throwIfError(salesResult.error, 'Không tải được phiếu trả hàng bán.')
    throwIfError(purchasesResult.error, 'Không tải được phiếu trả hàng nhập.')

    return [
      ...(salesResult.data ?? []).map((row) => normalizeReturn(row, 'sales')),
      ...(purchasesResult.data ?? []).map((row) => normalizeReturn(row, 'purchase')),
    ].sort((left, right) => {
      const rightDate = new Date(right.date || 0).getTime() || 0
      const leftDate = new Date(left.date || 0).getTime() || 0
      return rightDate - leftDate
    })
  })
}
