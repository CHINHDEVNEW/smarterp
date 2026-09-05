import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'

const QUOTE_FIELDS = 'id, business_id, code, quote_date, valid_until, customer_id, customer_name, status, subtotal, discount, shipping_fee, vat_rate, vat_amount, total, converted_sales_order_id, note, created_at'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === 'PGRST202') throw new Error('Chức năng tạo báo giá chưa được cài đặt trong Supabase.')
  throw new Error(error.message || fallback)
}

export async function listQuotes(businessId) {
  return withOfflineFallback(`quotes:${businessId}`, async () => {
    const { data, error } = await supabase.from('quotes').select(QUOTE_FIELDS).eq('business_id', businessId).order('quote_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
    throwIfError(error, 'Không tải được danh sách báo giá.')
    return data ?? []
  })
}

export async function getQuoteItems(businessId, quoteId) {
  const { data, error } = await supabase.from('quote_items').select('id, product_id, product_code, product_name, unit, quantity, unit_price, line_total, note').eq('business_id', businessId).eq('quote_id', quoteId)
  throwIfError(error, 'Không tải được chi tiết báo giá.')
  return data ?? []
}

export async function createQuote(businessId, quote, items) {
  const { data, error } = await supabase.rpc('app_create_quote', { p_business_id: businessId, p_quote: quote, p_items: items })
  throwIfError(error, 'Không thể tạo báo giá.')
  return data
}

export async function updateQuoteStatus(businessId, quoteId, status) {
  const { data, error } = await supabase.rpc('app_update_quote_status', {
    p_business_id: businessId,
    p_quote_id: quoteId,
    p_status: status,
  })
  throwIfError(error, 'Không thể cập nhật trạng thái báo giá.')
  return data
}

export async function convertQuoteToSales(businessId, quoteId, orderDate, dueDate = null) {
  const { data, error } = await supabase.rpc('app_convert_quote_to_sales', {
    p_business_id: businessId,
    p_quote_id: quoteId,
    p_order_date: orderDate,
    p_due_date: dueDate,
  })
  throwIfError(error, 'Không thể chuyển báo giá thành đơn bán.')
  return data
}

export function subscribeToQuotes(businessId, onChange) {
  const channel = supabase.channel(`quotes:${businessId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'quotes', filter: `business_id=eq.${businessId}` }, onChange).subscribe()
  return () => supabase.removeChannel(channel)
}
