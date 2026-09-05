/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, CircleDollarSign, Edit3, Mail, Phone, Plus, RefreshCw, Search, SlidersHorizontal, UserRound, Users, WalletCards } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { createCustomer, listCustomersWithSummary, setCustomerActive, subscribeToCustomers, updateCustomer } from '../services/customerService'
import { formatCurrency, formatNumber } from '../lib/formatters'
import CustomerForm from '../components/customers/CustomerForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

function statusBadge(customer) {
  if (!customer.active) return { label: 'Ngừng giao dịch', className: 'bg-slate-100 text-slate-600' }
  if (Number(customer.receivable) > Number(customer.credit_limit) && Number(customer.credit_limit) > 0) {
    return { label: 'Vượt hạn mức', className: 'bg-rose-50 text-rose-700' }
  }
  if (Number(customer.receivable) > 0) return { label: 'Đang có nợ', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Đang giao dịch', className: 'bg-emerald-50 text-emerald-700' }
}

export default function Customers() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [deactivatingCustomer, setDeactivatingCustomer] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  const loadCustomers = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      setCustomers(await listCustomersWithSummary(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được danh sách khách hàng. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToCustomers(businessId, () => loadCustomers({ quiet: true }))
  }, [businessId, loadCustomers])

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return customers.filter((customer) => {
      if (status === 'active' && !customer.active) return false
      if (status === 'inactive' && customer.active) return false
      if (status === 'debt' && Number(customer.receivable) <= 0) return false
      if (!needle) return true
      return [customer.name, customer.code, customer.phone, customer.email, customer.address, customer.customer_group]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [customers, search, status])

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter((customer) => customer.active).length,
    debtCustomers: customers.filter((customer) => Number(customer.receivable) > 0).length,
    receivable: customers.reduce((sum, customer) => sum + (Number(customer.receivable) || 0), 0),
  }), [customers])

  const customerPages = usePagination(filteredCustomers, `${search}\u0000${status}`)

  function openCreate() {
    setEditingCustomer(null)
    setFormOpen(true)
  }

  function openEdit(customer) {
    setEditingCustomer(customer)
    setFormOpen(true)
  }

  async function saveCustomer(values) {
    if (editingCustomer) {
      await updateCustomer(businessId, editingCustomer.id, values)
      showToast('Đã cập nhật khách hàng.')
    } else {
      await createCustomer(businessId, values)
      showToast('Đã thêm khách hàng mới.')
    }
    setFormOpen(false)
    setEditingCustomer(null)
    await loadCustomers({ quiet: true })
  }

  async function confirmDeactivate() {
    if (!deactivatingCustomer) return
    setDeactivating(true)
    try {
      await setCustomerActive(businessId, deactivatingCustomer.id, false)
      showToast('Đã ngừng giao dịch với khách hàng.')
      setDeactivatingCustomer(null)
      await loadCustomers({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật khách hàng.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  async function reactivate(customer) {
    try {
      await setCustomerActive(businessId, customer.id, true)
      showToast('Đã kích hoạt lại khách hàng.')
      await loadCustomers({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật khách hàng.', 'error')
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Bán hàng và công nợ</p>
          <h1 className="page-title">Khách hàng</h1>
          <p className="page-description">Quản lý hồ sơ, doanh số và các khoản phải thu theo từng khách hàng.</p>
        </div>
        <button className="btn-primary" type="button" onClick={openCreate}><Plus size={18} /> Thêm khách hàng</button>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniMetric icon={Users} label="Tổng khách hàng" value={formatNumber(stats.total)} tone="sky" />
        <MiniMetric icon={UserRound} label="Đang giao dịch" value={formatNumber(stats.active)} tone="emerald" />
        <MiniMetric icon={WalletCards} label="Khách đang nợ" value={formatNumber(stats.debtCustomers)} tone="amber" />
        <MiniMetric icon={CircleDollarSign} label="Tổng phải thu" value={formatCurrency(stats.receivable)} tone="rose" />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã, số điện thoại hoặc email..." />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} />
            <select className="field min-w-0 flex-1 sm:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Tất cả khách hàng</option>
              <option value="active">Đang giao dịch</option>
              <option value="debt">Đang có công nợ</option>
              <option value="inactive">Ngừng giao dịch</option>
            </select>
            <button className="btn-icon" type="button" onClick={() => loadCustomers()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button>
          </div>
        </div>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <Users className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button className="btn-secondary mt-5" type="button" onClick={() => loadCustomers()}><RefreshCw size={17} /> Thử lại</button>
          </div>
        ) : loading ? (
          <div className="p-5"><Loading rows={6} /></div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState icon={Users} title={customers.length ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'} description={customers.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Thêm khách hàng đầu tiên để bắt đầu theo dõi giao dịch.'} action={!customers.length && <button className="btn-primary" type="button" onClick={openCreate}><Plus size={17} /> Thêm khách hàng</button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3.5">Khách hàng</th><th className="px-4 py-3.5">Liên hệ</th><th className="px-4 py-3.5">Nhóm</th><th className="px-4 py-3.5 text-right">Tổng mua</th><th className="px-4 py-3.5 text-right">Còn nợ</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {customerPages.pageItems.map((customer) => <CustomerRow key={customer.id} customer={customer} onEdit={() => openEdit(customer)} onDeactivate={() => setDeactivatingCustomer(customer)} onReactivate={() => reactivate(customer)} />)}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {customerPages.pageItems.map((customer) => <CustomerCard key={customer.id} customer={customer} onEdit={() => openEdit(customer)} onDeactivate={() => setDeactivatingCustomer(customer)} onReactivate={() => reactivate(customer)} />)}
            </div>
            <Pagination page={customerPages.page} pageCount={customerPages.pageCount} pageSize={customerPages.pageSize} total={filteredCustomers.length} onChange={customerPages.setPage} />
          </>
        )}
      </section>

      <CustomerForm open={formOpen} customer={editingCustomer} onClose={() => setFormOpen(false)} onSave={saveCustomer} />
      <ConfirmDialog open={Boolean(deactivatingCustomer)} onClose={() => setDeactivatingCustomer(null)} onConfirm={confirmDeactivate} loading={deactivating} title="Ngừng giao dịch với khách hàng?" description={deactivatingCustomer ? `“${deactivatingCustomer.name}” sẽ không còn xuất hiện khi lập chứng từ mới.` : ''} confirmLabel="Ngừng giao dịch" message="Hồ sơ và lịch sử giao dịch vẫn được giữ nguyên. Bạn có thể kích hoạt lại khách hàng bất cứ lúc nào." />
    </div>
  )
}

const metricTones = {
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
}

function MiniMetric({ icon: Icon, label, value, tone }) {
  return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-extrabold text-slate-900">{value}</p></div></article>
}

function CustomerRow({ customer, onEdit, onDeactivate, onReactivate }) {
  const state = statusBadge(customer)
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-50 to-emerald-50 font-extrabold text-sky-700">{customer.name.slice(0, 1).toLocaleUpperCase('vi')}</span><div className="min-w-0"><p className="max-w-56 truncate text-sm font-bold text-slate-800">{customer.name}</p><p className="mt-1 text-xs text-slate-400">{customer.code || 'Chưa có mã'} · {formatNumber(customer.orderCount)} đơn</p></div></div></td>
      <td className="px-4 py-4"><p className="text-sm font-semibold text-slate-700">{customer.phone || '—'}</p><p className="mt-1 max-w-48 truncate text-xs text-slate-400">{customer.email || customer.address || 'Chưa có thông tin'}</p></td>
      <td className="px-4 py-4 text-sm text-slate-600">{customer.customer_group || 'Khách lẻ'}</td>
      <td className="px-4 py-4 text-right text-sm font-bold text-slate-800">{formatCurrency(customer.totalSales)}</td>
      <td className={`px-4 py-4 text-right text-sm font-extrabold ${Number(customer.receivable) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{formatCurrency(customer.receivable)}</td>
      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}>{state.label}</span></td>
      <td className="px-5 py-4"><div className="flex justify-end gap-1"><button className="btn-icon" type="button" onClick={onEdit} aria-label={`Sửa ${customer.name}`}><Edit3 size={17} /></button>{customer.active ? <button className="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-700" type="button" onClick={onDeactivate} aria-label={`Ngừng giao dịch ${customer.name}`}><Archive size={17} /></button> : <button className="btn-icon text-emerald-600 hover:bg-emerald-50" type="button" onClick={onReactivate} aria-label={`Kích hoạt ${customer.name}`}><ArchiveRestore size={17} /></button>}</div></td>
    </tr>
  )
}

function CustomerCard({ customer, onEdit, onDeactivate, onReactivate }) {
  const state = statusBadge(customer)
  return (
    <article className="p-4">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-50 to-emerald-50 font-extrabold text-sky-700">{customer.name.slice(0, 1).toLocaleUpperCase('vi')}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900">{customer.name}</h2><p className="mt-1 truncate text-xs text-slate-400">{customer.code || 'Chưa có mã'} · {customer.customer_group || 'Khách lẻ'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${state.className}`}>{state.label}</span></div></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[11px] font-medium text-slate-400">Tổng mua</p><p className="mt-1 text-sm font-extrabold text-slate-800">{formatCurrency(customer.totalSales)}</p></div><div className="text-right"><p className="text-[11px] font-medium text-slate-400">Còn nợ</p><p className={`mt-1 text-sm font-extrabold ${Number(customer.receivable) > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{formatCurrency(customer.receivable)}</p></div></div>
      <div className="mt-3 space-y-1.5 text-xs text-slate-500">{customer.phone && <p className="flex items-center gap-2"><Phone size={14} /> {customer.phone}</p>}{customer.email && <p className="flex items-center gap-2"><Mail size={14} /> {customer.email}</p>}</div>
      <div className="mt-3 flex gap-2"><button className="btn-secondary flex-1" type="button" onClick={onEdit}><Edit3 size={16} /> Chỉnh sửa</button>{customer.active ? <button className="btn-icon text-rose-500" type="button" onClick={onDeactivate} aria-label="Ngừng giao dịch"><Archive size={17} /></button> : <button className="btn-icon text-emerald-600" type="button" onClick={onReactivate} aria-label="Kích hoạt lại"><ArchiveRestore size={17} /></button>}</div>
    </article>
  )
}
