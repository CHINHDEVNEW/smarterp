import { supabase } from '../lib/supabase'

const BUSINESS_FIELDS = 'id, name, phone, email, address'
const APP_SETTINGS_FIELDS = 'business_id, currency_code, currency_symbol, money_decimals, default_vat, allow_negative_stock'
const SEQUENCE_FIELDS = 'id, business_id, entity, prefix, next_number, padding'

export async function updateBusiness(businessId, values) {
  const { data, error } = await supabase
    .from('businesses')
    .update(values)
    .eq('id', businessId)
    .select(BUSINESS_FIELDS)
    .single()

  if (error) throw new Error(error.message || 'Không thể cập nhật thông tin doanh nghiệp.')
  return data
}

export async function getAppSettings(businessId) {
  const { data, error } = await supabase
    .from('app_settings')
    .select(APP_SETTINGS_FIELDS)
    .eq('business_id', businessId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Không tải được cài đặt vận hành.')
  return data
}

export async function updateAppSettings(businessId, values) {
  const { data, error } = await supabase
    .from('app_settings')
    .upsert({ business_id: businessId, ...values }, { onConflict: 'business_id' })
    .select(APP_SETTINGS_FIELDS)
    .single()
  if (error) throw new Error(error.message || 'Không thể lưu cài đặt vận hành.')
  return data
}

export async function listDocumentSequences(businessId) {
  const { data, error } = await supabase
    .from('document_sequences')
    .select(SEQUENCE_FIELDS)
    .eq('business_id', businessId)
    .order('entity', { ascending: true })
  if (error) throw new Error(error.message || 'Không tải được tiền tố chứng từ.')
  return data ?? []
}

export async function updateDocumentSequence(businessId, sequenceId, values) {
  const { data, error } = await supabase
    .from('document_sequences')
    .update(values)
    .eq('business_id', businessId)
    .eq('id', sequenceId)
    .select(SEQUENCE_FIELDS)
    .single()
  if (error) throw new Error(error.message || 'Không thể lưu tiền tố chứng từ.')
  return data
}
