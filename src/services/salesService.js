import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'

const SALES_FIELDS = [
  'id', 'business_id', 'code', 'order_date', 'due_date', 'customer_id', 'customer_name',
  'status', 'channel', 'subtotal', 'discount', 'shipping_fee', 'vat_rate', 'vat_amount',
  'total', 'return_total', 'net_total', 'paid_amount', 'balance_due', 'payment_status', 'note', 'created_at',
].join(',')

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === 'PGRST202') throw new Error('Chức năng tạo đơn chưa được cài đặt trong Supabase.')
  throw new Error(error.message || fallback)
}

export async function listSalesOrders(businessId) {
  return withOfflineFallback(`sales:${businessId}`, async () => {
    const { data, error } = await supabase
      .from('v_app_sales_orders')
      .select(SALES_FIELDS)
      .eq('business_id', businessId)
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000)
    throwIfError(error, 'Không tải được danh sách đơn bán.')
    return data ?? []
  })
}

export async function getSalesOrderItems(businessId, salesOrderId) {
  const { data, error } = await supabase
    .from('sales_order_items')
    .select('id, product_id, product_code, product_name, unit, quantity, unit_price, unit_cost, line_total, note')
    .eq('business_id', businessId)
    .eq('sales_order_id', salesOrderId)

  throwIfError(error, 'Không tải được chi tiết đơn bán.')
  return data ?? []
}

export async function createSalesOrder(businessId, order, items) {
  const { data, error } = await supabase.rpc('app_create_sales_order', {
    p_business_id: businessId,
    p_order: order,
    p_items: items,
  })

  throwIfError(error, 'Không thể tạo đơn bán.')
  return data
}

export async function createPosSale(businessId, order, items, payment) {
  const { data, error } = await supabase.rpc('app_create_pos_sale', {
    p_business_id: businessId,
    p_order: order,
    p_items: items,
    p_account_id: payment.accountId,
    p_payment_method: payment.paymentMethod,
  })
  throwIfError(error, 'Không thể hoàn tất đơn POS.')
  return data
}

export async function cancelSalesOrder(businessId, salesOrderId, reason) {
  const { data, error } = await supabase.rpc('app_cancel_sales_order', {
    p_business_id: businessId,
    p_sales_order_id: salesOrderId,
    p_reason: reason,
  })
  throwIfError(error, 'Không thể hủy đơn bán.')
  return data
}

export function subscribeToSalesOrders(businessId, onChange) {
  const channel = supabase
    .channel(`sales-orders:${businessId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders', filter: `business_id=eq.${businessId}` }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
