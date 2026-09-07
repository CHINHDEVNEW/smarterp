/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  CircleDollarSign,
  Edit3,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import {
  createCustomer,
  deleteCustomer,
  listCustomersWithSummary,
  setCustomerActive,
  subscribeToCustomers,
  updateCustomer,
} from '../services/customerService'
import { formatCurrency, formatNumber } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
import CustomerForm from '../components/customers/CustomerForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'
import { formDraftKey, hasFormDraft } from '../lib/formDraft'

function customerStatus(customer) {
  if (!customer.active) return { label: 'Ngừng giao dịch', tone: 'slate' }
  if (
    Number(customer.receivable) > Number(customer.credit_limit) &&
    Number(customer.credit_limit) > 0
  ) {
    return { label: 'Vượt hạn mức', tone: 'rose' }
  }
  if (Number(customer.receivable) > 0) return { label: 'Đang có nợ', tone: 'amber' }
  return { label: 'Đang giao dịch', tone: 'emerald' }
}

export default function Customers() {
  const { business, businessId } = useBusiness()
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
  const [deletingCustomer, setDeletingCustomer] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const canDelete = ['owner', 'admin'].includes(String(business?.role || '').toLowerCase())

  const loadCustomers = useCallback(
    async ({ quiet = false } = {}) => {
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
    },
    [businessId]
  )

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToCustomers(businessId, () => loadCustomers({ quiet: true }))
  }, [businessId, loadCustomers])

  useEffect(() => {
    if (businessId && hasFormDraft(formDraftKey(businessId, 'customer-new'))) {
      setEditingCustomer(null)
      setFormOpen(true)
    }
  }, [businessId])

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return customers.filter((customer) => {
      if (status === 'active' && !customer.active) return false
      if (status === 'inactive' && customer.active) return false
      if (status === 'debt' && Number(customer.receivable) <= 0) return false
      if (!needle) return true
      return [
        customer.name,
        customer.code,
        customer.phone,
        customer.email,
        customer.address,
        customer.customer_group,
      ].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [customers, search, status])

  const stats = useMemo(
    () => ({
      total: customers.length,
      active: customers.filter((customer) => customer.active).length,
      debtCustomers: customers.filter((customer) => Number(customer.receivable) > 0).length,
      receivable: customers.reduce((sum, customer) => sum + (Number(customer.receivable) || 0), 0),
    }),
    [customers]
  )

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

  async function confirmDelete() {
    if (!deletingCustomer) return
    setDeleting(true)
    try {
      await deleteCustomer(businessId, deletingCustomer.id)
      showToast('Đã xóa khách hàng.')
      setDeletingCustomer(null)
      await loadCustomers({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể xóa khách hàng.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bán hàng và công nợ"
        title="Khách hàng"
        description="Quản lý hồ sơ, doanh số và các khoản phải thu theo từng khách hàng."
        actions={
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>
            <Plus size={18} />
            <span>Thêm khách hàng</span>
          </button>
        }
      />

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={Users}
          label="Tổng khách hàng"
          value={formatNumber(stats.total)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={UserRound}
          label="Đang giao dịch"
          value={formatNumber(stats.active)}
          tone="emerald"
          size="sm"
        />
        <MetricCard
          icon={WalletCards}
          label="Khách đang nợ"
          value={formatNumber(stats.debtCustomers)}
          tone="amber"
          size="sm"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Tổng phải thu"
          value={formatCurrency(stats.receivable)}
          tone="rose"
          size="sm"
        />
      </section>

      {/* Customer List */}
      <section className="surface overflow-hidden">
        <FilterBar
          searchPlaceholder="Tìm tên, mã, số điện thoại hoặc email..."
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => loadCustomers()}
          refreshing={loading}
        >
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            <button
              type="button"
              onClick={() => setStatus('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'active'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Đang GD</span>
              {stats.active > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${status === 'active' ? 'bg-sky-700 text-white' : 'bg-sky-100 text-sky-700'}`}>
                  {stats.active}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatus('debt')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'debt'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Có nợ</span>
              {stats.debtCustomers > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${status === 'debt' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'}`}>
                  {stats.debtCustomers}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatus('inactive')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'inactive'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ngừng GD
            </button>
          </div>
        </FilterBar>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <Users className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button
              className="btn-secondary mt-5"
              type="button"
              onClick={() => loadCustomers()}
            >
              <RefreshCw size={17} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : loading ? (
          <div className="p-5">
            <Loading rows={6} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={customers.length ? 'Không tìm thấy khách hàng' : 'Chưa có khách hàng'}
            description={
              customers.length
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : 'Thêm khách hàng đầu tiên để bắt đầu theo dõi giao dịch.'
            }
            action={
              !customers.length && (
                <button className="btn-primary" type="button" onClick={openCreate}>
                  <Plus size={17} />
                  <span>Thêm khách hàng</span>
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Khách hàng</th>
                    <th className="px-4 py-3.5">Liên hệ</th>
                    <th className="px-4 py-3.5">Nhóm</th>
                    <th className="px-4 py-3.5 text-right">Tổng mua</th>
                    <th className="px-4 py-3.5 text-right">Còn nợ</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customerPages.pageItems.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onEdit={() => openEdit(customer)}
                      onDeactivate={() => setDeactivatingCustomer(customer)}
                      onReactivate={() => reactivate(customer)}
                      canDelete={canDelete}
                      onDelete={() => setDeletingCustomer(customer)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {customerPages.pageItems.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onEdit={() => openEdit(customer)}
                  onDeactivate={() => setDeactivatingCustomer(customer)}
                  onReactivate={() => reactivate(customer)}
                  canDelete={canDelete}
                  onDelete={() => setDeletingCustomer(customer)}
                />
              ))}
            </div>

            <Pagination
              page={customerPages.page}
              pageCount={customerPages.pageCount}
              pageSize={customerPages.pageSize}
              total={filteredCustomers.length}
              onChange={customerPages.setPage}
            />
          </>
        )}
      </section>

      <CustomerForm
        open={formOpen}
        customer={editingCustomer}
        businessId={businessId}
        onClose={() => setFormOpen(false)}
        onSave={saveCustomer}
      />
      <ConfirmDialog
        open={Boolean(deactivatingCustomer)}
        onClose={() => setDeactivatingCustomer(null)}
        onConfirm={confirmDeactivate}
        loading={deactivating}
        title="Ngừng giao dịch với khách hàng?"
        description={
          deactivatingCustomer
            ? `“${deactivatingCustomer.name}” sẽ không còn xuất hiện khi lập chứng từ mới.`
            : ''
        }
        confirmLabel="Ngừng giao dịch"
        message="Hồ sơ và lịch sử giao dịch vẫn được giữ nguyên. Bạn có thể kích hoạt lại khách hàng bất cứ lúc nào."
      />
      <ConfirmDialog
        open={Boolean(deletingCustomer)}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Xóa vĩnh viễn khách hàng?"
        description={deletingCustomer ? `“${deletingCustomer.name}” sẽ bị xóa khỏi danh mục.` : ''}
        confirmLabel="Xóa khách hàng"
        message="Chỉ khách hàng chưa phát sinh chứng từ mới có thể xóa. Thao tác này không thể hoàn tác."
      />
    </div>
  )
}

function CustomerRow({ customer, onEdit, onDeactivate, onReactivate, canDelete, onDelete }) {
  const status = customerStatus(customer)
  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 font-black text-white shadow-xs">
            {customer.name.slice(0, 1).toLocaleUpperCase('vi')}
          </span>
          <div className="min-w-0">
            <p className="max-w-56 truncate text-sm font-bold text-slate-900">{customer.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {customer.code || 'Chưa có mã'} ·{' '}
              <span className="tabular-nums">{formatNumber(customer.orderCount)}</span> đơn
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="tabular-nums text-sm font-semibold text-slate-700">{customer.phone || '—'}</p>
        <p className="mt-0.5 max-w-48 truncate text-xs text-slate-400">
          {customer.email || customer.address || 'Chưa có thông tin'}
        </p>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">
        {customer.customer_group || 'Khách lẻ'}
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-bold text-slate-800">
        {formatCurrency(customer.totalSales)}
      </td>
      <td
        className={`tabular-nums px-4 py-4 text-right text-sm font-extrabold ${
          Number(customer.receivable) > 0 ? 'text-rose-600' : 'text-slate-500'
        }`}
      >
        {formatCurrency(customer.receivable)}
      </td>
      <td className="px-4 py-4">
        <StatusBadge label={status.label} tone={status.tone} size="sm" />
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          <button
            className="btn-icon"
            type="button"
            onClick={onEdit}
            aria-label={`Sửa ${customer.name}`}
          >
            <Edit3 size={17} />
          </button>
          {customer.active ? (
            <button
              className="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-700"
              type="button"
              onClick={onDeactivate}
              aria-label={`Ngừng giao dịch ${customer.name}`}
            >
              <Archive size={17} />
            </button>
          ) : (
            <button
              className="btn-icon text-emerald-600 hover:bg-emerald-50"
              type="button"
              onClick={onReactivate}
              aria-label={`Kích hoạt ${customer.name}`}
            >
              <ArchiveRestore size={17} />
            </button>
          )}
          {canDelete && (
            <button className="btn-icon text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label={`Xóa ${customer.name}`}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function CustomerCard({ customer, onEdit, onDeactivate, onReactivate, canDelete, onDelete }) {
  const status = customerStatus(customer)
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 font-extrabold text-sky-700 ring-1 ring-sky-100">
          {customer.name.slice(0, 1).toLocaleUpperCase('vi')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">{customer.name}</h3>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {customer.code || 'Chưa có mã'} · {customer.customer_group || 'Khách lẻ'}
              </p>
            </div>
            <StatusBadge label={status.label} tone={status.tone} size="sm" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Tổng mua</p>
          <p className="tabular-nums mt-0.5 text-sm font-extrabold text-slate-800">
            {formatCurrency(customer.totalSales)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-slate-400">Còn nợ</p>
          <p
            className={`tabular-nums mt-0.5 text-sm font-extrabold ${
              Number(customer.receivable) > 0 ? 'text-rose-600' : 'text-slate-700'
            }`}
          >
            {formatCurrency(customer.receivable)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {customer.phone && (
          <p className="flex items-center gap-2">
            <Phone size={14} className="text-slate-400" />
            <span className="tabular-nums">{customer.phone}</span>
          </p>
        )}
        {customer.email && (
          <p className="flex items-center gap-2">
            <Mail size={14} className="text-slate-400" />
            <span className="truncate">{customer.email}</span>
          </p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="btn-secondary flex-1 justify-center"
          type="button"
          onClick={onEdit}
        >
          <Edit3 size={16} />
          <span>Chỉnh sửa</span>
        </button>
        {customer.active ? (
          <button
            className="btn-icon text-rose-500 hover:bg-rose-50"
            type="button"
            onClick={onDeactivate}
            aria-label="Ngừng giao dịch"
          >
            <Archive size={17} />
          </button>
        ) : (
          <button
            className="btn-icon text-emerald-600 hover:bg-emerald-50"
            type="button"
            onClick={onReactivate}
            aria-label="Kích hoạt lại"
          >
            <ArchiveRestore size={17} />
          </button>
        )}
        {canDelete && (
          <button className="btn-icon text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label="Xóa khách hàng">
            <Trash2 size={17} />
          </button>
        )}
      </div>
    </article>
  )
}
