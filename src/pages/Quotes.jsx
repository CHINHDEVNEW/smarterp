/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Send,
  ShoppingBag,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import {
  convertQuoteToSales,
  createQuote,
  deleteQuote,
  getQuoteItems,
  listQuotes,
  subscribeToQuotes,
  updateQuoteStatus,
} from '../services/quoteService'
import { formatCurrency, formatNumber, localDateKey } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
import QuoteForm from '../components/quotes/QuoteForm'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Modal from '../components/common/Modal'
import { printDocument } from '../lib/printDocument'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'
import ConfirmDialog from '../components/common/ConfirmDialog'

const statusLabels = {
  draft: 'Bản nháp',
  sent: 'Đã gửi',
  accepted: 'Đã chấp nhận',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
}

const dateOnlyFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : dateOnlyFormatter.format(date)
}

export default function Quotes() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deletingQuote, setDeletingQuote] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadQuotes = useCallback(
    async ({ quiet = false } = {}) => {
      if (!businessId) return
      if (!quiet) setLoading(true)
      setError('')
      try {
        setQuotes(await listQuotes(businessId))
      } catch (loadError) {
        console.error(loadError)
        setError('Không tải được danh sách báo giá. Vui lòng thử lại.')
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [businessId]
  )

  useEffect(() => {
    loadQuotes()
  }, [loadQuotes])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToQuotes(businessId, () => loadQuotes({ quiet: true }))
  }, [businessId, loadQuotes])

  const filteredQuotes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return quotes.filter((quote) => {
      if (status !== 'all' && quote.status !== status) return false
      if (!needle) return true
      return [quote.code, quote.customer_name, quote.note].some((value) =>
        String(value ?? '').toLocaleLowerCase('vi').includes(needle)
      )
    })
  }, [quotes, search, status])

  const stats = useMemo(() => {
    const active = quotes.filter((quote) => quote.status !== 'cancelled')
    return {
      count: active.length,
      draft: quotes.filter((quote) => quote.status === 'draft').length,
      accepted: quotes.filter((quote) => quote.status === 'accepted').length,
      total: active.reduce((sum, quote) => sum + (Number(quote.total) || 0), 0),
    }
  }, [quotes])

  const quotePages = usePagination(filteredQuotes, `${search}\u0000${status}`)

  async function saveQuote(payload) {
    const created = await createQuote(businessId, payload.order, payload.items)
    showToast(`Đã tạo báo giá ${created?.code || ''}.`.trim())
    setFormOpen(false)
    await loadQuotes({ quiet: true })
  }

  async function confirmDelete() {
    if (!deletingQuote || deleting) return
    setDeleting(true)
    try {
      await deleteQuote(businessId, deletingQuote.id)
      setViewing((current) => (current?.id === deletingQuote.id ? null : current))
      setDeletingQuote(null)
      showToast('Đã xóa báo giá.')
      await loadQuotes({ quiet: true })
    } catch (deleteError) {
      showToast(deleteError.message || 'Không thể xóa báo giá.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Giao dịch đầu ra"
        title="Báo giá"
        description="Lập báo giá nhanh, theo dõi thời hạn và nhu cầu của khách hàng."
        actions={
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={() => setFormOpen(true)}>
            <Plus size={18} />
            <span>Tạo báo giá</span>
          </button>
        }
      />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={FileText}
          label="Báo giá đang theo dõi"
          value={formatNumber(stats.count)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={Clock3}
          label="Bản nháp"
          value={formatNumber(stats.draft)}
          tone="slate"
          size="sm"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Đã chấp nhận"
          value={formatNumber(stats.accepted)}
          tone="emerald"
          size="sm"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Tổng giá trị"
          value={formatCurrency(stats.total)}
          tone="indigo"
          size="sm"
        />
      </section>

      {/* Quotes Table & Filter */}
      <section className="surface overflow-hidden">
        <FilterBar
          searchPlaceholder="Tìm mã báo giá hoặc khách hàng..."
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => loadQuotes()}
          refreshing={loading}
        >
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'draft', label: 'Bản nháp' },
              { id: 'sent', label: 'Đã gửi' },
              { id: 'accepted', label: 'Đã chốt' },
              { id: 'expired', label: 'Hết hạn' },
              { id: 'cancelled', label: 'Đã hủy' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  status === item.id
                    ? item.id === 'accepted'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : item.id === 'draft'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </FilterBar>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <FileText className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button
              className="btn-secondary mt-5"
              type="button"
              onClick={() => loadQuotes()}
            >
              <RefreshCw size={17} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : loading ? (
          <div className="p-5">
            <Loading rows={6} />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={quotes.length ? 'Không tìm thấy báo giá' : 'Chưa có báo giá'}
            description={
              quotes.length
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : 'Tạo báo giá đầu tiên để gửi đề xuất cho khách hàng.'
            }
            action={
              !quotes.length && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => setFormOpen(true)}
                >
                  <Plus size={17} />
                  <span>Tạo báo giá</span>
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Mã báo giá</th>
                    <th className="px-4 py-3.5">Ngày lập</th>
                    <th className="px-4 py-3.5">Hiệu lực đến</th>
                    <th className="px-4 py-3.5">Khách hàng</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-4 py-3.5 text-right">Tổng tiền</th>
                    <th className="px-5 py-3.5 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotePages.pageItems.map((quote) => (
                    <QuoteRow
                      key={quote.id}
                      quote={quote}
                      onView={() => setViewing(quote)}
                      onDelete={() => setDeletingQuote(quote)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {quotePages.pageItems.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  onView={() => setViewing(quote)}
                  onDelete={() => setDeletingQuote(quote)}
                />
              ))}
            </div>
            <Pagination
              page={quotePages.page}
              pageCount={quotePages.pageCount}
              pageSize={quotePages.pageSize}
              total={filteredQuotes.length}
              onChange={quotePages.setPage}
            />
          </>
        )}
      </section>

      {/* Modals */}
      <QuoteForm
        open={formOpen}
        businessId={businessId}
        onClose={() => setFormOpen(false)}
        onSave={saveQuote}
      />
      <QuoteDetail
        open={Boolean(viewing)}
        quote={viewing}
        businessId={businessId}
        onClose={() => setViewing(null)}
        onDelete={() => setDeletingQuote(viewing)}
        onChanged={async (message) => {
          setViewing(null)
          showToast(message)
          await loadQuotes({ quiet: true })
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingQuote)}
        onClose={() => setDeletingQuote(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Xóa vĩnh viễn báo giá?"
        description={deletingQuote ? `“${deletingQuote.code}” sẽ bị xóa khỏi danh sách.` : ''}
        confirmLabel="Xóa báo giá"
        message="Chỉ báo giá chưa chuyển thành đơn bán mới có thể xóa. Thao tác này không thể hoàn tác."
      />
    </div>
  )
}

function QuoteRow({ quote, onView, onDelete }) {
  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <p className="text-sm font-bold text-sky-700">{quote.code}</p>
      </td>
      <td className="tabular-nums px-4 py-4 text-sm text-slate-600">
        {formatDate(quote.quote_date)}
      </td>
      <td className="tabular-nums px-4 py-4 text-sm text-slate-600">
        {formatDate(quote.valid_until)}
      </td>
      <td className="px-4 py-4 text-sm font-bold text-slate-900">
        {quote.customer_name || 'Khách lẻ'}
      </td>
      <td className="px-4 py-4">
        <StatusBadge
          status={quote.status}
          label={statusLabels[quote.status]}
          size="sm"
        />
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-black text-slate-900">
        {formatCurrency(quote.total)}
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex justify-end gap-1">
          <button
            className="btn-icon"
            type="button"
            onClick={onView}
            aria-label={`Xem báo giá ${quote.code}`}
          >
            <Eye size={17} />
          </button>
          {!quote.converted_sales_order_id && (
            <button
              className="btn-icon text-rose-600 hover:bg-rose-50"
              type="button"
              onClick={onDelete}
              aria-label={`Xóa báo giá ${quote.code}`}
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function QuoteCard({ quote, onView, onDelete }) {
  return (
    <article className="p-4 transition hover:bg-slate-50/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-sky-700">{quote.code}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            <span className="tabular-nums">{formatDate(quote.quote_date)}</span> ·{' '}
            {quote.customer_name || 'Khách lẻ'}
          </p>
        </div>
        <StatusBadge
          status={quote.status}
          label={statusLabels[quote.status]}
          size="sm"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Hiệu lực đến</p>
          <p className="tabular-nums mt-0.5 text-sm font-extrabold text-slate-900">
            {formatDate(quote.valid_until)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-slate-400">Tổng tiền</p>
          <p className="tabular-nums mt-0.5 text-sm font-extrabold text-slate-900">
            {formatCurrency(quote.total)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary flex-1 justify-center" type="button" onClick={onView}>
          <Eye size={16} />
          <span>Xem chi tiết</span>
        </button>
        {!quote.converted_sales_order_id && (
          <button
            className="btn-icon text-rose-600 hover:bg-rose-50"
            type="button"
            onClick={onDelete}
            aria-label={`Xóa báo giá ${quote.code}`}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>
    </article>
  )
}

function QuoteDetail({ open, quote, businessId, onClose, onChanged, onDelete }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !quote) return
    setLoading(true)
    setError('')
    getQuoteItems(businessId, quote.id)
      .then(setItems)
      .catch((loadError) => setError(loadError.message || 'Không tải được chi tiết báo giá.'))
      .finally(() => setLoading(false))
  }, [open, quote, businessId])

  async function changeStatus(nextStatus, message) {
    setSaving(true)
    setError('')
    try {
      await updateQuoteStatus(businessId, quote.id, nextStatus)
      await onChanged(message)
    } catch (saveError) {
      setError(saveError.message || 'Không thể cập nhật báo giá.')
    } finally {
      setSaving(false)
    }
  }

  async function convertToOrder() {
    setSaving(true)
    setError('')
    try {
      const order = await convertQuoteToSales(businessId, quote.id, localDateKey())
      await onChanged(`Đã tạo đơn bán ${order?.code || ''} từ báo giá.`.trim())
    } catch (saveError) {
      setError(saveError.message || 'Không thể chuyển báo giá thành đơn bán.')
    } finally {
      setSaving(false)
    }
  }

  function printQuote() {
    if (!quote) return
    printDocument({
      title: `BÁO GIÁ ${quote.code}`,
      subtitle: `Hiệu lực đến ${formatDate(quote.valid_until)}`,
      details: [
        ['Khách hàng', quote.customer_name || 'Khách lẻ'],
        ['Ngày lập', formatDate(quote.quote_date)],
        ['Trạng thái', statusLabels[quote.status] ?? quote.status],
      ],
      columns: [
        { key: 'name', label: 'Sản phẩm' },
        { key: 'quantity', label: 'Số lượng', align: 'right' },
        { key: 'price', label: 'Đơn giá', align: 'right' },
        { key: 'amount', label: 'Thành tiền', align: 'right' },
      ],
      rows: items.map((item) => ({
        name: item.product_name,
        quantity: `${formatNumber(item.quantity)} ${item.unit || ''}`,
        price: formatCurrency(item.unit_price),
        amount: formatCurrency(
          item.line_total ?? Number(item.quantity) * Number(item.unit_price)
        ),
      })),
      totals: [
        ['Tiền hàng', formatCurrency(quote.subtotal)],
        ['Giảm giá', formatCurrency(-Number(quote.discount || 0))],
        ['Phí giao hàng', formatCurrency(quote.shipping_fee)],
        ['VAT', formatCurrency(quote.vat_amount)],
        ['Tổng báo giá', formatCurrency(quote.total), true],
      ],
      note: quote.note,
    })
  }

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      <button className="btn-secondary flex-1 sm:flex-initial" type="button" onClick={onClose} disabled={saving}>
        Đóng
      </button>
      {quote && (
        <button
          className="btn-secondary flex-1 sm:flex-initial"
          type="button"
          onClick={printQuote}
          disabled={loading}
        >
          <Printer size={17} />
          <span>In</span>
        </button>
      )}
      {quote && !quote.converted_sales_order_id && (
        <button
          className="btn-danger flex-1 sm:flex-initial"
          type="button"
          onClick={onDelete}
          disabled={saving}
        >
          <Trash2 size={17} />
          <span>Xóa</span>
        </button>
      )}
      {quote?.status === 'draft' && (
        <button
          className="btn-secondary flex-1 sm:flex-initial"
          type="button"
          onClick={() => changeStatus('sent', 'Đã đánh dấu báo giá là đã gửi.')}
          disabled={saving}
        >
          <Send size={17} />
          <span>Đã gửi</span>
        </button>
      )}
      {quote?.status === 'sent' && (
        <button
          className="btn-secondary flex-1 sm:flex-initial"
          type="button"
          onClick={() => changeStatus('accepted', 'Khách hàng đã chấp nhận báo giá.')}
          disabled={saving}
        >
          <CheckCircle2 size={17} />
          <span>Chấp nhận</span>
        </button>
      )}
      {quote &&
        !quote.converted_sales_order_id &&
        !['cancelled', 'expired'].includes(quote.status) && (
          <button
            className="btn-primary flex-1 sm:flex-initial"
            type="button"
            onClick={convertToOrder}
            disabled={saving || loading}
          >
            <ArrowRight size={17} />
            <span>{saving ? 'Đang xử lý...' : 'Tạo đơn bán'}</span>
          </button>
        )}
      {quote &&
        !quote.converted_sales_order_id &&
        ['draft', 'sent'].includes(quote.status) && (
          <button
            className="btn-danger flex-1 sm:flex-initial"
            type="button"
            onClick={() => changeStatus('cancelled', 'Đã hủy báo giá.')}
            disabled={saving}
          >
            <XCircle size={17} />
            <span>Hủy báo giá</span>
          </button>
        )}
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={quote ? `Báo giá ${quote.code}` : 'Chi tiết báo giá'}
      description={
        quote ? `${quote.customer_name || 'Khách lẻ'} · ${formatDate(quote.quote_date)}` : ''
      }
      size="lg"
      icon={FileText}
      tone="sky"
      badge="Báo giá khách hàng"
      footer={footer}
    >
      {!quote ? null : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info icon={UserRound} label="Khách hàng" value={quote.customer_name || 'Khách lẻ'} />
            <Info icon={CalendarDays} label="Ngày lập" value={formatDate(quote.quote_date)} />
            <Info icon={Clock3} label="Hiệu lực đến" value={formatDate(quote.valid_until)} />
            <Info
              icon={
                quote.status === 'cancelled'
                  ? XCircle
                  : quote.status === 'accepted'
                  ? CheckCircle2
                  : FileText
              }
              label="Trạng thái"
              value={
                quote.converted_sales_order_id
                  ? `${statusLabels[quote.status] || quote.status} · Đã tạo đơn`
                  : statusLabels[quote.status] || quote.status
              }
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>
          ) : loading ? (
            <Loading rows={3} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div className="flex items-center gap-3 p-4" key={item.id}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                      <ShoppingBag size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {item.product_name}
                      </p>
                      <p className="tabular-nums mt-0.5 text-xs text-slate-400">
                        {formatNumber(item.quantity)} {item.unit} ×{' '}
                        {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <p className="tabular-nums text-sm font-extrabold text-slate-900">
                      {formatCurrency(
                        item.line_total ?? Number(item.quantity) * Number(item.unit_price)
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ml-auto max-w-sm space-y-2 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-5 text-sm">
            <MoneyRow label="Tiền hàng" value={quote.subtotal} />
            <MoneyRow label="Giảm giá" value={-Number(quote.discount || 0)} />
            <MoneyRow label="Phí giao hàng" value={quote.shipping_fee} />
            <MoneyRow label="VAT" value={quote.vat_amount} />
            <div className="border-t border-slate-200 pt-3">
              <MoneyRow label="Tổng báo giá" value={quote.total} strong />
            </div>
          </div>

          {quote.note && (
            <p className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-6 text-slate-600">
              <span className="font-bold text-slate-800">Ghi chú:</span> {quote.note}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3">
      <Icon className="text-sky-600" size={17} />
      <p className="mt-2 text-[11px] font-medium text-slate-400">{label}</p>
      <p className="tabular-nums mt-0.5 truncate text-xs font-bold text-slate-800">{value}</p>
    </div>
  )
}

function MoneyRow({ label, value, strong = false }) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        strong ? 'font-extrabold text-slate-900 text-base' : 'text-slate-600'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}
