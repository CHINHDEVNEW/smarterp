/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Minus, PackagePlus, Plus, Save, ShoppingCart, Trash2, Truck } from 'lucide-react'
import Modal from '../common/Modal'
import { listProducts } from '../../services/productService'
import { listSuppliers } from '../../services/supplierService'
import { formatCurrency, localDateKey } from '../../lib/formatters'
import useBusiness from '../../hooks/useBusiness'
import { clearFormDraft, formDraftKey, loadFormDraft, saveFormDraft } from '../../lib/formDraft'

const initialOrder = { supplier_id: '', order_date: localDateKey(), due_date: '', discount: '0', shipping_fee: '0', vat_rate: '0', note: '' }

export default function PurchaseOrderForm({ open, businessId, onClose, onSave }) {
  const { settings } = useBusiness()
  const defaultVat = Number(settings?.default_vat) || 0
  const [order, setOrder] = useState(initialOrder)
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [items, setItems] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const draftKey = formDraftKey(businessId, 'purchase-new')

  useEffect(() => {
    if (!open || !businessId) return
    const draft = loadFormDraft(draftKey)
    setOrder(draft?.order ?? { ...initialOrder, order_date: localDateKey(), vat_rate: String(defaultVat) })
    setItems(Array.isArray(draft?.items) ? draft.items : [])
    setSelectedProductId('')
    setError('')
    setLoadingData(true)
    Promise.all([listProducts(businessId), listSuppliers(businessId)])
      .then(([productRows, supplierRows]) => {
        setProducts(productRows.filter((product) => product.active))
        setSuppliers(supplierRows.filter((supplier) => supplier.active))
      })
      .catch((loadError) => setError(loadError.message || 'Không tải được dữ liệu lập phiếu nhập.'))
      .finally(() => setLoadingData(false))
  }, [businessId, defaultVat, draftKey, open])

  useEffect(() => {
    if (open) saveFormDraft(draftKey, { order, items })
  }, [draftKey, items, open, order])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0), 0), [items])
  const discount = Math.max(0, Number(order.discount) || 0)
  const shippingFee = Math.max(0, Number(order.shipping_fee) || 0)
  const vatAmount = Math.max(0, subtotal - discount) * Math.max(0, Number(order.vat_rate) || 0) / 100
  const total = Math.max(0, subtotal - discount + shippingFee + vatAmount)

  function updateOrder(field, value) {
    setOrder((current) => ({ ...current, [field]: value }))
  }

  function addProduct() {
    const product = products.find((row) => row.id === selectedProductId)
    if (!product) return
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.id)
      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: String((Number(item.quantity) || 0) + 1) }
            : item
        )
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          code: product.code,
          unit: product.unit,
          product_type: product.product_type,
          quantity: '1',
          unit_cost: String(product.cost_price ?? 0),
        },
      ]
    })
    setSelectedProductId('')
  }

  function updateItem(productId, field, value) {
    setItems((current) => current.map((item) => item.product_id === productId ? { ...item, [field]: value } : item))
  }

  function removeItem(productId) {
    setItems((current) => current.filter((item) => item.product_id !== productId))
  }

  function closeForm() {
    clearFormDraft(draftKey)
    onClose()
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!order.order_date) return setError('Vui lòng chọn ngày nhập hàng.')
    if (order.due_date && order.due_date < order.order_date) return setError('Hạn thanh toán không được trước ngày nhập hàng.')
    if (!items.length) return setError('Vui lòng thêm ít nhất một sản phẩm vào phiếu.')
    const normalizedItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      unit_cost: Number(item.unit_cost),
      note: null,
    }))
    if (normalizedItems.some((item) => !item.product_id || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_cost) || item.unit_cost < 0)) return setError('Số lượng và giá nhập phải hợp lệ.')
    if (discount > subtotal) return setError('Tiền giảm giá không được lớn hơn tiền hàng.')
    setSaving(true)
    try {
      await onSave({
        order: {
          supplier_id: order.supplier_id || null,
          order_date: order.order_date,
          due_date: order.due_date || null,
          discount,
          shipping_fee: shippingFee,
          vat_rate: Math.max(0, Number(order.vat_rate) || 0),
          note: order.note.trim() || null,
        },
        items: normalizedItems,
      })
      clearFormDraft(draftKey)
    } catch (saveError) {
      setError(saveError.message || 'Không thể tạo phiếu nhập.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : closeForm}
      title="Tạo phiếu nhập hàng"
      description="Phiếu được xác nhận ngay và tự động cộng vào tồn kho."
      size="lg"
      icon={Truck}
      tone="sky"
      badge="Phiếu nhập hàng"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeForm} disabled={saving}>
            Hủy
          </button>
          <button className="btn-primary w-full sm:w-auto" type="submit" form="purchase-form" disabled={saving || loadingData}>
            <Save size={17} />
            <span>{saving ? 'Đang tạo phiếu...' : 'Xác nhận phiếu nhập'}</span>
          </button>
        </div>
      }
    >
      <form id="purchase-form" className="space-y-6" onSubmit={submit}>
        <fieldset>
          <legend className="form-section-title"><Truck size={18} /> Nhà cung cấp và thời gian</legend>
          <div className="form-grid">
            <Field label="Nhà cung cấp (tùy chọn)" className="sm:col-span-2">
              <select className="field" value={order.supplier_id} onChange={(event) => updateOrder('supplier_id', event.target.value)} disabled={loadingData}>
                <option value="">Không chọn nhà cung cấp</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Ngày nhập" required>
              <input className="field" type="date" value={order.order_date} onChange={(event) => updateOrder('order_date', event.target.value)} required />
            </Field>
            <Field label="Hạn thanh toán">
              <input className="field" type="date" min={order.order_date} value={order.due_date} onChange={(event) => updateOrder('due_date', event.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><ShoppingCart size={18} /> Sản phẩm nhập <span className="text-rose-500">*</span></legend>
          <div className="flex gap-2">
            <select className="field min-w-0 flex-1" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={loadingData}>
              <option value="">{loadingData ? 'Đang tải sản phẩm...' : 'Chọn sản phẩm để thêm'}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name} · Giá vốn {formatCurrency(product.cost_price)}</option>
              ))}
            </select>
            <button className="btn-secondary shrink-0" type="button" onClick={addProduct} disabled={!selectedProductId}>
              <PackagePlus size={17} />
              <span className="hidden sm:inline">Thêm</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Chưa có sản phẩm trong phiếu.
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {items.map((item) => (
                <div className="p-4" key={item.product_id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.code || 'Chưa có mã'} · {item.unit}</p>
                    </div>
                    <button className="btn-icon -mr-2 -mt-2 text-rose-500" type="button" onClick={() => removeItem(item.product_id)} aria-label={`Xóa ${item.name}`}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                    <Field label="Số lượng" required>
                      <div className="flex">
                        <button className="grid w-10 place-items-center rounded-l-xl border border-r-0 border-slate-200 text-slate-500" type="button" onClick={() => updateItem(item.product_id, 'quantity', String(Math.max(1, (Number(item.quantity) || 1) - 1)))}>
                          <Minus size={15} />
                        </button>
                        <input className="field rounded-none text-center" type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.product_id, 'quantity', event.target.value)} required />
                        <button className="grid w-10 place-items-center rounded-r-xl border border-l-0 border-slate-200 text-slate-500" type="button" onClick={() => updateItem(item.product_id, 'quantity', String((Number(item.quantity) || 0) + 1))}>
                          <Plus size={15} />
                        </button>
                      </div>
                    </Field>
                    <Field label="Giá nhập" required>
                      <input className="field text-right" type="number" min="0" step="1" value={item.unit_cost} onChange={(event) => updateItem(item.product_id, 'unit_cost', event.target.value)} required />
                    </Field>
                    <div className="col-span-2 text-right sm:col-span-1 sm:min-w-32">
                      <p className="text-xs font-medium text-slate-400">Thành tiền</p>
                      <p className="tabular-nums mt-2 text-sm font-extrabold text-slate-900">{formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><CalendarDays size={18} /> Chi phí nhập</legend>
          <div className="form-grid">
            <Field label="Giảm giá">
              <input className="field text-right" type="number" min="0" step="1" value={order.discount} onChange={(event) => updateOrder('discount', event.target.value)} />
            </Field>
            <Field label="Phí vận chuyển">
              <input className="field text-right" type="number" min="0" step="1" value={order.shipping_fee} onChange={(event) => updateOrder('shipping_fee', event.target.value)} />
            </Field>
            <Field label="VAT (%)">
              <input className="field text-right" type="number" min="0" step="0.1" value={order.vat_rate} onChange={(event) => updateOrder('vat_rate', event.target.value)} />
            </Field>
            <Field label="Ghi chú">
              <input className="field" value={order.note} onChange={(event) => updateOrder('note', event.target.value)} placeholder="Ghi chú trên phiếu" />
            </Field>
          </div>
          <div className="mt-4 space-y-2 rounded-2xl bg-slate-950 p-5 text-sm text-white">
            <SummaryRow label="Tiền hàng" value={formatCurrency(subtotal)} />
            <SummaryRow label="Giảm giá" value={`− ${formatCurrency(discount)}`} muted />
            <SummaryRow label="Phí vận chuyển" value={formatCurrency(shippingFee)} muted />
            <SummaryRow label={`VAT (${Number(order.vat_rate) || 0}%)`} value={formatCurrency(vatAmount)} muted />
            <div className="my-3 border-t border-white/10" />
            <SummaryRow label="Tổng phiếu nhập" value={formatCurrency(total)} strong />
          </div>
        </fieldset>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      </form>
    </Modal>
  )
}

function Field({ label, required = false, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  )
}

function SummaryRow({ label, value, muted = false, strong = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${muted ? 'text-white/60' : ''} ${strong ? 'text-base font-extrabold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
