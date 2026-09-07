import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'

const CUSTOMER_FIELDS = [
  'id',
  'business_id',
  'code',
  'name',
  'phone',
  'email',
  'address',
  'customer_group',
  'credit_limit',
  'note',
  'active',
  'created_at',
  'updated_at',
].join(',')

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === '23505') throw new Error('Mã khách hàng đã tồn tại.')
  throw new Error(error.message || fallback)
}

function summarizeOrders(orders) {
  const summaries = new Map()

  orders.forEach((order) => {
    if (!order.customer_id || ['cancelled', 'draft'].includes(order.status)) return
    const current = summaries.get(order.customer_id) ?? { totalSales: 0, receivable: 0, orderCount: 0 }
    current.totalSales += Number(order.net_total ?? order.total) || 0
    current.receivable += Number(order.balance_due) || 0
    current.orderCount += 1
    summaries.set(order.customer_id, current)
  })

  return summaries
}

export async function listCustomersWithSummary(businessId) {
  return withOfflineFallback(`customers:${businessId}`, async () => {
    const [customersResult, ordersResult] = await Promise.all([
    supabase
      .from('customers')
      .select(CUSTOMER_FIELDS)
      .eq('business_id', businessId)
      .order('name', { ascending: true }),
    supabase
      .from('v_app_sales_orders')
      .select('customer_id, total, net_total, balance_due, status')
      .eq('business_id', businessId),
    ])

    throwIfError(customersResult.error, 'Không tải được danh sách khách hàng.')
    throwIfError(ordersResult.error, 'Không tải được doanh số khách hàng.')

    const summaries = summarizeOrders(ordersResult.data ?? [])
    return (customersResult.data ?? []).map((customer) => ({
      ...customer,
      ...(summaries.get(customer.id) ?? { totalSales: 0, receivable: 0, orderCount: 0 }),
    }))
  })
}

export async function createCustomer(businessId, values) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ business_id: businessId, ...values })
    .select(CUSTOMER_FIELDS)
    .single()

  throwIfError(error, 'Không thể thêm khách hàng.')
  return data
}

export async function updateCustomer(businessId, customerId, values) {
  const { data, error } = await supabase
    .from('customers')
    .update(values)
    .eq('business_id', businessId)
    .eq('id', customerId)
    .select(CUSTOMER_FIELDS)
    .single()

  throwIfError(error, 'Không thể cập nhật khách hàng.')
  return data
}

export async function setCustomerActive(businessId, customerId, active) {
  return updateCustomer(businessId, customerId, { active })
}

export async function deleteCustomer(businessId, customerId) {
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('business_id', businessId)
    .eq('id', customerId)
    .select('id')
    .single()

  if (error?.code === '23503') throw new Error('Khách hàng đã phát sinh chứng từ. Hãy ngừng giao dịch thay vì xóa.')
  if (error) throw new Error(error.code === 'PGRST116' ? 'Bạn không có quyền xóa khách hàng này.' : (error.message || 'Không thể xóa khách hàng.'))
  return data
}

export function subscribeToCustomers(businessId, onChange) {
  const channel = supabase
    .channel(`customers:${businessId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `business_id=eq.${businessId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders', filter: `business_id=eq.${businessId}` }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
