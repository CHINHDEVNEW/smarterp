/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Building2,
  Edit3,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Truck,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import {
  createSupplier,
  listSuppliers,
  setSupplierActive,
  subscribeToSuppliers,
  updateSupplier,
} from '../services/supplierService'
import { formatNumber } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
import SupplierForm from '../components/suppliers/SupplierForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

export default function Suppliers() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [deactivatingSupplier, setDeactivatingSupplier] = useState(null)
  const [deactivating, setDeactivating] = useState(false)

  const loadSuppliers = useCallback(
    async ({ quiet = false } = {}) => {
      if (!businessId) return
      if (!quiet) setLoading(true)
      setError('')
      try {
        setSuppliers(await listSuppliers(businessId))
      } catch (loadError) {
        console.error(loadError)
        setError('Không tải được danh sách nhà cung cấp. Vui lòng thử lại.')
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [businessId]
  )

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToSuppliers(businessId, () => loadSuppliers({ quiet: true }))
  }, [businessId, loadSuppliers])

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return suppliers.filter((supplier) => {
      if (status === 'active' && !supplier.active) return false
      if (status === 'inactive' && supplier.active) return false
      if (!needle) return true
      return [
        supplier.name,
        supplier.code,
        supplier.phone,
        supplier.email,
        supplier.contact_person,
        supplier.supplier_group,
      ].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [suppliers, search, status])

  const supplierPages = usePagination(filtered, `${search}\u0000${status}`)

  const stats = useMemo(
    () => ({
      total: suppliers.length,
      active: suppliers.filter((supplier) => supplier.active).length,
      inactive: suppliers.filter((supplier) => !supplier.active).length,
    }),
    [suppliers]
  )

  function openCreate() {
    setEditingSupplier(null)
    setFormOpen(true)
  }

  function openEdit(supplier) {
    setEditingSupplier(supplier)
    setFormOpen(true)
  }

  async function saveSupplier(values) {
    if (editingSupplier) {
      await updateSupplier(businessId, editingSupplier.id, values)
      showToast('Đã cập nhật nhà cung cấp.')
    } else {
      await createSupplier(businessId, values)
      showToast('Đã thêm nhà cung cấp mới.')
    }
    setFormOpen(false)
    setEditingSupplier(null)
    await loadSuppliers({ quiet: true })
  }

  async function confirmDeactivate() {
    if (!deactivatingSupplier) return
    setDeactivating(true)
    try {
      await setSupplierActive(businessId, deactivatingSupplier.id, false)
      showToast('Đã ngừng giao dịch với nhà cung cấp.')
      setDeactivatingSupplier(null)
      await loadSuppliers({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật nhà cung cấp.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  async function reactivate(supplier) {
    try {
      await setSupplierActive(businessId, supplier.id, true)
      showToast('Đã kích hoạt lại nhà cung cấp.')
      await loadSuppliers({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật nhà cung cấp.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Đối tác đầu vào"
        title="Nhà cung cấp"
        description="Quản lý thông tin liên hệ và các đối tác cung ứng hàng hóa."
        actions={
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>
            <Plus size={18} />
            <span>Thêm nhà cung cấp</span>
          </button>
        }
      />

      {/* KPI Metrics */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-3 sm:gap-4">
        <MetricCard
          icon={Truck}
          label="Tổng nhà cung cấp"
          value={formatNumber(stats.total)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={Building2}
          label="Đang giao dịch"
          value={formatNumber(stats.active)}
          tone="emerald"
          size="sm"
        />
        <MetricCard
          icon={Archive}
          label="Ngừng giao dịch"
          value={formatNumber(stats.inactive)}
          tone="slate"
          size="sm"
        />
      </section>

      {/* Supplier List */}
      <section className="surface overflow-hidden">
        <FilterBar
          searchPlaceholder="Tìm tên, mã, liên hệ..."
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => loadSuppliers()}
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
            <Truck className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button
              className="btn-secondary mt-5"
              type="button"
              onClick={() => loadSuppliers()}
            >
              <RefreshCw size={17} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : loading ? (
          <div className="p-5">
            <Loading rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={suppliers.length ? 'Không tìm thấy nhà cung cấp' : 'Chưa có nhà cung cấp'}
            description={
              suppliers.length
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : 'Thêm đối tác đầu tiên để bắt đầu nhập hàng.'
            }
            action={
              !suppliers.length && (
                <button className="btn-primary" type="button" onClick={openCreate}>
                  <Plus size={17} />
                  <span>Thêm nhà cung cấp</span>
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Nhà cung cấp</th>
                    <th className="px-4 py-3.5">Liên hệ</th>
                    <th className="px-4 py-3.5">Nhóm</th>
                    <th className="px-4 py-3.5">Mã số thuế</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierPages.pageItems.map((supplier) => (
                    <SupplierRow
                      key={supplier.id}
                      supplier={supplier}
                      onEdit={() => openEdit(supplier)}
                      onDeactivate={() => setDeactivatingSupplier(supplier)}
                      onReactivate={() => reactivate(supplier)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {supplierPages.pageItems.map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  onEdit={() => openEdit(supplier)}
                  onDeactivate={() => setDeactivatingSupplier(supplier)}
                  onReactivate={() => reactivate(supplier)}
                />
              ))}
            </div>
            <Pagination
              page={supplierPages.page}
              pageCount={supplierPages.pageCount}
              pageSize={supplierPages.pageSize}
              total={filtered.length}
              onChange={supplierPages.setPage}
            />
          </>
        )}
      </section>

      <SupplierForm
        open={formOpen}
        supplier={editingSupplier}
        onClose={() => setFormOpen(false)}
        onSave={saveSupplier}
      />
      <ConfirmDialog
        open={Boolean(deactivatingSupplier)}
        onClose={() => setDeactivatingSupplier(null)}
        onConfirm={confirmDeactivate}
        loading={deactivating}
        title="Ngừng giao dịch với nhà cung cấp?"
        description={
          deactivatingSupplier
            ? `“${deactivatingSupplier.name}” sẽ không còn xuất hiện khi tạo phiếu nhập hàng.`
            : ''
        }
        confirmLabel="Ngừng giao dịch"
        message="Hồ sơ và lịch sử nhập hàng vẫn được bảo lưu. Bạn có thể kích hoạt lại bất cứ lúc nào."
      />
    </div>
  )
}

function SupplierRow({ supplier, onEdit, onDeactivate, onReactivate }) {
  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 font-black text-white shadow-xs">
            {supplier.name.slice(0, 1).toLocaleUpperCase('vi')}
          </span>
          <div className="min-w-0">
            <p className="max-w-56 truncate text-sm font-bold text-slate-900">{supplier.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{supplier.code || 'Chưa có mã'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="tabular-nums text-sm font-semibold text-slate-700">{supplier.phone || '—'}</p>
        <p className="mt-0.5 max-w-48 truncate text-xs text-slate-400">
          {supplier.contact_person || supplier.email || 'Chưa có thông tin'}
        </p>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">
        {supplier.supplier_group || 'Chưa phân nhóm'}
      </td>
      <td className="tabular-nums px-4 py-4 text-sm text-slate-600">{supplier.tax_code || '—'}</td>
      <td className="px-4 py-4">
        <StatusBadge
          status={supplier.active ? 'active' : 'inactive'}
          label={supplier.active ? 'Đang giao dịch' : 'Ngừng giao dịch'}
          size="sm"
        />
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          <button
            className="btn-icon"
            type="button"
            onClick={onEdit}
            aria-label={`Sửa ${supplier.name}`}
          >
            <Edit3 size={17} />
          </button>
          {supplier.active ? (
            <button
              className="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-700"
              type="button"
              onClick={onDeactivate}
              aria-label={`Ngừng giao dịch ${supplier.name}`}
            >
              <Archive size={17} />
            </button>
          ) : (
            <button
              className="btn-icon text-emerald-600 hover:bg-emerald-50"
              type="button"
              onClick={onReactivate}
              aria-label={`Kích hoạt ${supplier.name}`}
            >
              <ArchiveRestore size={17} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function SupplierCard({ supplier, onEdit, onDeactivate, onReactivate }) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 font-extrabold text-violet-700 ring-1 ring-violet-100">
          {supplier.name.slice(0, 1).toLocaleUpperCase('vi')}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-slate-900">{supplier.name}</h3>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {supplier.code || 'Chưa có mã'} · {supplier.supplier_group || 'Chưa phân nhóm'}
              </p>
            </div>
            <StatusBadge
              status={supplier.active ? 'active' : 'inactive'}
              label={supplier.active ? 'Đang giao dịch' : 'Ngừng giao dịch'}
              size="sm"
            />
          </div>
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            {supplier.contact_person && (
              <p className="flex items-center gap-2">
                <Building2 size={14} className="text-slate-400" />
                <span>{supplier.contact_person}</span>
              </p>
            )}
            {supplier.phone && (
              <p className="flex items-center gap-2">
                <Phone size={14} className="text-slate-400" />
                <span className="tabular-nums">{supplier.phone}</span>
              </p>
            )}
            {supplier.email && (
              <p className="flex items-center gap-2">
                <Mail size={14} className="text-slate-400" />
                <span className="truncate">{supplier.email}</span>
              </p>
            )}
          </div>
        </div>
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
        {supplier.active ? (
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
      </div>
    </article>
  )
}
