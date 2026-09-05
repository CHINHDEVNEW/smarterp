import { supabase } from '../lib/supabase'

const ACCOUNT_FIELDS = 'id, business_id, code, name, account_type, opening_balance, balance, active'
const TRANSACTION_FIELDS = 'id, business_id, code, transaction_date, direction, category, account_id, amount, payment_method, reference_type, reference_id, note, status, created_by, created_at'

function throwIfError(error, fallback) {
  if (!error) return
  if (error.code === '23514') throw new Error('Thông tin thu/chi không hợp lệ.')
  throw new Error(error.message || fallback)
}

export async function listFinanceData(businessId) {
  const [accountsResult, transactionsResult] = await Promise.all([
    supabase.from('v_finance_account_balances').select(ACCOUNT_FIELDS).eq('business_id', businessId).eq('active', true).order('name', { ascending: true }),
    supabase.from('finance_transactions').select(TRANSACTION_FIELDS).eq('business_id', businessId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
  ])
  throwIfError(accountsResult.error, 'Không tải được tài khoản tiền.')
  throwIfError(transactionsResult.error, 'Không tải được sổ thu chi.')
  return { accounts: accountsResult.data ?? [], transactions: transactionsResult.data ?? [] }
}

export async function createFinanceTransaction(businessId, values) {
  const { data, error } = await supabase.rpc('app_create_finance_transaction', {
    p_business_id: businessId,
    p_transaction: values,
  })
  throwIfError(error, 'Không thể lưu giao dịch thu/chi.')
  return data
}

export async function listFinanceAccounts(businessId) {
  const { data, error } = await supabase
    .from('v_finance_account_balances')
    .select(ACCOUNT_FIELDS)
    .eq('business_id', businessId)
    .eq('active', true)
    .order('name', { ascending: true })
  throwIfError(error, 'Không tải được tài khoản tiền.')
  return data ?? []
}

export async function listAllFinanceAccounts(businessId) {
  const { data, error } = await supabase
    .from('v_finance_account_balances')
    .select(ACCOUNT_FIELDS)
    .eq('business_id', businessId)
    .order('active', { ascending: false })
    .order('name', { ascending: true })
  throwIfError(error, 'Không tải được danh sách tài khoản tiền.')
  return data ?? []
}

export async function createFinanceAccount(businessId, values) {
  const { data, error } = await supabase.rpc('app_create_finance_account', {
    p_business_id: businessId,
    p_account: values,
  })
  throwIfError(error, 'Không thể tạo tài khoản tiền.')
  return data
}

export async function updateFinanceAccount(businessId, accountId, values) {
  const { data, error } = await supabase.rpc('app_update_finance_account', {
    p_business_id: businessId,
    p_account_id: accountId,
    p_account: values,
  })
  throwIfError(error, 'Không thể cập nhật tài khoản tiền.')
  return data
}

export async function recordSalesPayment(businessId, values) {
  const { data, error } = await supabase.rpc('app_record_sales_payment', {
    p_business_id: businessId,
    p_sales_order_id: values.salesOrderId,
    p_amount: values.amount,
    p_account_id: values.accountId,
    p_payment_method: values.paymentMethod,
    p_note: values.note || null,
  })
  throwIfError(error, 'Không thể ghi nhận thanh toán.')
  return data
}

export function subscribeToFinance(businessId, onChange) {
  const channel = supabase
    .channel(`finance:${businessId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions', filter: `business_id=eq.${businessId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_accounts', filter: `business_id=eq.${businessId}` }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
