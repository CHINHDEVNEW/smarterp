/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Banknote, CalendarDays, CircleDollarSign, Eye, Plus, Printer, ReceiptText, RefreshCw, Search, ShoppingBag, SlidersHorizontal, UserRound } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { cancelSalesOrder, createSalesOrder, getSalesOrderItems, listSalesOrders, subscribeToSalesOrders } from '../services/salesService'
import { listFinanceAccounts, recordSalesPayment } from '../services/financeService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import SalesOrderForm from '../components/sales/SalesOrderForm'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Modal from '../components/common/Modal'
import CancelDocumentModal from '../components/common/CancelDocumentModal'
import { printDocument } from '../lib/printDocument'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const statusLabels = {
  draft: 'Bản nháp',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

const paymentLabels = {
  unpaid: 'Chưa thanh toán',
  partial: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
}

function orderState(order) {
  if (order.status === 'cancelled') return { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600' }
  if (order.payment_status === 'paid') return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700' }
  if (order.payment_status === 'partial') return { label: 'Thanh toán một phần', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Chưa thanh toán', className: 'bg-rose-50 text-rose-700' }
}

export default function Sales() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [viewingOrder, setViewingOrder] = useState(null)

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      setOrders(await listSalesOrders(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được danh sách đơn bán. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToSalesOrders(businessId, () => loadOrders({ quiet: true }))
  }, [businessId, loadOrders])

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return orders.filter((order) => {
      if (status !== 'all' && order.status !== status && order.payment_status !== status) return false
      if (!needle) return true
      return [order.code, order.customer_name, order.note]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [orders, search, status])

  const stats = useMemo(() => {
    const valid = orders.filter((order) => order.status !== 'cancelled' && order.status !== 'draft')
    return {
      count: valid.length,
      revenue: valid.reduce((sum, order) => sum + (Number(order.net_total ?? order.total) || 0), 0),
      paid: valid.reduce((sum, order) => sum + (Number(order.paid_amount) || 0), 0),
      receivable: valid.reduce((sum, order) => sum + (Number(order.balance_due) || 0), 0),
    }
  }, [orders])

  const orderPages = usePagination(filteredOrders, `${search}\u0000${status}`)

  async function saveOrder(payload) {
    const created = await createSalesOrder(businessId, payload.order, payload.items)
    showToast(`Đã tạo đơn ${created?.code || 'bán hàng'}.`)
    setFormOpen(false)
    await loadOrders({ quiet: true })
  }

  return (
    <div>
      <div className="page-heading">
        <div><p className="page-eyebrow">Giao dịch đầu ra</p><h1 className="page-title">Bán hàng</h1><p className="page-description">Theo dõi đơn bán, thanh toán và các khoản khách hàng còn nợ.</p></div>
        <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={18} /> Tạo đơn bán</button>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniMetric icon={ReceiptText} label="Số đơn" value={formatNumber(stats.count)} tone="sky" />
        <MiniMetric icon={ShoppingBag} label="Tổng doanh thu" value={formatCurrency(stats.revenue)} tone="emerald" />
        <MiniMetric icon={Banknote} label="Đã thu" value={formatCurrency(stats.paid)} tone="indigo" />
        <MiniMetric icon={CircleDollarSign} label="Còn phải thu" value={formatCurrency(stats.receivable)} tone="rose" />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn hoặc khách hàng..." /></div>
          <div className="flex items-center gap-2"><SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} /><select className="field min-w-0 flex-1 sm:w-52" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả đơn bán</option><option value="confirmed">Đã xác nhận</option><option value="completed">Hoàn tất</option><option value="unpaid">Chưa thanh toán</option><option value="partial">Thanh toán một phần</option><option value="paid">Đã thanh toán</option><option value="cancelled">Đã hủy</option></select><button className="btn-icon" type="button" onClick={() => loadOrders()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button></div>
        </div>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><ReceiptText className="text-rose-500" size={34} /><p className="mt-4 text-sm font-semibold text-slate-700">{error}</p><button className="btn-secondary mt-5" type="button" onClick={() => loadOrders()}><RefreshCw size={17} /> Thử lại</button></div>
        ) : loading ? (
          <div className="p-5"><Loading rows={6} /></div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState icon={ReceiptText} title={orders.length ? 'Không tìm thấy đơn bán' : 'Chưa có đơn bán'} description={orders.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Tạo đơn bán đầu tiên để bắt đầu ghi nhận doanh thu.'} action={!orders.length && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={17} /> Tạo đơn bán</button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[980px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Mã đơn</th><th className="px-4 py-3.5">Ngày bán</th><th className="px-4 py-3.5">Khách hàng</th><th className="px-4 py-3.5 text-right">Tổng tiền</th><th className="px-4 py-3.5 text-right">Còn nợ</th><th className="px-4 py-3.5">Thanh toán</th><th className="px-5 py-3.5 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{orderPages.pageItems.map((order) => <SalesRow key={order.id} order={order} onView={() => setViewingOrder(order)} />)}</tbody></table></div>
            <div className="divide-y divide-slate-100 lg:hidden">{orderPages.pageItems.map((order) => <SalesCard key={order.id} order={order} onView={() => setViewingOrder(order)} />)}</div>
            <Pagination page={orderPages.page} pageCount={orderPages.pageCount} pageSize={orderPages.pageSize} total={filteredOrders.length} onChange={orderPages.setPage} />
          </>
        )}
      </section>

      <SalesOrderForm open={formOpen} businessId={businessId} onClose={() => setFormOpen(false)} onSave={saveOrder} />
      <OrderDetail open={Boolean(viewingOrder)} order={viewingOrder} businessId={businessId} onClose={() => setViewingOrder(null)} onPaymentComplete={() => loadOrders({ quiet: true })} onCancelled={async () => { setViewingOrder(null); showToast('Đã hủy đơn và ghi nhận các bút toán đảo.'); await loadOrders({ quiet: true }) }} />
    </div>
  )
}

const metricTones = { sky: 'bg-sky-50 text-sky-600', emerald: 'bg-emerald-50 text-emerald-600', indigo: 'bg-indigo-50 text-indigo-600', rose: 'bg-rose-50 text-rose-600' }
function MiniMetric({ icon: Icon, label, value, tone }) { return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">{value}</p></div></article> }

function SalesRow({ order, onView }) {
  const state = orderState(order)
  return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-sm font-bold text-sky-700">{order.code}</p><p className="mt-1 text-xs text-slate-400">{statusLabels[order.status] ?? order.status}</p></td><td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(order.order_date)}</td><td className="px-4 py-4"><p className="max-w-52 truncate text-sm font-semibold text-slate-800">{order.customer_name || 'Khách lẻ'}</p><p className="mt-1 text-xs text-slate-400">{order.channel === 'pos' ? 'Bán hàng nhanh' : 'Đơn bán'}</p></td><td className="px-4 py-4 text-right text-sm font-extrabold text-slate-900">{formatCurrency(order.net_total ?? order.total)}</td><td className={`px-4 py-4 text-right text-sm font-bold ${Number(order.balance_due) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{formatCurrency(order.balance_due)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}>{state.label}</span></td><td className="px-5 py-4 text-right"><button className="btn-icon ml-auto" type="button" onClick={onView} aria-label={`Xem đơn ${order.code}`}><Eye size={17} /></button></td></tr>
}

function SalesCard({ order, onView }) {
  const state = orderState(order)
  return <button className="block w-full p-4 text-left transition hover:bg-slate-50" type="button" onClick={onView}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-sky-700">{order.code}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(order.order_date)} · {order.customer_name || 'Khách lẻ'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${state.className}`}>{state.label}</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[11px] text-slate-400">Giá trị ròng</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatCurrency(order.net_total ?? order.total)}</p></div><div className="text-right"><p className="text-[11px] text-slate-400">Còn nợ</p><p className={`mt-1 text-sm font-extrabold ${Number(order.balance_due) > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{formatCurrency(order.balance_due)}</p></div></div></button>
}

function OrderDetail({ open, order, businessId, onClose, onPaymentComplete, onCancelled }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  function printOrder() {
    if (!order) return
    printDocument({ title: `ĐƠN BÁN ${order.code}`, subtitle: 'Chứng từ bán hàng', details: [['Khách hàng', order.customer_name || 'Khách lẻ'], ['Ngày bán', formatDateTime(order.order_date)], ['Trạng thái', statusLabels[order.status] ?? order.status]], columns: [{ key: 'name', label: 'Sản phẩm' }, { key: 'quantity', label: 'Số lượng', align: 'right' }, { key: 'price', label: 'Đơn giá', align: 'right' }, { key: 'amount', label: 'Thành tiền', align: 'right' }], rows: items.map((item) => ({ name: item.product_name, quantity: `${formatNumber(item.quantity)} ${item.unit || ''}`, price: formatCurrency(item.unit_price), amount: formatCurrency(item.line_total) })), totals: [['Tổng ban đầu', formatCurrency(order.total)], ...(Number(order.return_total) > 0 ? [['Hàng trả lại', formatCurrency(-Number(order.return_total))], ['Giá trị ròng', formatCurrency(order.net_total), true]] : []), ['Đã thu', formatCurrency(order.paid_amount)], ['Còn nợ', formatCurrency(order.balance_due), true]], note: order.note })
  }

  useEffect(() => {
    if (!open || !order) return
    setLoading(true)
    setError('')
    setPaymentOpen(false)
    getSalesOrderItems(businessId, order.id)
      .then(setItems)
      .catch((loadError) => setError(loadError.message || 'Không tải được chi tiết đơn.'))
      .finally(() => setLoading(false))
  }, [open, order, businessId])

  return <Modal open={open} onClose={onClose} title={order ? `Đơn bán ${order.code}` : 'Chi tiết đơn bán'} description={order ? `${order.customer_name || 'Khách lẻ'} · ${formatDateTime(order.order_date)}` : ''} size="lg" footer={<>{order && <button className="btn-secondary" type="button" onClick={printOrder} disabled={loading}><Printer size={17} /> In</button>}{order?.status !== 'cancelled' && <button className="btn-secondary text-rose-600" type="button" onClick={() => setCancelOpen(true)}><Ban size={17} /> Hủy đơn</button>}{order && Number(order.balance_due) > 0 && order.status !== 'cancelled' && <button className="btn-primary" type="button" onClick={() => setPaymentOpen(true)}><Banknote size={17} /> Thu tiền</button>}<button className="btn-secondary" type="button" onClick={onClose}>Đóng</button></>}>
    {!order ? null : <div className="space-y-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Info icon={UserRound} label="Khách hàng" value={order.customer_name || 'Khách lẻ'} /><Info icon={CalendarDays} label="Hạn thanh toán" value={order.due_date ? formatDateTime(order.due_date) : 'Không đặt'} /><Info icon={ReceiptText} label="Trạng thái" value={statusLabels[order.status] ?? order.status} /><Info icon={Banknote} label="Thanh toán" value={paymentLabels[order.payment_status] ?? order.payment_status} /></div>{error ? <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : loading ? <Loading rows={3} /> : <div className="overflow-hidden rounded-2xl border border-slate-200"><div className="divide-y divide-slate-100">{items.map((item) => <div className="flex items-center gap-3 p-4" key={item.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><ShoppingBag size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.product_name}</p><p className="mt-1 text-xs text-slate-400">{formatNumber(item.quantity)} {item.unit} × {formatCurrency(item.unit_price)}</p></div><p className="text-sm font-extrabold text-slate-900">{formatCurrency(item.line_total)}</p></div>)}</div></div>}<div className="ml-auto max-w-sm space-y-2 rounded-2xl bg-slate-50 p-5 text-sm"><MoneyRow label="Tiền hàng" value={order.subtotal} /><MoneyRow label="Giảm giá" value={-Number(order.discount || 0)} /><MoneyRow label="Phí giao hàng" value={order.shipping_fee} /><MoneyRow label="VAT" value={order.vat_amount} /><div className="border-t border-slate-200 pt-3"><MoneyRow label="Tổng ban đầu" value={order.total} strong /></div>{Number(order.return_total) > 0 && <><MoneyRow label="Hàng trả lại" value={-Number(order.return_total)} /><MoneyRow label="Giá trị ròng" value={order.net_total} strong /></>}<MoneyRow label="Đã thu" value={order.paid_amount} /><MoneyRow label="Còn nợ" value={order.balance_due} strong danger={Number(order.balance_due) > 0} /></div>{order.note && <p className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600"><span className="font-bold text-slate-800">Ghi chú:</span> {order.note}</p>}</div>}
    <PaymentForm open={paymentOpen} order={order} businessId={businessId} onClose={() => setPaymentOpen(false)} onSaved={async () => { setPaymentOpen(false); await onPaymentComplete(); onClose() }} />
    <CancelDocumentModal open={cancelOpen} title={order ? `Hủy đơn ${order.code}?` : 'Hủy đơn bán?'} description="Kho và các khoản thu liên quan sẽ được đảo tự động." onClose={() => setCancelOpen(false)} onConfirm={async (reason) => { await cancelSalesOrder(businessId, order.id, reason); setCancelOpen(false); await onCancelled() }} />
  </Modal>
}

function Info({ icon: Icon, label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><Icon className="text-sky-600" size={17} /><p className="mt-2 text-[11px] text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p></div> }
function MoneyRow({ label, value, strong = false, danger = false }) { return <div className={`flex justify-between gap-4 ${strong ? 'font-extrabold' : ''} ${danger ? 'text-rose-600' : 'text-slate-700'}`}><span>{label}</span><span>{formatCurrency(value)}</span></div> }

function PaymentForm({ open, order, businessId, onClose, onSaved }) {
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !order) return
    setAmount(String(order.balance_due ?? ''))
    setPaymentMethod('cash')
    setNote('')
    setError('')
    setLoading(true)
    listFinanceAccounts(businessId)
      .then((rows) => { setAccounts(rows); setAccountId(rows[0]?.id || '') })
      .catch((loadError) => setError(loadError.message || 'Không tải được tài khoản tiền.'))
      .finally(() => setLoading(false))
  }, [open, order, businessId])

  async function submit(event) {
    event.preventDefault()
    const numericAmount = Number(amount) || 0
    if (!accountId) return setError('Vui lòng chọn tài khoản nhận tiền.')
    if (numericAmount <= 0 || numericAmount > Number(order.balance_due)) return setError('Số tiền thu không hợp lệ.')
    setSaving(true)
    setError('')
    try {
      await recordSalesPayment(businessId, { salesOrderId: order.id, amount: numericAmount, accountId, paymentMethod, note: note.trim() })
      await onSaved()
    } catch (saveError) {
      setError(saveError.message || 'Không thể ghi nhận thanh toán.')
    } finally {
      setSaving(false)
    }
  }

  return <Modal open={open} onClose={saving ? () => {} : onClose} title={order ? `Thu tiền đơn ${order.code}` : 'Thu tiền'} description={order ? `Số còn nợ: ${formatCurrency(order.balance_due)}` : ''} size="sm" footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="payment-form" disabled={saving || loading || !accounts.length}><Banknote size={17} /> {saving ? 'Đang lưu...' : 'Ghi nhận thu'}</button></>}><form id="payment-form" className="space-y-5" onSubmit={submit}><Field label="Tài khoản nhận tiền"><select className="field" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loading}><option value="">{loading ? 'Đang tải...' : 'Chọn tài khoản'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Số tiền thu"><input className="field text-right text-lg font-bold" type="number" min="0.01" max={order?.balance_due} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field><Field label="Phương thức"><select className="field" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="card">Thẻ</option><option value="other">Khác</option></select></Field><Field label="Ghi chú"><textarea className="field min-h-20 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú khoản thu" /></Field>{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}</form></Modal>
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label> }
