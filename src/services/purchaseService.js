import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'

const PURCHASE_FIELDS = 'id, business_id, code, order_date, due_date, supplier_id, supplier_name, status, subtotal, discount, shipping_fee, vat_rate, vat_amount, total, return_total, net_total, paid_amount, balance_due, payment_status, note, created_at'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === 'PGRST202') throw new Error('Chức năng tạo phiếu nhập chưa được cài đặt trong Supabase.')
  throw new Error(error.message || fallback)
}

export async function listPurchaseOrders(businessId) {
  return withOfflineFallback(`purchases:${businessId}`, async () => {
    const { data, error } = await supabase.from('v_app_purchase_orders').select(PURCHASE_FIELDS).eq('business_id', businessId).order('order_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
    throwIfError(error, 'Không tải được danh sách phiếu nhập.')
    return data ?? []
  })
}

export async function getPurchaseOrderItems(businessId, orderId) {
  const { data, error } = await supabase.from('purchase_order_items').select('id, product_id, product_code, product_name, unit, quantity, unit_cost, line_total, note').eq('business_id', businessId).eq('purchase_order_id', orderId)
  throwIfError(error, 'Không tải được chi tiết phiếu nhập.')
  return data ?? []
}

export async function createPurchaseOrder(businessId, order, items) {
  const { data, error } = await supabase.rpc('app_create_purchase_order', { p_business_id: businessId, p_order: order, p_items: items })
  throwIfError(error, 'Không thể tạo phiếu nhập.')
  return data
}

export async function recordPurchasePayment(businessId, values) {
  const { data, error } = await supabase.rpc('app_record_purchase_payment', {
    p_business_id: businessId,
    p_purchase_order_id: values.purchaseOrderId,
    p_amount: values.amount,
    p_account_id: values.accountId,
    p_payment_method: values.paymentMethod,
    p_note: values.note || null,
  })
  if (error?.code === 'PGRST202') throw new Error('Chức năng thanh toán nhà cung cấp chưa được cài đặt trong Supabase.')
  throwIfError(error, 'Không thể ghi nhận thanh toán phiếu nhập.')
  return data
}

export async function cancelPurchaseOrder(businessId, purchaseOrderId, reason) {
  const { data, error } = await supabase.rpc('app_cancel_purchase_order', {
    p_business_id: businessId,
    p_purchase_order_id: purchaseOrderId,
    p_reason: reason,
  })
  throwIfError(error, 'Không thể hủy phiếu nhập.')
  return data
}

export function subscribeToPurchaseOrders(businessId, onChange) {
  const channel = supabase.channel(`purchase-orders:${businessId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders', filter: `business_id=eq.${businessId}` }, onChange).subscribe()
  return () => supabase.removeChannel(channel)
}
