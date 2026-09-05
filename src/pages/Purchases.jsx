/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Banknote, CircleDollarSign, Eye, Plus, Printer, RefreshCw, Search, SlidersHorizontal, Truck } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { cancelPurchaseOrder, createPurchaseOrder, getPurchaseOrderItems, listPurchaseOrders, recordPurchasePayment, subscribeToPurchaseOrders } from '../services/purchaseService'
import { listFinanceAccounts } from '../services/financeService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import PurchaseOrderForm from '../components/purchases/PurchaseOrderForm'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import Modal from '../components/common/Modal'
import CancelDocumentModal from '../components/common/CancelDocumentModal'
import { printDocument } from '../lib/printDocument'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const statusLabels = { draft: 'Bản nháp', confirmed: 'Đã xác nhận', completed: 'Hoàn tất', cancelled: 'Đã hủy' }

function paymentState(order) {
  if (order.status === 'cancelled') return { label: 'Đã hủy', className: 'bg-slate-100 text-slate-600' }
  if (order.payment_status === 'paid') return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700' }
  if (order.payment_status === 'partial') return { label: 'Thanh toán một phần', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Chưa thanh toán', className: 'bg-rose-50 text-rose-700' }
}

export default function Purchases() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [viewing, setViewing] = useState(null)

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try { setOrders(await listPurchaseOrders(businessId)) } catch (loadError) { console.error(loadError); setError('Không tải được danh sách phiếu nhập. Vui lòng thử lại.') } finally { if (!quiet) setLoading(false) }
  }, [businessId])
  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => { if (!businessId) return undefined; return subscribeToPurchaseOrders(businessId, () => loadOrders({ quiet: true })) }, [businessId, loadOrders])

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return orders.filter((order) => {
      if (status !== 'all' && order.status !== status && order.payment_status !== status) return false
      if (!needle) return true
      return [order.code, order.supplier_name, order.note].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [orders, search, status])
  const stats = useMemo(() => {
    const valid = orders.filter((order) => order.status !== 'cancelled' && order.status !== 'draft')
    return { count: valid.length, total: valid.reduce((sum, order) => sum + (Number(order.net_total ?? order.total) || 0), 0), due: valid.reduce((sum, order) => sum + (Number(order.balance_due) || 0), 0) }
  }, [orders])
  const purchasePages = usePagination(filtered, `${search}\u0000${status}`)

  async function saveOrder(payload) {
    const created = await createPurchaseOrder(businessId, payload.order, payload.items)
    showToast(`Đã tạo phiếu ${created?.code || 'nhập hàng'}.`)
    setFormOpen(false)
    await loadOrders({ quiet: true })
  }

  return <div><div className="page-heading"><div><p className="page-eyebrow">Giao dịch đầu vào</p><h1 className="page-title">Mua hàng</h1><p className="page-description">Theo dõi phiếu nhập, giá vốn và các khoản phải trả nhà cung cấp.</p></div><button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={18} /> Tạo phiếu nhập</button></div><section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-3"><MiniMetric icon={Truck} label="Số phiếu nhập" value={formatNumber(stats.count)} tone="sky" /><MiniMetric icon={CircleDollarSign} label="Tổng giá trị nhập" value={formatCurrency(stats.total)} tone="emerald" /><MiniMetric icon={Banknote} label="Còn phải trả" value={formatCurrency(stats.due)} tone="rose" /></section><section className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã phiếu hoặc nhà cung cấp..." /></div><div className="flex items-center gap-2"><SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} /><select className="field min-w-0 flex-1 sm:w-52" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả phiếu nhập</option><option value="confirmed">Đã xác nhận</option><option value="completed">Hoàn tất</option><option value="unpaid">Chưa thanh toán</option><option value="partial">Thanh toán một phần</option><option value="paid">Đã thanh toán</option><option value="cancelled">Đã hủy</option></select><button className="btn-icon" type="button" onClick={() => loadOrders()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button></div></div>{error ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><Truck className="text-rose-500" size={34} /><p className="mt-4 text-sm font-semibold text-slate-700">{error}</p><button className="btn-secondary mt-5" type="button" onClick={() => loadOrders()}><RefreshCw size={17} /> Thử lại</button></div> : loading ? <div className="p-5"><Loading rows={6} /></div> : filtered.length === 0 ? <EmptyState icon={Truck} title={orders.length ? 'Không tìm thấy phiếu nhập' : 'Chưa có phiếu nhập'} description={orders.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Tạo phiếu nhập đầu tiên để cộng hàng vào kho.'} action={!orders.length && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={17} /> Tạo phiếu nhập</button>} /> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Mã phiếu</th><th className="px-4 py-3.5">Ngày nhập</th><th className="px-4 py-3.5">Nhà cung cấp</th><th className="px-4 py-3.5 text-right">Tổng tiền</th><th className="px-4 py-3.5 text-right">Còn nợ</th><th className="px-4 py-3.5">Thanh toán</th><th className="px-5 py-3.5 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{purchasePages.pageItems.map((order) => <PurchaseRow key={order.id} order={order} onView={() => setViewing(order)} />)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{purchasePages.pageItems.map((order) => <PurchaseCard key={order.id} order={order} onView={() => setViewing(order)} />)}</div><Pagination page={purchasePages.page} pageCount={purchasePages.pageCount} pageSize={purchasePages.pageSize} total={filtered.length} onChange={purchasePages.setPage} /></>}</section><PurchaseOrderForm open={formOpen} businessId={businessId} onClose={() => setFormOpen(false)} onSave={saveOrder} /><PurchaseDetail open={Boolean(viewing)} order={viewing} businessId={businessId} onClose={() => setViewing(null)} onPaymentComplete={() => loadOrders({ quiet: true })} onCancelled={async () => { setViewing(null); showToast('Đã hủy phiếu nhập và ghi nhận các bút toán đảo.'); await loadOrders({ quiet: true }) }} /></div>
}

const metricTones = { sky: 'bg-sky-50 text-sky-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600' }
function MiniMetric({ icon: Icon, label, value, tone }) { return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">{value}</p></div></article> }
function PurchaseRow({ order, onView }) { const state = paymentState(order); return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-sm font-bold text-violet-700">{order.code}</p><p className="mt-1 text-xs text-slate-400">{statusLabels[order.status] ?? order.status}</p></td><td className="px-4 py-4 text-sm text-slate-600">{formatDateTime(order.order_date)}</td><td className="px-4 py-4 text-sm font-semibold text-slate-800">{order.supplier_name || 'Không chọn nhà cung cấp'}</td><td className="px-4 py-4 text-right text-sm font-extrabold text-slate-900">{formatCurrency(order.net_total ?? order.total)}</td><td className={`px-4 py-4 text-right text-sm font-bold ${Number(order.balance_due) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{formatCurrency(order.balance_due)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}>{state.label}</span></td><td className="px-5 py-4 text-right"><button className="btn-icon ml-auto" type="button" onClick={onView} aria-label={`Xem phiếu ${order.code}`}><Eye size={17} /></button></td></tr> }
function PurchaseCard({ order, onView }) { const state = paymentState(order); return <button className="block w-full p-4 text-left transition hover:bg-slate-50" type="button" onClick={onView}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-violet-700">{order.code}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(order.order_date)} · {order.supplier_name || 'Không chọn NCC'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${state.className}`}>{state.label}</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[11px] text-slate-400">Giá trị ròng</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatCurrency(order.net_total ?? order.total)}</p></div><div className="text-right"><p className="text-[11px] text-slate-400">Còn nợ</p><p className="mt-1 text-sm font-extrabold text-rose-600">{formatCurrency(order.balance_due)}</p></div></div></button> }
function PurchaseDetail({ open, order, businessId, onClose, onPaymentComplete, onCancelled }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  function printOrder() {
    if (!order) return
    printDocument({ title: `PHIẾU NHẬP ${order.code}`, subtitle: 'Chứng từ mua hàng', details: [['Nhà cung cấp', order.supplier_name || 'Không chọn nhà cung cấp'], ['Ngày nhập', formatDateTime(order.order_date)], ['Trạng thái', statusLabels[order.status] ?? order.status]], columns: [{ key: 'name', label: 'Sản phẩm' }, { key: 'quantity', label: 'Số lượng', align: 'right' }, { key: 'price', label: 'Giá nhập', align: 'right' }, { key: 'amount', label: 'Thành tiền', align: 'right' }], rows: items.map((item) => ({ name: item.product_name, quantity: `${formatNumber(item.quantity)} ${item.unit || ''}`, price: formatCurrency(item.unit_cost), amount: formatCurrency(item.line_total) })), totals: [['Tổng ban đầu', formatCurrency(order.total)], ...(Number(order.return_total) > 0 ? [['Hàng trả NCC', formatCurrency(-Number(order.return_total))], ['Giá trị ròng', formatCurrency(order.net_total), true]] : []), ['Đã trả', formatCurrency(order.paid_amount)], ['Còn phải trả', formatCurrency(order.balance_due), true]], note: order.note })
  }

  useEffect(() => {
    if (!open || !order) return
    setLoading(true)
    setError('')
    setPaymentOpen(false)
    getPurchaseOrderItems(businessId, order.id)
      .then(setItems)
      .catch((loadError) => setError(loadError.message || 'Không tải được chi tiết phiếu.'))
      .finally(() => setLoading(false))
  }, [open, order, businessId])

  async function handlePaymentSaved() {
    setPaymentOpen(false)
    await onPaymentComplete?.()
    onClose()
  }

  return <Modal open={open} onClose={onClose} title={order ? 'Phiếu nhập ' + order.code : 'Chi tiết phiếu nhập'} description={order ? (order.supplier_name || 'Không chọn nhà cung cấp') + ' · ' + formatDateTime(order.order_date) : ''} size="lg" footer={<>{order && <button className="btn-secondary" type="button" onClick={printOrder} disabled={loading}><Printer size={17} /> In</button>}{order?.status !== 'cancelled' && <button className="btn-secondary text-rose-600" type="button" onClick={() => setCancelOpen(true)}><Ban size={17} /> Hủy phiếu</button>}{order && Number(order.balance_due) > 0 && order.status !== 'cancelled' && order.status !== 'draft' && <button className="btn-primary" type="button" onClick={() => setPaymentOpen(true)}><Banknote size={17} /> Trả tiền NCC</button>}<button className="btn-secondary" type="button" onClick={onClose}>Đóng</button></>}>
    {!order ? null : <div className="space-y-5">
      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : loading ? <Loading rows={3} /> : <div className="overflow-hidden rounded-2xl border border-slate-200"><div className="divide-y divide-slate-100">{items.map((item) => <div className="flex items-center gap-3 p-4" key={item.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Truck size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.product_name}</p><p className="mt-1 text-xs text-slate-400">{formatNumber(item.quantity)} {item.unit} × {formatCurrency(item.unit_cost)}</p></div><p className="text-sm font-extrabold text-slate-900">{formatCurrency(item.line_total)}</p></div>)}</div></div>}
      <div className="ml-auto max-w-sm space-y-2 rounded-2xl bg-slate-50 p-5 text-sm"><MoneyRow label="Tiền hàng" value={order.subtotal} /><MoneyRow label="Giảm giá" value={-Number(order.discount || 0)} /><MoneyRow label="Phí vận chuyển" value={order.shipping_fee} /><MoneyRow label="VAT" value={order.vat_amount} /><div className="border-t border-slate-200 pt-3"><MoneyRow label="Tổng ban đầu" value={order.total} strong /></div>{Number(order.return_total) > 0 && <><MoneyRow label="Hàng trả NCC" value={-Number(order.return_total)} /><MoneyRow label="Giá trị ròng" value={order.net_total} strong /></>}<MoneyRow label="Đã trả NCC" value={order.paid_amount} /><MoneyRow label="Còn phải trả" value={order.balance_due} strong danger={Number(order.balance_due) > 0} /></div>
      {order.note && <p className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600"><span className="font-bold text-slate-800">Ghi chú:</span> {order.note}</p>}
    </div>}
    <PurchasePaymentForm open={paymentOpen} order={order} businessId={businessId} onClose={() => setPaymentOpen(false)} onSaved={handlePaymentSaved} />
    <CancelDocumentModal open={cancelOpen} title={order ? `Hủy phiếu ${order.code}?` : 'Hủy phiếu nhập?'} description="Kho và các khoản chi liên quan sẽ được đảo tự động." onClose={() => setCancelOpen(false)} onConfirm={async (reason) => { await cancelPurchaseOrder(businessId, order.id, reason); setCancelOpen(false); await onCancelled() }} />
  </Modal>
}

function MoneyRow({ label, value, strong = false, danger = false }) {
  return <div className={'flex justify-between gap-4 ' + (strong ? 'font-extrabold ' : '') + (danger ? 'text-rose-600' : 'text-slate-700')}><span>{label}</span><span>{formatCurrency(value)}</span></div>
}

function PurchasePaymentForm({ open, order, businessId, onClose, onSaved }) {
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
    setAmount(order.balance_due == null ? '' : String(order.balance_due))
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
    if (!accountId) return setError('Vui lòng chọn tài khoản chi tiền.')
    if (numericAmount <= 0 || numericAmount > Number(order.balance_due)) return setError('Số tiền trả không hợp lệ.')
    setSaving(true)
    setError('')
    try {
      await recordPurchasePayment(businessId, { purchaseOrderId: order.id, amount: numericAmount, accountId, paymentMethod, note: note.trim() })
      await onSaved()
    } catch (saveError) {
      setError(saveError.message || 'Không thể ghi nhận thanh toán.')
    } finally {
      setSaving(false)
    }
  }

  return <Modal open={open} onClose={saving ? () => {} : onClose} title={order ? 'Trả tiền phiếu ' + order.code : 'Trả tiền'} description={order ? 'Còn phải trả: ' + formatCurrency(order.balance_due) : ''} size="sm" footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="purchase-payment-form" disabled={saving || loading || !accounts.length}><Banknote size={17} /> {saving ? 'Đang lưu...' : 'Ghi nhận chi'}</button></>}><form id="purchase-payment-form" className="space-y-5" onSubmit={submit}><Field label="Tài khoản chi tiền"><select className="field" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={loading}><option value="">{loading ? 'Đang tải...' : 'Chọn tài khoản'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Số tiền trả"><input className="field text-right text-lg font-bold" type="number" min="0.01" max={order?.balance_due} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></Field><Field label="Phương thức"><select className="field" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="card">Thẻ</option><option value="other">Khác</option></select></Field><Field label="Ghi chú"><textarea className="field min-h-20 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú khoản chi" /></Field>{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}</form></Modal>
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label> }
