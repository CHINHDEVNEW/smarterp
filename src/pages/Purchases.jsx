/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Banknote, CircleDollarSign, Eye, Plus, Printer, RefreshCw, Truck } from 'lucide-react'
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

import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'

const statusLabels = { draft: 'Bản nháp', confirmed: 'Đã xác nhận', completed: 'Hoàn tất', cancelled: 'Đã hủy' }

function paymentState(order) {
  if (order.status === 'cancelled') return { label: 'Đã hủy', tone: 'slate' }
  if (order.payment_status === 'paid') return { label: 'Đã thanh toán', tone: 'emerald' }
  if (order.payment_status === 'partial') return { label: 'Thanh toán một phần', tone: 'amber' }
  return { label: 'Chưa thanh toán', tone: 'rose' }
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
    try {
      setOrders(await listPurchaseOrders(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được danh sách phiếu nhập. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToPurchaseOrders(businessId, () => loadOrders({ quiet: true }))
  }, [businessId, loadOrders])

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return orders.filter((order) => {
      if (status !== 'all' && order.status !== status && order.payment_status !== status) return false
      if (!needle) return true
      return [order.code, order.supplier_name, order.note].some((value) =>
        String(value ?? '').toLocaleLowerCase('vi').includes(needle),
      )
    })
  }, [orders, search, status])

  const stats = useMemo(() => {
    const valid = orders.filter((order) => order.status !== 'cancelled' && order.status !== 'draft')
    return {
      count: valid.length,
      total: valid.reduce((sum, order) => sum + (Number(order.net_total ?? order.total) || 0), 0),
      due: valid.reduce((sum, order) => sum + (Number(order.balance_due) || 0), 0),
    }
  }, [orders])

  const purchasePages = usePagination(filtered, `${search}\u0000${status}`)

  async function saveOrder(payload) {
    const created = await createPurchaseOrder(businessId, payload.order, payload.items)
    showToast(`Đã tạo phiếu ${created?.code || 'nhập hàng'}.`)
    setFormOpen(false)
    await loadOrders({ quiet: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Giao dịch đầu vào"
        title="Mua hàng"
        description="Theo dõi phiếu nhập hàng, giá vốn sản phẩm và công nợ phải trả nhà cung cấp."
        actions={
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Tạo phiếu nhập
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <MetricCard icon={Truck} label="Số phiếu nhập" value={formatNumber(stats.count)} tone="sky" />
        <MetricCard icon={CircleDollarSign} label="Tổng giá trị nhập" value={formatCurrency(stats.total)} tone="emerald" />
        <MetricCard icon={Banknote} label="Còn phải trả NCC" value={formatCurrency(stats.due)} tone="rose" />
      </section>

      <section className="surface overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Tìm mã phiếu hoặc nhà cung cấp..."
          onRefresh={() => loadOrders()}
          loading={loading}
        >
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'unpaid', label: 'Chưa TT' },
              { id: 'partial', label: 'Một phần' },
              { id: 'paid', label: 'Đã TT' },
              { id: 'completed', label: 'Hoàn tất' },
              { id: 'cancelled', label: 'Đã hủy' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  status === item.id
                    ? item.id === 'paid' || item.id === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : item.id === 'unpaid'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : item.id === 'partial'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80'
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
            <Truck className="text-rose-500" size={32} />
            <p className="mt-3 text-sm font-semibold text-slate-700">{error}</p>
            <button className="btn-secondary mt-4" type="button" onClick={() => loadOrders()}>
              <RefreshCw size={16} /> Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="p-5"><Loading rows={6} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={orders.length ? 'Không tìm thấy phiếu nhập' : 'Chưa có phiếu nhập'}
            description={orders.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Tạo phiếu nhập đầu tiên để cộng hàng vào kho.'}
            action={!orders.length && <button className="btn-primary" type="button" onClick={() => setFormOpen(true)}><Plus size={16} /> Tạo phiếu nhập</button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Mã phiếu</th>
                    <th className="px-4 py-3.5">Ngày nhập</th>
                    <th className="px-4 py-3.5">Nhà cung cấp</th>
                    <th className="px-4 py-3.5 text-right">Tổng tiền</th>
                    <th className="px-4 py-3.5 text-right">Còn nợ</th>
                    <th className="px-4 py-3.5">Thanh toán</th>
                    <th className="px-5 py-3.5 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchasePages.pageItems.map((order) => (
                    <PurchaseRow key={order.id} order={order} onView={() => setViewing(order)} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {purchasePages.pageItems.map((order) => (
                <PurchaseCard key={order.id} order={order} onView={() => setViewing(order)} />
              ))}
            </div>

            <Pagination
              page={purchasePages.page}
              pageCount={purchasePages.pageCount}
              pageSize={purchasePages.pageSize}
              total={filtered.length}
              onChange={purchasePages.setPage}
            />
          </>
        )}
      </section>

      <PurchaseOrderForm open={formOpen} businessId={businessId} onClose={() => setFormOpen(false)} onSave={saveOrder} />
      <PurchaseDetail
        open={Boolean(viewing)}
        order={viewing}
        businessId={businessId}
        onClose={() => setViewing(null)}
        onPaymentComplete={() => loadOrders({ quiet: true })}
        onCancelled={async () => {
          setViewing(null)
          showToast('Đã hủy phiếu nhập và ghi nhận các bút toán đảo.')
          await loadOrders({ quiet: true })
        }}
      />
    </div>
  )
}

function PurchaseRow({ order, onView }) {
  const state = paymentState(order)
  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-5 py-3.5">
        <p className="text-sm font-bold text-sky-700">{order.code}</p>
        <p className="mt-0.5 text-xs text-slate-400">{statusLabels[order.status] ?? order.status}</p>
      </td>
      <td className="px-4 py-3.5 text-xs font-medium text-slate-600">{formatDateTime(order.order_date)}</td>
      <td className="px-4 py-3.5 text-sm font-bold text-slate-900">{order.supplier_name || 'Không chọn NCC'}</td>
      <td className="tabular-nums px-4 py-3.5 text-right text-sm font-black text-slate-900">
        {formatCurrency(order.net_total ?? order.total)}
      </td>
      <td className={`tabular-nums px-4 py-3.5 text-right text-sm font-black ${Number(order.balance_due) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
        {formatCurrency(order.balance_due)}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge label={state.label} tone={state.tone} size="sm" />
      </td>
      <td className="px-5 py-3.5 text-right">
        <button
          className="btn-icon ml-auto"
          type="button"
          onClick={onView}
          aria-label={`Xem phiếu ${order.code}`}
          title="Xem chi tiết"
        >
          <Eye size={16} />
        </button>
      </td>
    </tr>
  )
}

function PurchaseCard({ order, onView }) {
  const state = paymentState(order)
  return (
    <button
      className="block w-full p-4 text-left transition hover:bg-slate-50/70"
      type="button"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-sky-700">{order.code}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDateTime(order.order_date)} · {order.supplier_name || 'Không chọn NCC'}
          </p>
        </div>
        <StatusBadge label={state.label} tone={state.tone} size="sm" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50/80 p-2.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Giá trị ròng</p>
          <p className="tabular-nums mt-0.5 text-sm font-extrabold text-slate-900">
            {formatCurrency(order.net_total ?? order.total)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Còn nợ</p>
          <p className={`tabular-nums mt-0.5 text-sm font-extrabold ${Number(order.balance_due) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
            {formatCurrency(order.balance_due)}
          </p>
        </div>
      </div>
    </button>
  )
}

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? 'Phiếu nhập ' + order.code : 'Chi tiết phiếu nhập'}
      description={order ? (order.supplier_name || 'Không chọn nhà cung cấp') + ' · ' + formatDateTime(order.order_date) : ''}
      size="lg"
      icon={Truck}
      tone="sky"
      badge="Phiếu nhập hàng"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {order && (
            <button className="btn-secondary flex-1 sm:flex-initial" type="button" onClick={printOrder} disabled={loading}>
              <Printer size={17} /> In
            </button>
          )}
          {order?.status !== 'cancelled' && (
            <button className="btn-secondary text-rose-600 flex-1 sm:flex-initial" type="button" onClick={() => setCancelOpen(true)}>
              <Ban size={17} /> Hủy phiếu
            </button>
          )}
          {order && Number(order.balance_due) > 0 && order.status !== 'cancelled' && order.status !== 'draft' && (
            <button className="btn-primary flex-1 sm:flex-initial" type="button" onClick={() => setPaymentOpen(true)}>
              <Banknote size={17} /> Trả tiền NCC
            </button>
          )}
          <button className="btn-secondary flex-1 sm:flex-initial" type="button" onClick={onClose}>
            Đóng
          </button>
        </div>
      }
    >
    {!order ? null : <div className="space-y-5">
      {error ? <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : loading ? <Loading rows={3} /> : <div className="overflow-hidden rounded-2xl border border-slate-200"><div className="divide-y divide-slate-100">{items.map((item) => <div className="flex items-center gap-3 p-4" key={item.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Truck size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.product_name}</p><p className="mt-1 text-xs text-slate-400">{formatNumber(item.quantity)} {item.unit} × {formatCurrency(item.unit_cost)}</p></div><p className="text-sm font-extrabold text-slate-900">{formatCurrency(item.line_total)}</p></div>)}</div></div>}
      <div className="ml-auto max-w-sm space-y-2 rounded-2xl bg-slate-50 p-5 text-sm"><MoneyRow label="Tiền hàng" value={order.subtotal} /><MoneyRow label="Giảm giá" value={-Number(order.discount || 0)} /><MoneyRow label="Phí vận chuyển" value={order.shipping_fee} /><MoneyRow label="VAT" value={order.vat_amount} /><div className="border-t border-slate-200 pt-3"><MoneyRow label="Tổng ban đầu" value={order.total} strong /></div>{Number(order.return_total) > 0 && <><MoneyRow label="Hàng trả NCC" value={-Number(order.return_total)} /><MoneyRow label="Giá trị ròng" value={order.net_total} strong /></>}<MoneyRow label="Đã trả NCC" value={order.paid_amount} /><MoneyRow label="Còn phải trả" value={order.balance_due} strong danger={Number(order.balance_due) > 0} /></div>
      {order.note && <p className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-600"><span className="font-bold text-slate-800">Ghi chú:</span> {order.note}</p>}
    </div>}
    <PurchasePaymentForm open={paymentOpen} order={order} businessId={businessId} onClose={() => setPaymentOpen(false)} onSaved={handlePaymentSaved} />
    <CancelDocumentModal open={cancelOpen} title={order ? `Hủy phiếu ${order.code}?` : 'Hủy phiếu nhập?'} description="Kho và các khoản chi liên quan sẽ được đảo tự động." onClose={() => setCancelOpen(false)} onConfirm={async (reason) => { await cancelPurchaseOrder(businessId, order.id, reason); setCancelOpen(false); await onCancelled() }} />
    </Modal>
  )
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

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={order ? 'Trả tiền phiếu ' + order.code : 'Trả tiền'}
      description={order ? 'Còn phải trả: ' + formatCurrency(order.balance_due) : ''}
      size="sm"
      icon={Banknote}
      tone="rose"
      badge="Chi tiền NCC"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            className="btn-primary w-full sm:w-auto"
            type="submit"
            form="purchase-payment-form"
            disabled={saving || loading || !accounts.length}
          >
            <Banknote size={17} />
            <span>{saving ? 'Đang lưu...' : 'Ghi nhận chi'}</span>
          </button>
        </div>
      }
    >
      <form id="purchase-payment-form" className="space-y-4" onSubmit={submit}>
        <Field label="Tài khoản chi tiền">
          <select
            className="field"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={loading}
          >
            <option value="">{loading ? 'Đang tải...' : 'Chọn tài khoản'}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Số tiền trả">
          <input
            className="field tabular-nums text-right text-lg font-bold"
            type="number"
            min="0.01"
            max={order?.balance_due}
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>

        <Field label="Phương thức">
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
        </Field>

        <Field label="Ghi chú">
          <textarea
            className="field min-h-20 resize-y"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ghi chú khoản chi"
          />
        </Field>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}
