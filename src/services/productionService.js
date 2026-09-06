import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'

const PRODUCT_FIELDS = 'id, business_id, code, sku, name, unit, product_type, cost_price, stock_on_hand, active'
const BOM_FIELDS = 'id, business_id, code, name, output_product_id, output_product_code, output_product_name, output_unit, output_quantity, version, status, note, item_count, planned_material_cost, created_at, updated_at'
const ORDER_FIELDS = 'id, business_id, code, bom_id, bom_code, bom_name, output_product_id, output_product_code, output_product_name, output_unit, order_date, planned_start_date, planned_end_date, status, planned_quantity, actual_quantity, scrapped_quantity, planned_material_cost, actual_material_cost, planned_labor_cost, actual_labor_cost, planned_machine_cost, actual_machine_cost, planned_outsourcing_cost, actual_outsourcing_cost, planned_other_cost, actual_other_cost, planned_total_cost, actual_total_cost, cost_variance, actual_unit_cost, material_count, planned_material_quantity, issued_material_quantity, returned_material_quantity, output_receipt_count, waste_count, cost_count, note, created_by, created_at, updated_at'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === 'PGRST202') throw new Error('Module Sản xuất chưa được cài đặt trong Supabase.')
  if (error.code === '23505') throw new Error('Mã định mức hoặc lệnh sản xuất đã tồn tại.')
  throw new Error(error.message || fallback)
}

export async function listProductionData(businessId) {
  return withOfflineFallback('production:' + businessId, async () => {
    const [productsResult, bomsResult, ordersResult] = await Promise.all([
      supabase.from('products').select(PRODUCT_FIELDS).eq('business_id', businessId).eq('active', true).order('name', { ascending: true }),
      supabase.from('v_production_bom_summary').select(BOM_FIELDS).eq('business_id', businessId).order('updated_at', { ascending: false }).limit(500),
      supabase.from('v_production_order_summary').select(ORDER_FIELDS).eq('business_id', businessId).order('order_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
    ])
    throwIfError(productsResult.error, 'Không tải được danh sách sản phẩm cho sản xuất.')
    throwIfError(bomsResult.error, 'Không tải được định mức nguyên vật liệu.')
    throwIfError(ordersResult.error, 'Không tải được lệnh sản xuất.')
    return {
      products: (productsResult.data ?? []).filter((product) => String(product.product_type || '').toLowerCase() !== 'service'),
      boms: bomsResult.data ?? [],
      orders: ordersResult.data ?? [],
    }
  })
}

export async function getProductionBomItems(businessId, bomId) {
  const { data, error } = await supabase
    .from('production_bom_items')
    .select('id, business_id, bom_id, material_product_id, quantity, scrap_rate, unit, unit_cost, note')
    .eq('business_id', businessId)
    .eq('bom_id', bomId)
    .order('created_at', { ascending: true })
  throwIfError(error, 'Không tải được chi tiết định mức.')
  return data ?? []
}

export async function getProductionOrderDetails(businessId, orderId) {
  const [materialsResult, costsResult, outputsResult, wastesResult] = await Promise.all([
    supabase.from('production_order_materials').select('id, business_id, production_order_id, bom_item_id, product_id, product_code, product_name, unit, planned_quantity, issued_quantity, returned_quantity, issued_value, returned_value, unit_cost, note, created_at, updated_at').eq('business_id', businessId).eq('production_order_id', orderId).order('created_at', { ascending: true }),
    supabase.from('production_order_costs').select('id, business_id, production_order_id, cost_type, description, planned_amount, actual_amount, note, created_at, updated_at').eq('business_id', businessId).eq('production_order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('production_order_outputs').select('id, business_id, production_order_id, product_id, quantity, unit_cost, note, created_at').eq('business_id', businessId).eq('production_order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('production_order_wastes').select('id, business_id, production_order_id, product_id, waste_type, quantity, unit, unit_cost, reason, created_at').eq('business_id', businessId).eq('production_order_id', orderId).order('created_at', { ascending: false }),
  ])
  throwIfError(materialsResult.error, 'Không tải được nguyên vật liệu của lệnh.')
  throwIfError(costsResult.error, 'Không tải được chi phí của lệnh.')
  throwIfError(outputsResult.error, 'Không tải được thành phẩm của lệnh.')
  throwIfError(wastesResult.error, 'Không tải được phế phẩm của lệnh.')
  return {
    materials: materialsResult.data ?? [],
    costs: costsResult.data ?? [],
    outputs: outputsResult.data ?? [],
    wastes: wastesResult.data ?? [],
  }
}

async function callRpc(name, args, fallback) {
  const { data, error } = await supabase.rpc(name, args)
  throwIfError(error, fallback)
  return data
}

export function saveProductionBom(businessId, bom, items) {
  return callRpc('app_save_production_bom', { p_business_id: businessId, p_bom: bom, p_items: items }, 'Không thể lưu định mức.')
}

export function setProductionBomStatus(businessId, bomId, status) {
  return callRpc('app_set_production_bom_status', { p_business_id: businessId, p_bom_id: bomId, p_status: status }, 'Không thể cập nhật trạng thái định mức.')
}

export function createProductionOrder(businessId, order, materials = []) {
  return callRpc('app_create_production_order', { p_business_id: businessId, p_order: order, p_materials: materials }, 'Không thể tạo lệnh sản xuất.')
}

export function updateProductionOrderStatus(businessId, orderId, status, note = '') {
  return callRpc('app_update_production_order_status', { p_business_id: businessId, p_order_id: orderId, p_status: status, p_note: note || null }, 'Không thể cập nhật trạng thái lệnh.')
}

export function issueProductionMaterials(businessId, orderId, items) {
  return callRpc('app_issue_production_materials', { p_business_id: businessId, p_order_id: orderId, p_items: items }, 'Không thể xuất nguyên liệu.')
}

export function returnProductionMaterials(businessId, orderId, items) {
  return callRpc('app_return_production_materials', { p_business_id: businessId, p_order_id: orderId, p_items: items }, 'Không thể trả nguyên liệu.')
}

export function receiveProductionOutput(businessId, orderId, quantity, unitCost, note) {
  return callRpc('app_receive_production_output', { p_business_id: businessId, p_order_id: orderId, p_quantity: quantity, p_unit_cost: unitCost ?? null, p_note: note || null }, 'Không thể nhập thành phẩm.')
}

export function recordProductionWaste(businessId, orderId, quantity, wasteType, productId, unitCost, reason) {
  return callRpc('app_record_production_waste', { p_business_id: businessId, p_order_id: orderId, p_quantity: quantity, p_waste_type: wasteType, p_product_id: productId || null, p_unit_cost: unitCost ?? null, p_reason: reason || null }, 'Không thể ghi nhận phế phẩm.')
}

export function addProductionCost(businessId, orderId, cost) {
  return callRpc('app_add_production_cost', { p_business_id: businessId, p_order_id: orderId, p_cost: cost }, 'Không thể lưu chi phí sản xuất.')
}

export function subscribeToProduction(businessId, onChange) {
  const channel = supabase
    .channel('production:' + businessId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_boms', filter: 'business_id=eq.' + businessId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_orders', filter: 'business_id=eq.' + businessId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_order_materials', filter: 'business_id=eq.' + businessId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_order_costs', filter: 'business_id=eq.' + businessId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_order_outputs', filter: 'business_id=eq.' + businessId }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_order_wastes', filter: 'business_id=eq.' + businessId }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
