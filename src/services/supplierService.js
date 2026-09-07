import { supabase } from '../lib/supabase'

const SUPPLIER_FIELDS = 'id, business_id, code, name, phone, email, address, contact_person, tax_code, website, supplier_group, note, active, created_at, updated_at'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === '23505') throw new Error('Mã nhà cung cấp đã tồn tại.')
  throw new Error(error.message || fallback)
}

export async function listSuppliers(businessId) {
  const { data, error } = await supabase.from('suppliers').select(SUPPLIER_FIELDS).eq('business_id', businessId).order('name', { ascending: true })
  throwIfError(error, 'Không tải được danh sách nhà cung cấp.')
  return data ?? []
}

export async function createSupplier(businessId, values) {
  const { data, error } = await supabase.from('suppliers').insert({ business_id: businessId, ...values }).select(SUPPLIER_FIELDS).single()
  throwIfError(error, 'Không thể thêm nhà cung cấp.')
  return data
}

export async function updateSupplier(businessId, supplierId, values) {
  const { data, error } = await supabase.from('suppliers').update(values).eq('business_id', businessId).eq('id', supplierId).select(SUPPLIER_FIELDS).single()
  throwIfError(error, 'Không thể cập nhật nhà cung cấp.')
  return data
}

export async function setSupplierActive(businessId, supplierId, active) { return updateSupplier(businessId, supplierId, { active }) }

export async function deleteSupplier(businessId, supplierId) {
  const { data, error } = await supabase
    .from('suppliers')
    .delete()
    .eq('business_id', businessId)
    .eq('id', supplierId)
    .select('id')
    .single()

  if (error?.code === '23503') throw new Error('Nhà cung cấp đã phát sinh chứng từ. Hãy ngừng giao dịch thay vì xóa.')
  if (error) throw new Error(error.code === 'PGRST116' ? 'Bạn không có quyền xóa nhà cung cấp này.' : (error.message || 'Không thể xóa nhà cung cấp.'))
  return data
}

export function subscribeToSuppliers(businessId, onChange) {
  const channel = supabase.channel(`suppliers:${businessId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers', filter: `business_id=eq.${businessId}` }, onChange).subscribe()
  return () => supabase.removeChannel(channel)
}
