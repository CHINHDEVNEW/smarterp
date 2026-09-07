import { supabase } from '../lib/supabase'

const PRODUCT_FIELDS = 'id, business_id, code, sku, name, unit, product_type, cost_price, stock_on_hand, min_stock, active'
const MOVEMENT_FIELDS = 'id, business_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_at, created_by'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === '23514') throw new Error('Số lượng điều chỉnh không hợp lệ.')
  throw new Error(error.message || fallback)
}

export async function listInventoryData(businessId) {
  const [productsResult, movementsResult] = await Promise.all([
    supabase.from('products').select(PRODUCT_FIELDS).eq('business_id', businessId).eq('active', true).order('name', { ascending: true }),
    supabase.from('stock_movements').select(MOVEMENT_FIELDS).eq('business_id', businessId).order('created_at', { ascending: false }).limit(1000),
  ])
  throwIfError(productsResult.error, 'Không tải được danh sách tồn kho.')
  throwIfError(movementsResult.error, 'Không tải được sổ kho.')
  return { products: productsResult.data ?? [], movements: movementsResult.data ?? [] }
}

export async function createStockAdjustment(businessId, values) {
  const { data, error } = await supabase.rpc('app_create_stock_adjustment', {
    p_business_id: businessId,
    p_product_id: values.product_id,
    p_quantity: values.quantity,
    p_unit_cost: values.unit_cost,
    p_note: values.note,
  })
  throwIfError(error, 'Không thể ghi nhận điều chỉnh kho.')
  return data
}

export async function listStocktakes(businessId) {
  const { data, error } = await supabase
    .from('stocktakes')
    .select('*')
    .eq('business_id', businessId)
    .order('stocktake_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  throwIfError(error, 'Không tải được lịch sử kiểm kê.')
  return data ?? []
}

export async function listStocktakeItems(businessId, stocktakeId) {
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('stocktake_id', stocktakeId)
    .order('created_at', { ascending: true })
  throwIfError(error, 'Không tải được chi tiết phiếu kiểm kê.')
  return data ?? []
}

export async function createStocktake(businessId, values) {
  const { data, error } = await supabase.rpc('app_create_stocktake', {
    p_business_id: businessId,
    p_stocktake: values.stocktake,
    p_items: values.items,
  })
  if (error?.code === 'PGRST202') throw new Error('Chức năng kiểm kê chưa được cài đặt trong Supabase.')
  throwIfError(error, 'Không thể tạo phiếu kiểm kê.')
  return data
}

export async function cancelStocktake(businessId, stocktakeId, reason) {
  const { data, error } = await supabase.rpc('app_cancel_stocktake', {
    p_business_id: businessId,
    p_stocktake_id: stocktakeId,
    p_reason: reason,
  })
  throwIfError(error, 'Không thể hủy phiếu kiểm kê.')
  return data
}

export function subscribeToInventory(businessId, onChange) {
  const channel = supabase
    .channel(`inventory:${businessId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements', filter: `business_id=eq.${businessId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stocktakes', filter: 'business_id=eq.' + businessId }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
