/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { Banknote, PackagePlus, RotateCcw, Save, ShoppingBag, Truck } from 'lucide-react'
import Modal from '../common/Modal'
import Loading from '../common/Loading'
import { getPurchaseOrderItems, listPurchaseOrders } from '../../services/purchaseService'
import { getSalesOrderItems, listSalesOrders } from '../../services/salesService'
import { listFinanceAccounts } from '../../services/financeService'
import { formatCurrency, formatNumber, localDateKey } from '../../lib/formatters'

const initialForm = { returnDate: localDateKey(), reason: '', note: '', refundNow: false, accountId: '', paymentMethod: 'cash' }

function isActiveDocument(order) {
  return !['cancelled', 'canceled', 'draft'].includes(String(order?.status || '').toLowerCase())
}

export default function ReturnForm({ open, businessId, initialType = 'sales', onClose, onSave }) {
  const [type, setType] = useState(initialType)
  const [form, setForm] = useState(initialForm)
  const [salesOrders, setSalesOrders] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [accounts, setAccounts] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dataError, setDataError] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [items, setItems] = useState([])

  const orders = useMemo(() => (type === 'sales' ? salesOrders : purchaseOrders).filter(isActiveDocument), [purchaseOrders, salesOrders, type])
  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const total = useMemo(() => {
    const sourceSubtotal = Number(selectedOrder?.subtotal) || 0
    const sourceDiscount = Number(selectedOrder?.discount) || 0
    const vatRate = Number(selectedOrder?.vat_rate) || 0
    return items.reduce((sum, item) => {
      const base = (Number(item.return_quantity) || 0) * (Number(type === 'sales' ? item.unit_price : item.unit_cost) || 0)
      const discountShare = sourceSubtotal > 0 ? sourceDiscount * base / sourceSubtotal : 0
      const taxable = Math.max(0, base - discountShare)
      return sum + taxable + taxable * vatRate / 100
    }, 0)
  }, [items, selectedOrder, type])

  useEffect(() => {
    if (!open || !businessId) return
    setType(initialType)
    setForm({ ...initialForm, returnDate: localDateKey() })
    setSelectedOrderId('')
    setItems([])
    setError('')
    setDataError('')
    setOrdersLoading(true)
    Promise.all([listSalesOrders(businessId), listPurchaseOrders(businessId)])
      .then(([sales, purchases]) => {
        setSalesOrders(sales)
        setPurchaseOrders(purchases)
      })
      .catch((loadError) => setDataError(loadError.message || 'Không tải được danh sách chứng từ gốc.'))
      .finally(() => setOrdersLoading(false))
    listFinanceAccounts(businessId)
      .then((rows) => setAccounts(rows))
      .catch((loadError) => setDataError((current) => current || loadError.message || 'Không tải được tài khoản tiền.'))
  }, [businessId, initialType, open])

  useEffect(() => {
    if (!open || !businessId || !selectedOrderId) {
      setItems([])
      return
    }
    setItemsLoading(true)
    setError('')
    const loadItems = type === 'sales' ? getSalesOrderItems(businessId, selectedOrderId) : getPurchaseOrderItems(businessId, selectedOrderId)
    loadItems
      .then((rows) => setItems(rows.map((item) => ({ ...item, return_quantity: '0' }))))
      .catch((loadError) => setError(loadError.message || 'Không tải được sản phẩm trong chứng từ.'))
      .finally(() => setItemsLoading(false))
  }, [businessId, open, selectedOrderId, type])

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function changeType(value) {
    setType(value)
    setSelectedOrderId('')
    setItems([])
    setError('')
  }

  function updateQuantity(productId, value) {
    setItems((current) => current.map((item) => item.product_id === productId ? { ...item, return_quantity: value } : item))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    const selectedItems = items.filter((item) => Number(item.return_quantity) > 0)
    if (!selectedOrderId) return setError('Vui lòng chọn chứng từ gốc.')
    if (!selectedItems.length) return setError('Vui lòng chọn ít nhất một sản phẩm cần trả.')
    if (selectedItems.some((item) => Number(item.return_quantity) > Number(item.quantity))) return setError('Số lượng trả không được vượt quá số lượng trên chứng từ.')
    if (!form.reason.trim()) return setError('Vui lòng ghi rõ lý do trả hàng.')
    if (form.refundNow && !form.accountId) return setError('Vui lòng chọn tài khoản nhận/chi tiền.')

    setSaving(true)
    try {
      const orderField = type === 'sales' ? 'sales_order_id' : 'purchase_order_id'
      await onSave({
        type,
        return: {
          [orderField]: selectedOrderId,
          return_date: form.returnDate,
          reason: form.reason.trim(),
          note: form.note.trim() || null,
          refund_amount: total,
          refund_now: form.refundNow,
          account_id: form.refundNow ? form.accountId : null,
          payment_method: form.refundNow ? form.paymentMethod : null,
        },
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          sales_order_item_id: type === 'sales' ? item.id : null,
          purchase_order_item_id: type === 'purchase' ? item.id : null,
          quantity: Number(item.return_quantity),
        })),
      })
    } catch (saveError) {
      setError(saveError.message || 'Không thể tạo phiếu trả hàng.')
    } finally {
      setSaving(false)
    }
  }

  const partnerLabel = type === 'sales' ? (selectedOrder?.customer_name || 'Khách lẻ') : (selectedOrder?.supplier_name || 'Không chọn nhà cung cấp')
  const orderLabel = type === 'sales' ? 'Đơn bán cần trả' : 'Phiếu nhập cần trả'
  const itemLabel = type === 'sales' ? 'Sản phẩm khách trả' : 'Sản phẩm trả lại NCC'

  return <Modal open={open} onClose={saving ? () => {} : onClose} title={type === 'sales' ? 'Tạo phiếu trả hàng bán' : 'Tạo phiếu trả hàng nhập'} description="Phiếu sẽ cập nhật tồn kho theo từng sản phẩm và ghi nhận hoàn tiền nếu bạn chọn hoàn ngay." size="lg" footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="return-form" disabled={saving || ordersLoading || itemsLoading}><Save size={17} /> {saving ? 'Đang lưu...' : 'Tạo phiếu trả hàng'}</button></>}>
    <form id="return-form" className="space-y-6" onSubmit={submit}>
      <fieldset>
        <legend className="form-section-title"><RotateCcw size={18} /> Chứng từ trả hàng</legend>
        <div className="form-grid">
          <Field label="Loại phiếu"><select className="field" value={type} onChange={(event) => changeType(event.target.value)} disabled={saving}><option value="sales">Trả hàng bán</option><option value="purchase">Trả hàng nhập</option></select></Field>
          <Field label="Ngày trả"><input className="field" type="date" value={form.returnDate} onChange={(event) => updateForm('returnDate', event.target.value)} required /></Field>
          <Field label={orderLabel} className="sm:col-span-2"><select className="field" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} disabled={ordersLoading || saving} required><option value="">{ordersLoading ? 'Đang tải chứng từ...' : 'Chọn chứng từ gốc'}</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.code} · {type === 'sales' ? (order.customer_name || 'Khách lẻ') : (order.supplier_name || 'Không chọn NCC')} · {formatCurrency(order.total)}</option>)}</select></Field>
        </div>
        {selectedOrder && <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-600">{type === 'sales' ? <ShoppingBag size={17} /> : <Truck size={17} />}</span><div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{selectedOrder.code}</p><p className="mt-0.5 truncate text-xs text-slate-500">{partnerLabel} · Tổng {formatCurrency(selectedOrder.total)}</p></div></div>}
      </fieldset>

      <fieldset>
        <legend className="form-section-title"><PackagePlus size={18} /> {itemLabel}</legend>
        {itemsLoading ? <Loading rows={3} /> : !selectedOrderId ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">Chọn chứng từ gốc để xem sản phẩm.</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">Chứng từ này không có sản phẩm để trả.</div> : <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{items.map((item) => { const unitValue = Number(type === 'sales' ? item.unit_price : item.unit_cost) || 0; const quantity = Number(item.return_quantity) || 0; return <div className="p-4" key={item.id}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><PackagePlus size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.product_name}</p><p className="mt-1 text-xs text-slate-400">{item.product_code || 'Chưa có mã'} · {item.unit} · Có thể trả tối đa {formatNumber(item.quantity)}</p></div><p className="shrink-0 text-sm font-extrabold text-slate-900">{formatCurrency(quantity * unitValue)}</p></div><div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3"><Field label="Số lượng trả"><input className="field text-right text-lg font-bold" type="number" min="0" max={item.quantity} step="0.001" value={item.return_quantity} onChange={(event) => updateQuantity(item.product_id, event.target.value)} /></Field><span className="pb-3 text-xs font-semibold text-slate-400">/ {formatNumber(item.quantity)} {item.unit}</span></div></div> })}</div>}
      </fieldset>

      <fieldset>
        <legend className="form-section-title"><Banknote size={18} /> Hoàn tiền và ghi chú</legend>
        <div className="rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-center justify-between gap-4"><span className="text-sm text-white/70">Giá trị trả dự kiến</span><strong className="text-xl">{formatCurrency(total)}</strong></div><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white/10 p-3"><input className="mt-1 size-4 accent-sky-500" type="checkbox" checked={form.refundNow} onChange={(event) => updateForm('refundNow', event.target.checked)} /><span><span className="block text-sm font-bold">{type === 'sales' ? 'Hoàn tiền cho khách ngay' : 'Nhận tiền từ NCC ngay'}</span><span className="mt-1 block text-xs text-white/60">Bỏ chọn nếu muốn đối soát công nợ sau.</span></span></label></div>
        {form.refundNow && <div className="mt-4 form-grid"><Field label={type === 'sales' ? 'Tài khoản chi hoàn tiền' : 'Tài khoản nhận tiền'}><select className="field" value={form.accountId} onChange={(event) => updateForm('accountId', event.target.value)} disabled={!accounts.length || saving}><option value="">{accounts.length ? 'Chọn tài khoản' : 'Chưa có tài khoản tiền'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Phương thức"><select className="field" value={form.paymentMethod} onChange={(event) => updateForm('paymentMethod', event.target.value)}><option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="card">Thẻ</option><option value="other">Khác</option></select></Field></div>}
        <div className="mt-4 form-grid"><Field label="Lý do trả hàng"><input className="field" value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} placeholder="Ví dụ: Hàng lỗi, giao nhầm..." required /></Field><Field label="Ghi chú"><textarea className="field min-h-20 resize-y" value={form.note} onChange={(event) => updateForm('note', event.target.value)} placeholder="Thông tin bổ sung cho phiếu trả" /></Field></div>
      </fieldset>

      {(dataError || error) && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error || dataError}</div>}
    </form>
  </Modal>
}

function Field({ label, className = '', children }) {
  return <label className={'block ' + className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}
