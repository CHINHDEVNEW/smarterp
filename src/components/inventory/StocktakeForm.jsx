/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Save, Search } from 'lucide-react'
import Modal from '../common/Modal'
import { formatCurrency, formatNumber, localDateKey } from '../../lib/formatters'

function initialValues(products) {
  return Object.fromEntries(products.map((product) => [product.id, String(Number(product.stock_on_hand) || 0)]))
}

function currentStock(product) {
  return Number(product.stock_on_hand) || 0
}

export default function StocktakeForm({ open, products, onClose, onSave }) {
  const [date, setDate] = useState(localDateKey())
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setDate(localDateKey())
    setNote('')
    setSearch('')
    setValues(initialValues(products))
    setError('')
  }, [open, products])

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    if (!needle) return products
    return products.filter((product) => [product.name, product.code, product.sku].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle)))
  }, [products, search])

  const summary = useMemo(() => products.reduce((result, product) => {
    const systemQuantity = currentStock(product)
    const rawValue = values[product.id]
    const actualQuantity = rawValue === undefined || rawValue === '' ? systemQuantity : Number(rawValue)
    const difference = (Number.isFinite(actualQuantity) ? actualQuantity : 0) - systemQuantity
    result.changed += difference === 0 ? 0 : 1
    result.difference += difference
    result.value += difference * (Number(product.cost_price) || 0)
    return result
  }, { changed: 0, difference: 0, value: 0 }), [products, values])

  function updateQuantity(productId, value) {
    setValues((current) => ({ ...current, [productId]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!date) return setError('Vui lòng chọn ngày kiểm kê.')
    if (!note.trim()) return setError('Vui lòng ghi chú lý do kiểm kê.')
    if (!products.length) return setError('Chưa có sản phẩm hàng hóa để kiểm kê.')

    const items = []
    for (const product of products) {
      const rawValue = String(values[product.id] ?? '').trim()
      const actualQuantity = Number(rawValue)
      if (!rawValue || !Number.isFinite(actualQuantity) || actualQuantity < 0) {
        return setError('Số lượng thực tế phải là số không âm cho tất cả sản phẩm.')
      }
      items.push({ product_id: product.id, actual_quantity: actualQuantity })
    }

    setSaving(true)
    try {
      await onSave({
        stocktake: { stocktake_date: date, note: note.trim() },
        items,
      })
    } catch (saveError) {
      setError(saveError.message || 'Không thể tạo phiếu kiểm kê.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Kiểm kê kho"
      description="Nhập tồn thực tế tại thời điểm kiểm kê. Hệ thống sẽ tự tính chênh lệch và ghi vào sổ kho."
      size="lg"
      icon={ClipboardCheck}
      tone="sky"
      badge="Phiếu kiểm kê"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button className="btn-primary w-full sm:w-auto" type="submit" form="stocktake-form" disabled={saving || !products.length}>
            <Save size={17} />
            <span>{saving ? 'Đang lưu...' : 'Hoàn tất kiểm kê'}</span>
          </button>
        </div>
      }
    >
      <form id="stocktake-form" className="space-y-6" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Ngày kiểm kê"><input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={saving} required /></Field>
        <Field label="Ghi chú kiểm kê"><input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Đối chiếu cuối ngày" disabled={saving} required /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Mặt hàng" value={formatNumber(products.length)} />
        <SummaryCard label="Có chênh lệch" value={formatNumber(summary.changed)} tone={summary.changed ? 'amber' : 'emerald'} />
        <SummaryCard label="Chênh lệch SL" value={(summary.difference > 0 ? '+' : '') + formatNumber(summary.difference)} tone={summary.difference < 0 ? 'rose' : summary.difference > 0 ? 'emerald' : 'slate'} />
        <SummaryCard label="Giá trị chênh lệch" value={(summary.value > 0 ? '+' : '') + formatCurrency(summary.value)} tone={summary.value < 0 ? 'rose' : summary.value > 0 ? 'emerald' : 'slate'} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="form-section-title"><ClipboardCheck size={18} /> Tồn thực tế</h3><p className="mt-1 text-xs text-slate-400">Giá trị hiện tại được lấy từ sổ kho trước khi lập phiếu.</p></div><div className="relative w-48 max-w-[45%]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input className="field pl-9 text-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm..." disabled={saving} /></div></div>
        {!products.length ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">Chưa có sản phẩm hàng hóa để kiểm kê.</div> : !filteredProducts.length ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">Không tìm thấy sản phẩm phù hợp.</div> : <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{filteredProducts.map((product) => { const systemQuantity = currentStock(product); const actualQuantity = Number(values[product.id]); const difference = (Number.isFinite(actualQuantity) ? actualQuantity : systemQuantity) - systemQuantity; return <div className="p-4" key={product.id}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600"><ClipboardCheck size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{product.name}</p><p className="mt-1 truncate text-xs text-slate-400">{product.code || product.sku || 'Chưa có mã'} · {product.unit}</p></div><span className={(difference === 0 ? 'bg-slate-100 text-slate-500' : difference > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') + ' shrink-0 rounded-full px-2 py-1 text-xs font-bold'}>{difference === 0 ? 'Khớp' : (difference > 0 ? '+' : '−') + ' ' + formatNumber(Math.abs(difference))}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-400">Theo hệ thống</p><p className="mt-1 text-sm font-extrabold text-slate-700">{formatNumber(systemQuantity)} <span className="text-xs font-semibold text-slate-400">{product.unit}</span></p></div><Field label="Thực tế"><input className="field text-right text-base font-bold" type="number" min="0" step="0.001" value={values[product.id] ?? ''} onChange={(event) => updateQuantity(product.id, event.target.value)} disabled={saving} required /></Field></div></div> })}</div>}
      </section>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
    </form>
    </Modal>
  )
}

function SummaryCard({ label, value, tone = 'slate' }) {
  const toneClasses = { slate: 'bg-slate-50 text-slate-900', amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-700' }
  return <div className={'rounded-xl px-3 py-3 ' + toneClasses[tone]}><p className="truncate text-[11px] font-semibold opacity-70">{label}</p><p className="mt-1 truncate text-sm font-extrabold">{value}</p></div>
}

function Field({ label, className = '', children }) {
  return <label className={'block ' + className}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}
