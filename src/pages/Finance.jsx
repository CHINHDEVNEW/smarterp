/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Landmark, Pencil, Plus, RefreshCw, Search, Settings2, WalletCards } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { createFinanceAccount, createFinanceTransaction, listAllFinanceAccounts, listFinanceData, subscribeToFinance, updateFinanceAccount } from '../services/financeService'
import { formatCurrency, formatDateTime, localDateKey } from '../lib/formatters'
import Modal from '../components/common/Modal'
import Loading from '../components/common/Loading'
import EmptyState from '../components/common/EmptyState'
import { canAccess } from '../lib/permissions'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const directionLabels = { in: 'Thu tiền', out: 'Chi tiền' }
const paymentLabels = { cash: 'Tiền mặt', bank: 'Chuyển khoản', card: 'Thẻ', other: 'Khác' }

export default function Finance() {
  const { businessId, business } = useBusiness()
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)

  const loadFinance = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      const data = await listFinanceData(businessId)
      setAccounts(data.accounts)
      setTransactions(data.transactions)
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được sổ thu chi. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadFinance()
  }, [loadFinance])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToFinance(businessId, () => loadFinance({ quiet: true }))
  }, [businessId, loadFinance])

  const filteredTransactions = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return transactions.filter((transaction) => {
      if (direction !== 'all' && transaction.direction !== direction) return false
      if (!needle) return true
      return [transaction.code, transaction.category, transaction.note, transaction.payment_method]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [transactions, search, direction])

  const accountBalances = useMemo(() => {
    return new Map(accounts.map((account) => [account.id, Number(account.balance) || 0]))
  }, [accounts])

  const stats = useMemo(() => ({
    income: transactions.filter((transaction) => transaction.status === 'posted' && transaction.direction === 'in').reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0),
    expense: transactions.filter((transaction) => transaction.status === 'posted' && transaction.direction === 'out').reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0),
    balance: [...accountBalances.values()].reduce((sum, value) => sum + value, 0),
  }), [transactions, accountBalances])

  const transactionPages = usePagination(filteredTransactions, `${search}\u0000${direction}`)

  async function saveTransaction(values) {
    await createFinanceTransaction(businessId, values)
    setFormOpen(false)
    showToast(values.direction === 'in' ? 'Đã ghi nhận khoản thu.' : 'Đã ghi nhận khoản chi.')
    await loadFinance({ quiet: true })
  }

  return (
    <div>
      <div className="page-heading"><div><p className="page-eyebrow">Sổ quỹ và tài khoản</p><h1 className="page-title">Tài chính</h1><p className="page-description">Theo dõi các khoản thu, chi và số dư tài khoản tiền.</p></div><div className="flex flex-wrap gap-2">{canAccess(business?.role, 'settings') && <button className="btn-secondary" type="button" onClick={() => setAccountsOpen(true)}><Settings2 size={18} /> Tài khoản tiền</button>}<button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={18} /> Ghi nhận thu chi</button></div></div>
      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><MiniMetric icon={CircleDollarSign} label="Tổng số dư" value={formatCurrency(stats.balance)} tone="sky" /><MiniMetric icon={ArrowDownLeft} label="Tổng khoản thu" value={formatCurrency(stats.income)} tone="emerald" /><MiniMetric icon={ArrowUpRight} label="Tổng khoản chi" value={formatCurrency(stats.expense)} tone="rose" /><MiniMetric icon={Landmark} label="Tài khoản tiền" value={accounts.length} tone="indigo" /></section>

      {accounts.length > 0 && <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{accounts.map((account) => <article className="surface flex items-center gap-3 p-4" key={account.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><WalletCards size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-500">{account.name}</p><p className="mt-1 truncate text-sm font-extrabold text-slate-900">{formatCurrency(accountBalances.get(account.id) || 0)}</p></div></article>)}</section>}

      <section className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, khoản mục hoặc ghi chú..." /></div><div className="flex items-center gap-2"><select className="field min-w-0 flex-1 sm:w-44" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="all">Tất cả giao dịch</option><option value="in">Khoản thu</option><option value="out">Khoản chi</option></select><button className="btn-icon" type="button" onClick={() => loadFinance()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button></div></div>
        {error ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><Landmark className="text-rose-500" size={34} /><p className="mt-4 text-sm font-semibold text-slate-700">{error}</p><button className="btn-secondary mt-5" type="button" onClick={() => loadFinance()}><RefreshCw size={17} /> Thử lại</button></div> : loading ? <div className="p-5"><Loading rows={6} /></div> : filteredTransactions.length === 0 ? <EmptyState icon={Landmark} title={transactions.length ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch thu chi'} description={transactions.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Ghi nhận khoản thu hoặc chi đầu tiên để bắt đầu theo dõi.'} action={!transactions.length && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={17} /> Ghi nhận thu chi</button>} /> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[850px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Giao dịch</th><th className="px-4 py-3.5">Ngày</th><th className="px-4 py-3.5">Tài khoản</th><th className="px-4 py-3.5">Khoản mục</th><th className="px-4 py-3.5 text-right">Số tiền</th><th className="px-5 py-3.5">Phương thức</th></tr></thead><tbody className="divide-y divide-slate-100">{transactionPages.pageItems.map((transaction) => <FinanceRow key={transaction.id} transaction={transaction} account={accounts.find((account) => account.id === transaction.account_id)} />)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{transactionPages.pageItems.map((transaction) => <FinanceCard key={transaction.id} transaction={transaction} account={accounts.find((account) => account.id === transaction.account_id)} />)}</div><Pagination page={transactionPages.page} pageCount={transactionPages.pageCount} pageSize={transactionPages.pageSize} total={filteredTransactions.length} onChange={transactionPages.setPage} /></>}
      </section>
      <FinanceForm open={formOpen} accounts={accounts} onClose={() => setFormOpen(false)} onSave={saveTransaction} />
      <FinanceAccountsModal open={accountsOpen} businessId={businessId} onClose={() => setAccountsOpen(false)} onChanged={() => loadFinance({ quiet: true })} />
    </div>
  )
}

const metricTones = { sky: 'bg-sky-50 text-sky-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600', indigo: 'bg-indigo-50 text-indigo-600' }
function MiniMetric({ icon: Icon, label, value, tone }) { return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">{value}</p></div></article> }
function FinanceRow({ transaction, account }) { const incoming = transaction.direction === 'in'; return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl ${incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div><p className="text-sm font-bold text-slate-800">{transaction.code || directionLabels[transaction.direction]}</p><p className="mt-1 text-xs text-slate-400">{directionLabels[transaction.direction]}</p></div></div></td><td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(transaction.transaction_date)}</td><td className="px-4 py-4 text-sm text-slate-600">{account?.name || '—'}</td><td className="px-4 py-4 text-sm font-semibold text-slate-700">{transaction.category || 'Khác'}</td><td className={`px-4 py-4 text-right text-sm font-extrabold ${incoming ? 'text-emerald-600' : 'text-rose-600'}`}>{incoming ? '+' : '−'} {formatCurrency(transaction.amount)}</td><td className="px-5 py-4 text-sm text-slate-500">{paymentLabels[transaction.payment_method] || transaction.payment_method || '—'}</td></tr> }
function FinanceCard({ transaction, account }) { const incoming = transaction.direction === 'in'; return <article className="p-4"><div className="flex items-start gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${incoming ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{incoming ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{transaction.code || directionLabels[transaction.direction]}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(transaction.transaction_date)} · {account?.name || '—'}</p></div><p className={`text-sm font-extrabold ${incoming ? 'text-emerald-600' : 'text-rose-600'}`}>{incoming ? '+' : '−'} {formatCurrency(transaction.amount)}</p></div><p className="mt-3 text-xs font-semibold text-slate-600">{transaction.category || 'Khác'} · {paymentLabels[transaction.payment_method] || transaction.payment_method || '—'}</p>{transaction.note && <p className="mt-1 truncate text-xs text-slate-400">{transaction.note}</p>}</div></div></article> }

function FinanceForm({ open, accounts, onClose, onSave }) {
  const [values, setValues] = useState({ direction: 'in', transaction_date: localDateKey(), account_id: '', category: 'Bán hàng', amount: '', payment_method: 'cash', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setValues((current) => ({ ...current, transaction_date: localDateKey(), account_id: current.account_id || accounts[0]?.id || '' })); setError('') } }, [open, accounts])
  function update(field, value) { setValues((current) => ({ ...current, [field]: value })) }
  async function submit(event) { event.preventDefault(); const amount = Number(values.amount) || 0; if (!values.account_id) return setError('Vui lòng chọn tài khoản tiền.'); if (amount <= 0) return setError('Số tiền phải lớn hơn 0.'); if (!values.category.trim()) return setError('Vui lòng nhập khoản mục.'); setSaving(true); setError(''); try { await onSave({ direction: values.direction, transaction_date: values.transaction_date, account_id: values.account_id, category: values.category.trim(), amount, payment_method: values.payment_method, reference_type: 'manual', note: values.note.trim() || null, status: 'posted' }) } catch (saveError) { setError(saveError.message || 'Không thể lưu giao dịch.') } finally { setSaving(false) } }
  return <Modal open={open} onClose={saving ? () => {} : onClose} title="Ghi nhận thu chi" description="Lưu một giao dịch vào sổ quỹ của doanh nghiệp." footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="finance-form" disabled={saving}><Plus size={17} /> {saving ? 'Đang lưu...' : 'Lưu giao dịch'}</button></>}><form id="finance-form" className="space-y-5" onSubmit={submit}><div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5"><button className={`rounded-xl px-3 py-3 text-sm font-bold ${values.direction === 'in' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`} type="button" onClick={() => update('direction', 'in')}><span className="flex items-center justify-center gap-2"><ArrowDownLeft size={17} /> Khoản thu</span></button><button className={`rounded-xl px-3 py-3 text-sm font-bold ${values.direction === 'out' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'}`} type="button" onClick={() => update('direction', 'out')}><span className="flex items-center justify-center gap-2"><ArrowUpRight size={17} /> Khoản chi</span></button></div><div className="form-grid"><Field label="Ngày giao dịch"><input className="field" type="date" value={values.transaction_date} onChange={(event) => update('transaction_date', event.target.value)} required /></Field><Field label="Tài khoản tiền"><select className="field" value={values.account_id} onChange={(event) => update('account_id', event.target.value)} required><option value="">Chọn tài khoản</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Khoản mục"><input className="field" value={values.category} onChange={(event) => update('category', event.target.value)} placeholder={values.direction === 'in' ? 'Bán hàng, thu khác...' : 'Nhập hàng, vận chuyển...'} /></Field><Field label="Phương thức"><select className="field" value={values.payment_method} onChange={(event) => update('payment_method', event.target.value)}><option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="card">Thẻ</option><option value="other">Khác</option></select></Field><Field label="Số tiền" className="sm:col-span-2"><input className="field text-right text-lg font-bold" type="number" min="0.01" step="1" value={values.amount} onChange={(event) => update('amount', event.target.value)} placeholder="0" required /></Field><Field label="Ghi chú" className="sm:col-span-2"><textarea className="field min-h-24 resize-y" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Nội dung giao dịch" /></Field></div>{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}</form></Modal>
}
function Field({ label, className = '', children }) { return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label> }

const accountTypeLabels = { cash: 'Tiền mặt', bank: 'Ngân hàng', e_wallet: 'Ví điện tử', other: 'Khác' }

function FinanceAccountsModal({ open, businessId, onClose, onChanged }) {
  const [accounts, setAccounts] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState({ code: '', name: '', account_type: 'cash', opening_balance: '0', active: true })

  const loadAccounts = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError('')
    try {
      setAccounts(await listAllFinanceAccounts(businessId))
    } catch (loadError) {
      setError(loadError.message || 'Không tải được tài khoản tiền.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { if (open) { loadAccounts(); setEditing(null); setValues({ code: '', name: '', account_type: 'cash', opening_balance: '0', active: true }) } }, [open, loadAccounts])

  function startEdit(account) {
    setEditing(account)
    setValues({ code: account.code || '', name: account.name || '', account_type: account.account_type || 'cash', opening_balance: String(account.opening_balance ?? 0), active: account.active !== false })
    setError('')
  }

  function resetForm() {
    setEditing(null)
    setValues({ code: '', name: '', account_type: 'cash', opening_balance: '0', active: true })
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    const code = values.code.trim().toUpperCase()
    const name = values.name.trim()
    const openingBalance = Number(values.opening_balance) || 0
    if (!code || !name) return setError('Vui lòng nhập mã và tên tài khoản.')
    if (!editing && openingBalance < 0) return setError('Số dư đầu kỳ không được âm.')
    if (editing && !values.active && Math.abs(Number(editing.balance) || 0) > 0.0001) return setError('Chỉ có thể ngừng dùng tài khoản khi số dư bằng 0.')
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateFinanceAccount(businessId, editing.id, { code, name, account_type: values.account_type, active: values.active })
      } else {
        await createFinanceAccount(businessId, { code, name, account_type: values.account_type, opening_balance: openingBalance, active: true })
      }
      await loadAccounts()
      await onChanged()
      resetForm()
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu tài khoản tiền.')
    } finally {
      setSaving(false)
    }
  }

  return <Modal open={open} onClose={saving ? () => {} : onClose} title="Quản lý tài khoản tiền" description="Tiền mặt, ngân hàng và ví điện tử dùng cho thu chi." size="lg" footer={<button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Đóng</button>}><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="overflow-hidden rounded-2xl border border-slate-200"><div className="border-b border-slate-100 px-4 py-3"><p className="text-sm font-bold text-slate-800">Danh sách tài khoản</p></div>{loading ? <div className="p-4"><Loading rows={3} /></div> : accounts.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">Chưa có tài khoản tiền.</p> : <div className="divide-y divide-slate-100">{accounts.map((account) => <button className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50" type="button" key={account.id} onClick={() => startEdit(account)}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${account.active ? 'bg-sky-50 text-sky-600' : 'bg-slate-100 text-slate-400'}`}><WalletCards size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{account.name}</p><p className="mt-1 text-xs text-slate-400">{account.code} · {accountTypeLabels[account.account_type] || account.account_type}</p></div><div className="text-right"><p className="text-sm font-extrabold text-slate-900">{formatCurrency(account.balance)}</p><p className={`mt-1 text-[10px] font-bold ${account.active ? 'text-emerald-600' : 'text-slate-400'}`}>{account.active ? 'Đang dùng' : 'Ngừng dùng'}</p></div><Pencil className="shrink-0 text-slate-300" size={15} /></button>)}</div>}</section><form className="space-y-4 rounded-2xl bg-slate-50 p-4" onSubmit={submit}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-extrabold text-slate-800">{editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}</p><p className="mt-1 text-xs text-slate-400">{editing ? 'Số dư đầu kỳ được khóa để bảo toàn sổ quỹ.' : 'Dùng mã ngắn, ví dụ BANK hoặc MOMO.'}</p></div>{editing && <button className="text-xs font-bold text-sky-600" type="button" onClick={resetForm}>Thêm mới</button>}</div><Field label="Mã tài khoản"><input className="field uppercase" maxLength={20} value={values.code} onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))} placeholder="BANK" required /></Field><Field label="Tên tài khoản"><input className="field" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} placeholder="Ngân hàng" required /></Field><Field label="Loại tài khoản"><select className="field" value={values.account_type} onChange={(event) => setValues((current) => ({ ...current, account_type: event.target.value }))}><option value="cash">Tiền mặt</option><option value="bank">Ngân hàng</option><option value="e_wallet">Ví điện tử</option><option value="other">Khác</option></select></Field><Field label="Số dư đầu kỳ"><input className="field text-right font-bold" type="number" min="0" step="1" value={values.opening_balance} disabled={Boolean(editing)} onChange={(event) => setValues((current) => ({ ...current, opening_balance: event.target.value }))} /></Field>{editing && <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><input type="checkbox" checked={values.active} onChange={(event) => setValues((current) => ({ ...current, active: event.target.checked }))} /><span className="text-sm font-semibold text-slate-700">Cho phép tiếp tục sử dụng</span></label>}{error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}<button className="btn-primary w-full justify-center" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm tài khoản'}</button></form></div></Modal>
}
