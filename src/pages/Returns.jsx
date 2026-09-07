/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Eye,
  PackageCheck,
  Plus,
  RefreshCw,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import {
  createPurchaseReturn,
  createSalesReturn,
  listReturnItems,
  listReturns,
  settleReturn,
  subscribeToReturns,
} from '../services/returnService'
import { listFinanceAccounts } from '../services/financeService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Modal from '../components/common/Modal'
import ReturnForm from '../components/returns/ReturnForm'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const statusLabels = {
  draft: 'Bản nháp',
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  completed: 'Đã hoàn tất',
  refunded: 'Đã hoàn tiền',
  partial: 'Đã đối soát một phần',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
}

export default function Returns() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [viewing, setViewing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState('sales')

  const loadReturns = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError('')
    try {
      setRows(await listReturns(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được danh sách phiếu trả hàng. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadReturns()
  }, [loadReturns])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToReturns(businessId, () => loadReturns())
  }, [businessId, loadReturns])

  async function saveReturn(payload) {
    const created =
      payload.type === 'sales'
        ? await createSalesReturn(businessId, payload)
        : await createPurchaseReturn(businessId, payload)
    showToast('Đã tạo phiếu ' + (created?.code || 'trả hàng') + '.')
    setFormOpen(false)
    await loadReturns()
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return rows.filter((row) => {
      if (type !== 'all' && row.type !== type) return false
      if (
        status !== 'all' &&
        row.status.toLowerCase() !== status &&
        row.refundStatus.toLowerCase() !== status
      )
        return false
      if (!needle) return true
      return [row.code, row.partner, row.note, row.status].some((value) =>
        String(value ?? '').toLocaleLowerCase('vi').includes(needle)
      )
    })
  }, [rows, search, status, type])

  const stats = useMemo(() => {
    const activeRows = rows.filter(
      (row) => !['cancelled', 'canceled', 'draft'].includes(row.status.toLowerCase())
    )
    return {
      count: activeRows.length,
      sales: activeRows.filter((row) => row.type === 'sales').length,
      purchases: activeRows.filter((row) => row.type === 'purchase').length,
      total: activeRows.reduce((sum, row) => sum + row.total, 0),
    }
  }, [rows])

  const returnPages = usePagination(filtered, `${search}\u0000${type}\u0000${status}`)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Đối soát giao dịch"
        title="Trả hàng"
        description="Tra cứu phiếu trả hàng bán và trả hàng nhà cung cấp trong doanh nghiệp."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              className="btn-primary flex-1 sm:flex-initial"
              type="button"
              onClick={() => {
                setFormType('sales')
                setFormOpen(true)
              }}
            >
              <Plus size={17} />
              <span>Trả hàng bán</span>
            </button>
            <button
              className="btn-secondary flex-1 sm:flex-initial"
              type="button"
              onClick={() => {
                setFormType('purchase')
                setFormOpen(true)
              }}
            >
              <Plus size={17} />
              <span>Trả hàng nhập</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={PackageCheck}
          label="Phiếu hợp lệ"
          value={formatNumber(stats.count)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={ArrowUpRight}
          label="Trả hàng bán"
          value={formatNumber(stats.sales)}
          tone="rose"
          size="sm"
        />
        <MetricCard
          icon={ArrowDownLeft}
          label="Trả hàng nhập"
          value={formatNumber(stats.purchases)}
          tone="indigo"
          size="sm"
        />
        <MetricCard
          icon={PackageCheck}
          label="Tổng giá trị"
          value={formatCurrency(stats.total)}
          tone="emerald"
          size="sm"
        />
      </section>

      {/* Returns List */}
      <section className="surface overflow-hidden">
        <FilterBar
          searchPlaceholder="Tìm mã phiếu hoặc đối tác..."
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={loadReturns}
          refreshing={loading}
        >
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
              <button
                type="button"
                onClick={() => setType('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  type === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setType('sales')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  type === 'sales'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Khách trả
              </button>
              <button
                type="button"
                onClick={() => setType('purchase')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  type === 'purchase'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Trả NCC
              </button>
            </div>

            <select
              className="field min-w-0 flex-1 sm:w-40 text-xs sm:text-sm py-1.5"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="completed">Đã hoàn tất</option>
              <option value="refunded">Đã hoàn tiền</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
        </FilterBar>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <PackageCheck className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button className="btn-secondary mt-5" type="button" onClick={loadReturns}>
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
            icon={PackageCheck}
            title={rows.length ? 'Không tìm thấy phiếu trả hàng' : 'Chưa có phiếu trả hàng'}
            description={
              rows.length
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : 'Các phiếu trả hàng sẽ xuất hiện tại đây khi được ghi nhận trong hệ thống.'
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[800px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Mã phiếu</th>
                    <th className="px-4 py-3.5">Loại</th>
                    <th className="px-4 py-3.5">Ngày trả</th>
                    <th className="px-4 py-3.5">Đối tác</th>
                    <th className="px-4 py-3.5 text-right">Giá trị</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnPages.pageItems.map((row) => (
                    <ReturnRow key={row.key} row={row} onView={() => setViewing(row)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {returnPages.pageItems.map((row) => (
                <ReturnCard key={row.key} row={row} onView={() => setViewing(row)} />
              ))}
            </div>
            <Pagination
              page={returnPages.page}
              pageCount={returnPages.pageCount}
              pageSize={returnPages.pageSize}
              total={filtered.length}
              onChange={returnPages.setPage}
            />
          </>
        )}
      </section>

      {/* Modals */}
      <ReturnDetail
        open={Boolean(viewing)}
        row={viewing}
        businessId={businessId}
        onClose={() => setViewing(null)}
        onSettled={async () => {
          setViewing(null)
          await loadReturns()
        }}
      />
      <ReturnForm
        open={formOpen}
        businessId={businessId}
        initialType={formType}
        onClose={() => setFormOpen(false)}
        onSave={saveReturn}
      />
    </div>
  )
}

function returnType(row) {
  return row.type === 'sales'
    ? { label: 'Trả hàng bán', tone: 'rose', icon: ArrowUpRight }
    : { label: 'Trả hàng nhập', tone: 'indigo', icon: ArrowDownLeft }
}

function statusTone(value) {
  const normalized = value.toLowerCase()
  if (['cancelled', 'canceled'].includes(normalized)) return 'slate'
  if (['completed', 'refunded', 'confirmed'].includes(normalized)) return 'emerald'
  if (['pending', 'partial', 'draft'].includes(normalized)) return 'amber'
  return 'slate'
}

function ReturnRow({ row, onView }) {
  const kind = returnType(row)
  const paymentStatus = row.remainingAmount > 0 ? row.refundStatus : 'refunded'
  const tone = statusTone(paymentStatus)

  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <p className="text-sm font-bold text-sky-700">{row.code}</p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge label={kind.label} tone={kind.tone} size="sm" />
      </td>
      <td className="tabular-nums px-4 py-4 text-sm text-slate-600">
        {formatDateTime(row.date)}
      </td>
      <td className="px-4 py-4 text-sm font-bold text-slate-900">
        {row.partner || 'Chưa có thông tin'}
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-black text-slate-900">
        {formatCurrency(row.total)}
      </td>
      <td className="px-4 py-4">
        <StatusBadge
          label={statusLabels[paymentStatus] || paymentStatus}
          tone={tone}
          size="sm"
        />
      </td>
      <td className="px-5 py-4 text-right">
        <button
          className="btn-icon ml-auto"
          type="button"
          onClick={onView}
          aria-label={`Xem phiếu ${row.code}`}
        >
          <Eye size={17} />
        </button>
      </td>
    </tr>
  )
}

function ReturnCard({ row, onView }) {
  const kind = returnType(row)
  const paymentStatus = row.remainingAmount > 0 ? row.refundStatus : 'refunded'
  const tone = statusTone(paymentStatus)

  return (
    <button
      className="block w-full p-4 text-left transition hover:bg-slate-50/80"
      type="button"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-sky-700">{row.code}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            <span className="tabular-nums">{formatDateTime(row.date)}</span> ·{' '}
            {row.partner || 'Chưa có đối tác'}
          </p>
        </div>
        <StatusBadge label={kind.label} tone={kind.tone} size="sm" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Đối soát tiền</p>
          <div className="mt-1">
            <StatusBadge
              label={statusLabels[paymentStatus] || paymentStatus}
              tone={tone}
              size="sm"
            />
          </div>
        </div>
        <p className="tabular-nums text-sm font-extrabold text-slate-900">
          {formatCurrency(row.total)}
        </p>
      </div>
    </button>
  )
}

const labels = {
  code: 'Mã phiếu',
  return_code: 'Mã phiếu',
  return_number: 'Số phiếu',
  status: 'Trạng thái',
  return_status: 'Trạng thái',
  state: 'Trạng thái',
  return_date: 'Ngày trả',
  returned_at: 'Thời gian trả',
  document_date: 'Ngày chứng từ',
  date: 'Ngày',
  total: 'Tổng giá trị',
  total_amount: 'Tổng giá trị',
  amount: 'Số tiền',
  refund_amount: 'Số tiền hoàn',
  return_amount: 'Giá trị trả',
  customer_name: 'Khách hàng',
  supplier_name: 'Nhà cung cấp',
  note: 'Ghi chú',
  reason: 'Lý do',
}

function ReturnDetail({ open, row, businessId, onClose, onSettled }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settleOpen, setSettleOpen] = useState(false)

  useEffect(() => {
    if (!open || !row || !businessId) {
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    listReturnItems(businessId, row)
      .then(setItems)
      .catch((loadError) => setError(loadError.message || 'Không tải được chi tiết phiếu trả hàng.'))
      .finally(() => setLoading(false))
  }, [businessId, open, row])

  if (!row) return null
  const entries = Object.entries(row).filter(
    ([key]) =>
      ![
        'key',
        'rawId',
        'type',
        'partner',
        'date',
        'total',
        'status',
        'refundedAmount',
        'remainingAmount',
        'refundStatus',
        'business_id',
        'created_by',
        'updated_at',
      ].includes(key) && !key.endsWith('_id')
  )
  const kind = returnType(row)

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={'Phiếu ' + row.code}
        description={kind.label + ' · ' + formatDateTime(row.date)}
        size="lg"
        icon={PackageCheck}
        tone="sky"
        badge="Phiếu trả hàng"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {row.remainingAmount > 0 && (
              <button className="btn-primary flex-1 sm:flex-initial" type="button" onClick={() => setSettleOpen(true)}>
                <Banknote size={17} />
                <span>{row.type === 'sales' ? 'Hoàn tiền' : 'Nhận tiền'}</span>
              </button>
            )}
            <button className="btn-secondary flex-1 sm:flex-initial" type="button" onClick={onClose}>
              Đóng
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-slate-400">Đối tác</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {row.partner || 'Chưa có thông tin'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Trạng thái phiếu</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {statusLabels[row.status.toLowerCase()] || row.status || 'Chưa cập nhật'}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium text-slate-400">Đã đối soát</p>
              <p className="tabular-nums mt-1 text-sm font-extrabold text-emerald-600">
                {formatCurrency(row.refundedAmount)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium text-slate-400">Còn lại</p>
              <p className="tabular-nums mt-1 text-sm font-extrabold text-rose-600">
                {formatCurrency(row.remainingAmount)}
              </p>
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>
          )}

          {loading ? (
            <Loading rows={3} />
          ) : items.length > 0 ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {items.map((item, index) => {
                const quantity =
                  Number(itemValue(item, ['quantity', 'return_quantity', 'so_luong_tra'], 0)) || 0
                const unitValue =
                  Number(
                    itemValue(
                      item,
                      row.type === 'sales'
                        ? ['unit_price', 'price', 'don_gia']
                        : ['unit_cost', 'unit_price', 'price', 'don_gia'],
                      0
                    )
                  ) || 0
                const amount =
                  Number(
                    itemValue(
                      item,
                      ['net_line_total', 'line_total', 'total', 'amount', 'thanh_tien'],
                      quantity * unitValue
                    )
                  ) || quantity * unitValue
                return (
                  <div
                    className="flex items-center gap-3 p-4"
                    key={item.id || item.product_id || index}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                      <PackageCheck size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {itemValue(item, ['product_name', 'name', 'ten_sp'], 'Sản phẩm')}
                      </p>
                      <p className="tabular-nums mt-0.5 text-xs text-slate-400">
                        {formatNumber(quantity)} {itemValue(item, ['unit', 'don_vi_tinh'], '')} ×{' '}
                        {formatCurrency(unitValue)}
                      </p>
                    </div>
                    <p className="tabular-nums text-sm font-extrabold text-slate-900">
                      {formatCurrency(amount)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Phiếu này chưa có chi tiết sản phẩm.
            </p>
          )}

          {entries.length > 0 ? (
            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {entries.map(([key, value]) => (
                <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm" key={key}>
                  <dt className="font-semibold text-slate-500">
                    {labels[key] || key.replaceAll('_', ' ')}
                  </dt>
                  <dd className="max-w-[65%] text-right font-medium text-slate-800">
                    {formatRawValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </Modal>

      <SettleReturnModal
        open={settleOpen}
        row={row}
        businessId={businessId}
        onClose={() => setSettleOpen(false)}
        onSaved={onSettled}
      />
    </>
  )
}

function SettleReturnModal({ open, row, businessId, onClose, onSaved }) {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !businessId) return
    setAmount(String(row?.remainingAmount || ''))
    setNote('')
    setError('')
    listFinanceAccounts(businessId)
      .then((data) => {
        setAccounts(data)
        setAccountId(data[0]?.id || '')
      })
      .catch((loadError) => setError(loadError.message || 'Không tải được tài khoản tiền.'))
  }, [businessId, open, row])

  async function submit(event) {
    event.preventDefault()
    const value = Number(amount) || 0
    if (!accountId) return setError('Vui lòng chọn tài khoản tiền.')
    if (value <= 0 || value > row.remainingAmount) return setError('Số tiền đối soát không hợp lệ.')
    setSaving(true)
    setError('')
    try {
      await settleReturn(businessId, {
        type: row.type,
        returnId: row.rawId,
        amount: value,
        accountId,
        paymentMethod,
        note: note.trim() || null,
      })
      onClose()
      await onSaved()
    } catch (saveError) {
      setError(saveError.message || 'Không thể đối soát phiếu trả hàng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={row?.type === 'sales' ? 'Hoàn tiền cho khách' : 'Nhận tiền từ nhà cung cấp'}
      description={row ? 'Còn cần đối soát: ' + formatCurrency(row.remainingAmount) : ''}
      size="sm"
      icon={Banknote}
      tone={row?.type === 'sales' ? 'rose' : 'emerald'}
      badge={row?.type === 'sales' ? 'Hoàn tiền' : 'Nhận tiền'}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            className="btn-primary w-full sm:w-auto"
            type="submit"
            form="settle-return-form"
            disabled={saving || !accounts.length}
          >
            <Banknote size={17} />
            <span>{saving ? 'Đang lưu...' : 'Ghi nhận'}</span>
          </button>
        </div>
      }
    >
      <form id="settle-return-form" className="space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Tài khoản tiền <span className="text-rose-500">*</span>
          </span>
          <select
            className="field"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
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
            Số tiền <span className="text-rose-500">*</span>
          </span>
          <input
            className="field tabular-nums text-right text-lg font-bold"
            type="number"
            min="0.01"
            max={row?.remainingAmount}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Phương thức
          </span>
          <select
            className="field"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <option value="cash">Tiền mặt</option>
            <option value="bank">Chuyển khoản</option>
            <option value="card">Thẻ</option>
            <option value="other">Khác</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Ghi chú
          </span>
          <textarea
            className="field min-h-20"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>
        )}
      </form>
    </Modal>
  )
}

function itemValue(item, keys, fallback = '') {
  for (const key of keys) {
    if (item?.[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]
  }
  return fallback
}

function formatRawValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
