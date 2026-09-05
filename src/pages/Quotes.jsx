/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Eye, FileText, Plus, Printer, RefreshCw, Search, Send, SlidersHorizontal, ShoppingBag, UserRound, XCircle } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { convertQuoteToSales, createQuote, getQuoteItems, listQuotes, subscribeToQuotes, updateQuoteStatus } from '../services/quoteService'
import { formatCurrency, formatNumber, localDateKey } from '../lib/formatters'
import QuoteForm from '../components/quotes/QuoteForm'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Modal from '../components/common/Modal'
import { printDocument } from '../lib/printDocument'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const statusLabels = {
  draft: 'Bản nháp',
  sent: 'Đã gửi',
  accepted: 'Đã chấp nhận',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
}

const statusStyles = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-sky-50 text-sky-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-rose-50 text-rose-700',
}

const dateOnlyFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : dateOnlyFormatter.format(date)
}

function quoteState(quote) {
  const status = quote.status || 'draft'
  return { label: statusLabels[status] ?? status, className: statusStyles[status] ?? 'bg-slate-100 text-slate-600' }
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

  const loadQuotes = useCallback(async ({ quiet = false } = {}) => {
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
  }, [businessId])

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
      return [quote.code, quote.customer_name, quote.note]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
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

  return (
    <div>
      <div className="page-heading">
        <div><p className="page-eyebrow">Giao dịch đầu ra</p><h1 className="page-title">Báo giá</h1><p className="page-description">Lập báo giá nhanh, theo dõi thời hạn và nhu cầu của khách hàng.</p></div>
        <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={18} /> Tạo báo giá</button>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniMetric icon={FileText} label="Báo giá đang theo dõi" value={formatNumber(stats.count)} tone="sky" />
        <MiniMetric icon={Clock3} label="Bản nháp" value={formatNumber(stats.draft)} tone="slate" />
        <MiniMetric icon={CheckCircle2} label="Đã chấp nhận" value={formatNumber(stats.accepted)} tone="emerald" />
        <MiniMetric icon={CircleDollarSign} label="Tổng giá trị" value={formatCurrency(stats.total)} tone="indigo" />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã báo giá hoặc khách hàng..." /></div>
          <div className="flex items-center gap-2"><SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} /><select className="field min-w-0 flex-1 sm:w-48" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả báo giá</option><option value="draft">Bản nháp</option><option value="sent">Đã gửi</option><option value="accepted">Đã chấp nhận</option><option value="expired">Hết hạn</option><option value="cancelled">Đã hủy</option></select><button className="btn-icon" type="button" onClick={() => loadQuotes()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button></div>
        </div>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><FileText className="text-rose-500" size={34} /><p className="mt-4 text-sm font-semibold text-slate-700">{error}</p><button className="btn-secondary mt-5" type="button" onClick={() => loadQuotes()}><RefreshCw size={17} /> Thử lại</button></div>
        ) : loading ? (
          <div className="p-5"><Loading rows={6} /></div>
        ) : filteredQuotes.length === 0 ? (
          <EmptyState icon={FileText} title={quotes.length ? 'Không tìm thấy báo giá' : 'Chưa có báo giá'} description={quotes.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Tạo báo giá đầu tiên để gửi đề xuất cho khách hàng.'} action={!quotes.length && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={17} /> Tạo báo giá</button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Mã báo giá</th><th className="px-4 py-3.5">Ngày lập</th><th className="px-4 py-3.5">Hiệu lực đến</th><th className="px-4 py-3.5">Khách hàng</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-4 py-3.5 text-right">Tổng tiền</th><th className="px-5 py-3.5 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{quotePages.pageItems.map((quote) => <QuoteRow key={quote.id} quote={quote} onView={() => setViewing(quote)} />)}</tbody></table></div>
            <div className="divide-y divide-slate-100 lg:hidden">{quotePages.pageItems.map((quote) => <QuoteCard key={quote.id} quote={quote} onView={() => setViewing(quote)} />)}</div>
            <Pagination page={quotePages.page} pageCount={quotePages.pageCount} pageSize={quotePages.pageSize} total={filteredQuotes.length} onChange={quotePages.setPage} />
          </>
        )}
      </section>

      <QuoteForm open={formOpen} businessId={businessId} onClose={() => setFormOpen(false)} onSave={saveQuote} />
      <QuoteDetail open={Boolean(viewing)} quote={viewing} businessId={businessId} onClose={() => setViewing(null)} onChanged={async (message) => { setViewing(null); showToast(message); await loadQuotes({ quiet: true }) }} />
    </div>
  )
}

const metricTones = { sky: 'bg-sky-50 text-sky-600', slate: 'bg-slate-100 text-slate-600', emerald: 'bg-emerald-50 text-emerald-600', indigo: 'bg-indigo-50 text-indigo-600' }
function MiniMetric({ icon: Icon, label, value, tone }) { return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">{value}</p></div></article> }

function QuoteRow({ quote, onView }) {
  const state = quoteState(quote)
  return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-sm font-bold text-sky-700">{quote.code}</p><p className="mt-1 text-xs text-slate-400">{quote.note || 'Báo giá bán hàng'}</p></td><td className="px-4 py-4 text-sm text-slate-600">{formatDate(quote.quote_date)}</td><td className="px-4 py-4 text-sm text-slate-600">{formatDate(quote.valid_until)}</td><td className="px-4 py-4 text-sm font-semibold text-slate-800">{quote.customer_name || 'Khách lẻ'}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}>{state.label}</span></td><td className="px-4 py-4 text-right text-sm font-extrabold text-slate-900">{formatCurrency(quote.total)}</td><td className="px-5 py-4 text-right"><button className="btn-icon ml-auto" type="button" onClick={onView} aria-label={`Xem báo giá ${quote.code}`}><Eye size={17} /></button></td></tr>
}

function QuoteCard({ quote, onView }) {
  const state = quoteState(quote)
  return <button className="block w-full p-4 text-left transition hover:bg-slate-50" type="button" onClick={onView}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-sky-700">{quote.code}</p><p className="mt-1 text-xs text-slate-400">{formatDate(quote.quote_date)} · {quote.customer_name || 'Khách lẻ'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${state.className}`}>{state.label}</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[11px] text-slate-400">Hiệu lực đến</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatDate(quote.valid_until)}</p></div><div className="text-right"><p className="text-[11px] text-slate-400">Tổng tiền</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatCurrency(quote.total)}</p></div></div></button>
}

function QuoteDetail({ open, quote, businessId, onClose, onChanged }) {
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
    printDocument({ title: `BÁO GIÁ ${quote.code}`, subtitle: `Hiệu lực đến ${formatDate(quote.valid_until)}`, details: [['Khách hàng', quote.customer_name || 'Khách lẻ'], ['Ngày lập', formatDate(quote.quote_date)], ['Trạng thái', statusLabels[quote.status] ?? quote.status]], columns: [{ key: 'name', label: 'Sản phẩm' }, { key: 'quantity', label: 'Số lượng', align: 'right' }, { key: 'price', label: 'Đơn giá', align: 'right' }, { key: 'amount', label: 'Thành tiền', align: 'right' }], rows: items.map((item) => ({ name: item.product_name, quantity: `${formatNumber(item.quantity)} ${item.unit || ''}`, price: formatCurrency(item.unit_price), amount: formatCurrency(item.line_total ?? Number(item.quantity) * Number(item.unit_price)) })), totals: [['Tiền hàng', formatCurrency(quote.subtotal)], ['Giảm giá', formatCurrency(-Number(quote.discount || 0))], ['Phí giao hàng', formatCurrency(quote.shipping_fee)], ['VAT', formatCurrency(quote.vat_amount)], ['Tổng báo giá', formatCurrency(quote.total), true]], note: quote.note })
  }

  const state = quote ? quoteState(quote) : null
  const footer = <><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Đóng</button>{quote && <button className="btn-secondary" type="button" onClick={printQuote} disabled={loading}><Printer size={17} /> In</button>}{quote?.status === 'draft' && <button className="btn-secondary" type="button" onClick={() => changeStatus('sent', 'Đã đánh dấu báo giá là đã gửi.')} disabled={saving}><Send size={17} /> Đã gửi</button>}{quote?.status === 'sent' && <button className="btn-secondary" type="button" onClick={() => changeStatus('accepted', 'Khách hàng đã chấp nhận báo giá.')} disabled={saving}><CheckCircle2 size={17} /> Chấp nhận</button>}{quote && !quote.converted_sales_order_id && !['cancelled', 'expired'].includes(quote.status) && <button className="btn-primary" type="button" onClick={convertToOrder} disabled={saving || loading}><ArrowRight size={17} /> {saving ? 'Đang xử lý...' : 'Tạo đơn bán'}</button>}{quote && !quote.converted_sales_order_id && ['draft', 'sent'].includes(quote.status) && <button className="btn-danger" type="button" onClick={() => changeStatus('cancelled', 'Đã hủy báo giá.')} disabled={saving}><XCircle size={17} /> Hủy báo giá</button>}</>
  return <Modal open={open} onClose={saving ? () => {} : onClose} title={quote ? `Báo giá ${quote.code}` : 'Chi tiết báo giá'} description={quote ? `${quote.customer_name || 'Khách lẻ'} · ${formatDate(quote.quote_date)}` : ''} size="lg" footer={footer}>{!quote ? null : <div className="space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Info icon={UserRound} label="Khách hàng" value={quote.customer_name || 'Khách lẻ'} /><Info icon={CalendarDays} label="Ngày lập" value={formatDate(quote.quote_date)} /><Info icon={Clock3} label="Hiệu lực đến" value={formatDate(quote.valid_until)} /><Info icon={state?.label === 'Đã hủy' ? XCircle : state?.label === 'Đã chấp nhận' ? CheckCircle2 : FileText} label="Trạng thái" value={quote.converted_sales_order_id ? `${state?.label} · Đã tạo đơn` : state?.label} /></div>{error ? <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : loading ? <Loading rows={3} /> : <div className="overflow-hidden rounded-2xl border border-slate-200"><div className="divide-y divide-slate-100">{items.map((item) => <div className="flex items-center gap-3 p-4" key={item.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><ShoppingBag size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.product_name}</p><p className="mt-1 text-xs text-slate-400">{formatNumber(item.quantity)} {item.unit} × {formatCurrency(item.unit_price)}</p></div><p className="text-sm font-extrabold text-slate-900">{formatCurrency(item.line_total ?? Number(item.quantity) * Number(item.unit_price))}</p></div>)}</div></div>}<div className="ml-auto max-w-sm space-y-2 rounded-2xl bg-slate-50 p-5 text-sm"><MoneyRow label="Tiền hàng" value={quote.subtotal} /><MoneyRow label="Giảm giá" value={-Number(quote.discount || 0)} /><MoneyRow label="Phí giao hàng" value={quote.shipping_fee} /><MoneyRow label="VAT" value={quote.vat_amount} /><div className="border-t border-slate-200 pt-3"><MoneyRow label="Tổng báo giá" value={quote.total} strong /></div></div>{quote.note && <p className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600"><span className="font-bold text-slate-800">Ghi chú:</span> {quote.note}</p>}</div>}</Modal>
}

function Info({ icon: Icon, label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><Icon className="text-sky-600" size={17} /><p className="mt-2 text-[11px] text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p></div> }
function MoneyRow({ label, value, strong = false }) { return <div className={`flex justify-between gap-4 ${strong ? 'font-extrabold' : 'text-slate-700'}`}><span>{label}</span><span>{formatCurrency(value)}</span></div> }
