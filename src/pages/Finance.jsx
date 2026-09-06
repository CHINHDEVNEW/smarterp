/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  WalletCards,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import {
  createFinanceAccount,
  createFinanceTransaction,
  listAllFinanceAccounts,
  listFinanceData,
  subscribeToFinance,
  updateFinanceAccount,
} from '../services/financeService'
import { formatCurrency, formatDateTime, formatNumber, localDateKey } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
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

  const loadFinance = useCallback(
    async ({ quiet = false } = {}) => {
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
    },
    [businessId]
  )

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
      return [transaction.code, transaction.category, transaction.note, transaction.payment_method].some(
        (value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle)
      )
    })
  }, [transactions, search, direction])

  const accountBalances = useMemo(() => {
    return new Map(accounts.map((account) => [account.id, Number(account.balance) || 0]))
  }, [accounts])

  const stats = useMemo(
    () => ({
      income: transactions
        .filter((transaction) => transaction.status === 'posted' && transaction.direction === 'in')
        .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0),
      expense: transactions
        .filter((transaction) => transaction.status === 'posted' && transaction.direction === 'out')
        .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0),
      balance: [...accountBalances.values()].reduce((sum, value) => sum + value, 0),
    }),
    [transactions, accountBalances]
  )

  const transactionPages = usePagination(filteredTransactions, `${search}\u0000${direction}`)

  async function saveTransaction(values) {
    await createFinanceTransaction(businessId, values)
    setFormOpen(false)
    showToast(values.direction === 'in' ? 'Đã ghi nhận khoản thu.' : 'Đã ghi nhận khoản chi.')
    await loadFinance({ quiet: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sổ quỹ và tài khoản"
        title="Tài chính"
        description="Theo dõi các khoản thu, chi và số dư tài khoản tiền."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {canAccess(business?.role, 'settings') && (
              <button
                className="btn-secondary flex-1 sm:flex-initial"
                type="button"
                onClick={() => setAccountsOpen(true)}
              >
                <Settings2 size={18} />
                <span>Tài khoản tiền</span>
              </button>
            )}
            <button className="btn-primary flex-1 sm:flex-initial" type="button" onClick={() => setFormOpen(true)}>
              <Plus size={18} />
              <span>Ghi nhận thu chi</span>
            </button>
          </div>
        }
      />

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={CircleDollarSign}
          label="Tổng số dư quỹ"
          value={formatCurrency(stats.balance)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={ArrowDownLeft}
          label="Tổng khoản thu"
          value={formatCurrency(stats.income)}
          tone="emerald"
          size="sm"
        />
        <MetricCard
          icon={ArrowUpRight}
          label="Tổng khoản chi"
          value={formatCurrency(stats.expense)}
          tone="rose"
          size="sm"
        />
        <MetricCard
          icon={Landmark}
          label="Tài khoản tiền"
          value={formatNumber(accounts.length)}
          tone="indigo"
          size="sm"
        />
      </section>

      {/* Accounts mini row */}
      {accounts.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
          {accounts.map((account) => (
            <article
              className="surface relative overflow-hidden flex items-center gap-3.5 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
              key={account.id}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-400 to-slate-200" />
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 shadow-xs">
                <WalletCards size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-400">
                  {account.name}
                </p>
                <p className="tabular-nums mt-1 truncate text-lg font-black text-slate-900">
                  {formatCurrency(accountBalances.get(account.id) || 0)}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Transactions Section */}
      <section className="surface overflow-hidden">
        <FilterBar
          searchPlaceholder="Tìm mã, khoản mục hoặc ghi chú..."
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => loadFinance()}
          refreshing={loading}
        >
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            <button
              type="button"
              onClick={() => setDirection('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                direction === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setDirection('in')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                direction === 'in'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Khoản thu
            </button>
            <button
              type="button"
              onClick={() => setDirection('out')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                direction === 'out'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-500 hover:text-rose-700'
              }`}
            >
              Khoản chi
            </button>
          </div>
        </FilterBar>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <Landmark className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button
              className="btn-secondary mt-5"
              type="button"
              onClick={() => loadFinance()}
            >
              <RefreshCw size={17} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : loading ? (
          <div className="p-5">
            <Loading rows={6} />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Landmark}
            title={transactions.length ? 'Không tìm thấy giao dịch' : 'Chưa có giao dịch thu chi'}
            description={
              transactions.length
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : 'Ghi nhận khoản thu hoặc chi đầu tiên để bắt đầu theo dõi.'
            }
            action={
              !transactions.length && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => setFormOpen(true)}
                >
                  <Plus size={17} />
                  <span>Ghi nhận thu chi</span>
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Giao dịch</th>
                    <th className="px-4 py-3.5">Ngày</th>
                    <th className="px-4 py-3.5">Tài khoản</th>
                    <th className="px-4 py-3.5">Khoản mục</th>
                    <th className="px-4 py-3.5 text-right">Số tiền</th>
                    <th className="px-5 py-3.5">Phương thức</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactionPages.pageItems.map((transaction) => (
                    <FinanceRow
                      key={transaction.id}
                      transaction={transaction}
                      account={accounts.find((account) => account.id === transaction.account_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {transactionPages.pageItems.map((transaction) => (
                <FinanceCard
                  key={transaction.id}
                  transaction={transaction}
                  account={accounts.find((account) => account.id === transaction.account_id)}
                />
              ))}
            </div>
            <Pagination
              page={transactionPages.page}
              pageCount={transactionPages.pageCount}
              pageSize={transactionPages.pageSize}
              total={filteredTransactions.length}
              onChange={transactionPages.setPage}
            />
          </>
        )}
      </section>

      {/* Forms and Modals */}
      <FinanceForm
        open={formOpen}
        accounts={accounts}
        onClose={() => setFormOpen(false)}
        onSave={saveTransaction}
      />
      <FinanceAccountsModal
        open={accountsOpen}
        businessId={businessId}
        onClose={() => setAccountsOpen(false)}
        onChanged={() => loadFinance({ quiet: true })}
      />
    </div>
  )
}

function FinanceRow({ transaction, account }) {
  const incoming = transaction.direction === 'in'
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl ${
              incoming ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
            }`}
          >
            {incoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">
              {transaction.code || directionLabels[transaction.direction]}
            </p>
            <div className="mt-0.5">
              <StatusBadge
                status={transaction.direction}
                label={directionLabels[transaction.direction]}
                size="sm"
              />
            </div>
          </div>
        </div>
      </td>
      <td className="tabular-nums px-4 py-4 text-sm text-slate-600">
        {formatDateTime(transaction.transaction_date)}
      </td>
      <td className="px-4 py-4 text-sm font-medium text-slate-700">
        {account?.name || '—'}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
        {transaction.category || 'Khác'}
      </td>
      <td
        className={`tabular-nums px-4 py-4 text-right text-sm font-extrabold ${
          incoming ? 'text-emerald-600' : 'text-rose-600'
        }`}
      >
        {incoming ? '+' : '−'} {formatCurrency(transaction.amount)}
      </td>
      <td className="px-5 py-4 text-sm text-slate-500">
        {paymentLabels[transaction.payment_method] || transaction.payment_method || '—'}
      </td>
    </tr>
  )
}

function FinanceCard({ transaction, account }) {
  const incoming = transaction.direction === 'in'
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            incoming ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
          }`}
        >
          {incoming ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {transaction.code || directionLabels[transaction.direction]}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                <span className="tabular-nums">{formatDateTime(transaction.transaction_date)}</span> ·{' '}
                {account?.name || '—'}
              </p>
            </div>
            <p
              className={`tabular-nums text-sm font-extrabold ${
                incoming ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {incoming ? '+' : '−'} {formatCurrency(transaction.amount)}
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {transaction.category || 'Khác'}
            </span>
            <span className="text-xs text-slate-400">
              {paymentLabels[transaction.payment_method] || transaction.payment_method || '—'}
            </span>
          </div>
          {transaction.note && (
            <p className="mt-2 truncate text-xs text-slate-400">{transaction.note}</p>
          )}
        </div>
      </div>
    </article>
  )
}

function FinanceForm({ open, accounts, onClose, onSave }) {
  const [values, setValues] = useState({
    direction: 'in',
    transaction_date: localDateKey(),
    account_id: '',
    category: 'Bán hàng',
    amount: '',
    payment_method: 'cash',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setValues((current) => ({
        ...current,
        transaction_date: localDateKey(),
        account_id: current.account_id || accounts[0]?.id || '',
      }))
      setError('')
    }
  }, [open, accounts])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    const amount = Number(values.amount) || 0
    if (!values.account_id) return setError('Vui lòng chọn tài khoản tiền.')
    if (amount <= 0) return setError('Số tiền phải lớn hơn 0.')
    if (!values.category.trim()) return setError('Vui lòng nhập khoản mục.')

    setSaving(true)
    setError('')
    try {
      await onSave({
        direction: values.direction,
        transaction_date: values.transaction_date,
        account_id: values.account_id,
        category: values.category.trim(),
        amount,
        payment_method: values.payment_method,
        reference_type: 'manual',
        note: values.note.trim() || null,
        status: 'posted',
      })
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu giao dịch.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={values.direction === 'in' ? 'Ghi nhận phiếu thu' : 'Ghi nhận phiếu chi'}
      description="Lưu một giao dịch vào sổ quỹ của doanh nghiệp."
      icon={Landmark}
      tone={values.direction === 'in' ? 'emerald' : 'rose'}
      badge={values.direction === 'in' ? 'Phiếu thu' : 'Phiếu chi'}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            className="btn-primary w-full sm:w-auto"
            type="submit"
            form="finance-form"
            disabled={saving}
          >
            <Plus size={17} />
            <span>{saving ? 'Đang lưu...' : 'Lưu giao dịch'}</span>
          </button>
        </div>
      }
    >
      <form id="finance-form" className="space-y-4" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
          <button
            className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              values.direction === 'in'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            type="button"
            onClick={() => update('direction', 'in')}
          >
            <span className="flex items-center justify-center gap-2">
              <ArrowDownLeft size={17} /> Khoản thu
            </span>
          </button>
          <button
            className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              values.direction === 'out'
                ? 'bg-white text-rose-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            type="button"
            onClick={() => update('direction', 'out')}
          >
            <span className="flex items-center justify-center gap-2">
              <ArrowUpRight size={17} /> Khoản chi
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Ngày giao dịch
            </span>
            <input
              className="field"
              type="date"
              value={values.transaction_date}
              onChange={(event) => update('transaction_date', event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Tài khoản tiền
            </span>
            <select
              className="field"
              value={values.account_id}
              onChange={(event) => update('account_id', event.target.value)}
              required
            >
              <option value="">Chọn tài khoản</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Khoản mục
            </span>
            <input
              className="field"
              value={values.category}
              onChange={(event) => update('category', event.target.value)}
              placeholder={values.direction === 'in' ? 'Bán hàng, thu khác...' : 'Nhập hàng, vận chuyển...'}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Phương thức
            </span>
            <select
              className="field"
              value={values.payment_method}
              onChange={(event) => update('payment_method', event.target.value)}
            >
              <option value="cash">Tiền mặt</option>
              <option value="bank">Chuyển khoản</option>
              <option value="card">Thẻ</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Số tiền
            </span>
            <input
              className="field tabular-nums text-right text-lg font-bold"
              type="number"
              min="0.01"
              step="1"
              value={values.amount}
              onChange={(event) => update('amount', event.target.value)}
              placeholder="0"
              required
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Ghi chú
            </span>
            <textarea
              className="field min-h-24 resize-y"
              value={values.note}
              onChange={(event) => update('note', event.target.value)}
              placeholder="Nội dung giao dịch"
            />
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}

const accountTypeLabels = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  e_wallet: 'Ví điện tử',
  other: 'Khác',
}

function FinanceAccountsModal({ open, businessId, onClose, onChanged }) {
  const [accounts, setAccounts] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState({
    code: '',
    name: '',
    account_type: 'cash',
    opening_balance: '0',
    active: true,
  })

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

  useEffect(() => {
    if (open) {
      loadAccounts()
      setEditing(null)
      setValues({
        code: '',
        name: '',
        account_type: 'cash',
        opening_balance: '0',
        active: true,
      })
    }
  }, [open, loadAccounts])

  function startEdit(account) {
    setEditing(account)
    setValues({
      code: account.code || '',
      name: account.name || '',
      account_type: account.account_type || 'cash',
      opening_balance: String(account.opening_balance ?? 0),
      active: account.active !== false,
    })
    setError('')
  }

  function resetForm() {
    setEditing(null)
    setValues({
      code: '',
      name: '',
      account_type: 'cash',
      opening_balance: '0',
      active: true,
    })
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    const code = values.code.trim().toUpperCase()
    const name = values.name.trim()
    const openingBalance = Number(values.opening_balance) || 0
    if (!code || !name) return setError('Vui lòng nhập mã và tên tài khoản.')
    if (!editing && openingBalance < 0) return setError('Số dư đầu kỳ không được âm.')
    if (editing && !values.active && Math.abs(Number(editing.balance) || 0) > 0.0001) {
      return setError('Chỉ có thể ngừng dùng tài khoản khi số dư bằng 0.')
    }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateFinanceAccount(businessId, editing.id, {
          code,
          name,
          account_type: values.account_type,
          active: values.active,
        })
      } else {
        await createFinanceAccount(businessId, {
          code,
          name,
          account_type: values.account_type,
          opening_balance: openingBalance,
          active: true,
        })
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

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Quản lý tài khoản tiền"
      description="Tiền mặt, ngân hàng và ví điện tử dùng cho thu chi."
      size="lg"
      icon={WalletCards}
      tone="sky"
      badge="Sổ tài khoản tiền"
      footer={
        <button
          className="btn-secondary w-full sm:w-auto"
          type="button"
          onClick={onClose}
          disabled={saving}
        >
          Đóng
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh sách tài khoản
            </p>
          </div>
          {loading ? (
            <div className="p-4">
              <Loading rows={3} />
            </div>
          ) : accounts.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">Chưa có tài khoản tiền.</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {accounts.map((account) => (
                <button
                  className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-slate-50/80"
                  type="button"
                  key={account.id}
                  onClick={() => startEdit(account)}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      account.active ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-100' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <WalletCards size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{account.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {account.code} · {accountTypeLabels[account.account_type] || account.account_type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-sm font-extrabold text-slate-900">
                      {formatCurrency(account.balance)}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] font-bold ${
                        account.active ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {account.active ? 'Đang dùng' : 'Ngừng dùng'}
                    </p>
                  </div>
                  <Pencil className="shrink-0 text-slate-300" size={15} />
                </button>
              ))}
            </div>
          )}
        </section>

        <form className="space-y-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-4" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {editing
                  ? 'Số dư đầu kỳ được khóa để bảo toàn sổ quỹ.'
                  : 'Dùng mã ngắn, ví dụ BANK hoặc MOMO.'}
              </p>
            </div>
            {editing && (
              <button
                className="text-xs font-bold text-sky-600 hover:text-sky-700"
                type="button"
                onClick={resetForm}
              >
                Thêm mới
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Mã tài khoản
            </span>
            <input
              className="field uppercase font-semibold"
              maxLength={20}
              value={values.code}
              onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
              placeholder="BANK"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Tên tài khoản
            </span>
            <input
              className="field"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ngân hàng"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Loại tài khoản
            </span>
            <select
              className="field"
              value={values.account_type}
              onChange={(event) =>
                setValues((current) => ({ ...current, account_type: event.target.value }))
              }
            >
              <option value="cash">Tiền mặt</option>
              <option value="bank">Ngân hàng</option>
              <option value="e_wallet">Ví điện tử</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Số dư đầu kỳ
            </span>
            <input
              className="field tabular-nums text-right font-bold"
              type="number"
              min="0"
              step="1"
              value={values.opening_balance}
              disabled={Boolean(editing)}
              onChange={(event) =>
                setValues((current) => ({ ...current, opening_balance: event.target.value }))
              }
            />
          </label>

          {editing && (
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer">
              <input
                type="checkbox"
                className="size-4 rounded text-sky-600 focus:ring-sky-500"
                checked={values.active}
                onChange={(event) =>
                  setValues((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span className="text-sm font-semibold text-slate-700">Cho phép tiếp tục sử dụng</span>
            </label>
          )}

          {error && (
            <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>
          )}

          <button
            className="btn-primary w-full justify-center"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm tài khoản'}
          </button>
        </form>
      </div>
    </Modal>
  )
}
