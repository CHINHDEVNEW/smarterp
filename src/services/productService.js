import { supabase } from '../lib/supabase'
import { withOfflineFallback } from '../lib/offlineCache'
import { generateProductCode } from '../lib/productCode'

const PRODUCT_FIELDS = [
  'id',
  'business_id',
  'code',
  'sku',
  'barcode',
  'name',
  'category',
  'unit',
  'product_type',
  'cost_price',
  'sale_price',
  'stock_on_hand',
  'min_stock',
  'max_stock',
  'image_url',
  'note',
  'active',
  'created_at',
  'updated_at',
].join(',')

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === '23505') throw new Error('Mã sản phẩm, SKU hoặc barcode đã tồn tại.')
  throw new Error(error.message || fallback)
}

export async function listProducts(businessId) {
  return withOfflineFallback(`products:${businessId}`, async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('business_id', businessId)
      .order('name', { ascending: true })
    throwIfError(error, 'Không tải được danh sách sản phẩm.')
    return data ?? []
  })
}

export async function createProduct(businessId, values) {
  const productValues = {
    ...values,
    code: values.code?.trim() || generateProductCode(),
  }
  const { data, error } = await supabase
    .from('products')
    .insert({ business_id: businessId, ...productValues })
    .select(PRODUCT_FIELDS)
    .single()

  throwIfError(error, 'Không thể thêm sản phẩm.')
  return data
}

export async function updateProduct(businessId, productId, values) {
  const { data, error } = await supabase
    .from('products')
    .update(values)
    .eq('business_id', businessId)
    .eq('id', productId)
    .select(PRODUCT_FIELDS)
    .single()

  throwIfError(error, 'Không thể cập nhật sản phẩm.')
  return data
}

export async function setProductActive(businessId, productId, active) {
  return updateProduct(businessId, productId, { active })
}

export async function deleteProduct(businessId, productId) {
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('business_id', businessId)
    .eq('id', productId)
    .select('id')
    .single()

  if (error?.code === '23503') {
    throw new Error('Sản phẩm đã phát sinh chứng từ hoặc biến động kho. Hãy ngừng kinh doanh thay vì xóa.')
  }
  if (error) throw new Error(error.code === 'PGRST116' ? 'Bạn không có quyền xóa sản phẩm này.' : (error.message || 'Không thể xóa sản phẩm.'))
  return data
}

export function subscribeToProducts(businessId, onChange) {
  const channel = supabase
    .channel(`products:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${businessId}` },
      onChange,
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
