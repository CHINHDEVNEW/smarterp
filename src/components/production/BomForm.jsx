/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { Boxes, ClipboardList, Plus, Save, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { formatCurrency } from '../../lib/formatters'

const emptyValues = {
  code: '',
  name: '',
  output_product_id: '',
  output_quantity: '1',
  version: '1',
  note: '',
}

function valuesFromBom(bom) {
  if (!bom) return emptyValues
  return {
    code: bom.code ?? '',
    name: bom.name ?? '',
    output_product_id: bom.output_product_id ?? '',
    output_quantity: String(bom.output_quantity ?? 1),
    version: String(bom.version ?? 1),
    note: bom.note ?? '',
  }
}

function itemsFromBom(items, products) {
  return (items ?? []).map((item) => {
    const product = products.find((row) => row.id === item.material_product_id)
    return {
      product_id: item.material_product_id,
      name: product?.name ?? 'Sản phẩm đã lưu trữ',
      code: product?.code ?? '',
      unit: item.unit ?? product?.unit ?? '',
      cost_price: Number(item.unit_cost ?? product?.cost_price ?? 0),
      quantity: String(item.quantity ?? 1),
      scrap_rate: String(item.scrap_rate ?? 0),
      note: item.note ?? '',
    }
  })
}

export default function BomForm({ open, bom, products, bomItems, onClose, onSave }) {
  const [values, setValues] = useState(emptyValues)
  const [items, setItems] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setValues(valuesFromBom(bom))
    setItems(itemsFromBom(bomItems, products))
    setSelectedProductId('')
    setError('')
  }, [bom, bomItems, open, products])

  const availableProducts = useMemo(() => products.filter((product) => product.id !== values.output_product_id && !items.some((item) => item.product_id === product.id)), [items, products, values.output_product_id])
  const materialCost = useMemo(() => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.cost_price) || 0) * (1 + (Number(item.scrap_rate) || 0) / 100), 0), [items])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function addItem() {
    const product = products.find((row) => row.id === selectedProductId)
    if (!product) return
    setItems((current) => [...current, {
      product_id: product.id,
      name: product.name,
      code: product.code ?? '',
      unit: product.unit ?? '',
      cost_price: Number(product.cost_price) || 0,
      quantity: '1',
      scrap_rate: '0',
      note: '',
    }])
    setSelectedProductId('')
  }

  function updateItem(productId, field, value) {
    setItems((current) => current.map((item) => item.product_id === productId ? { ...item, [field]: value } : item))
  }

  function removeItem(productId) {
    setItems((current) => current.filter((item) => item.product_id !== productId))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!values.name.trim()) return setError('Vui lòng nhập tên định mức.')
    if (!values.output_product_id) return setError('Vui lòng chọn sản phẩm đầu ra.')
    if ((Number(values.output_quantity) || 0) <= 0) return setError('Sản lượng định mức phải lớn hơn 0.')
    if (!items.length) return setError('Định mức phải có ít nhất một nguyên vật liệu.')
    if (items.some((item) => (Number(item.quantity) || 0) <= 0 || (Number(item.scrap_rate) || 0) < 0 || (Number(item.scrap_rate) || 0) > 100)) {
      return setError('Số lượng và tỷ lệ hao hụt nguyên vật liệu không hợp lệ.')
    }

    setSaving(true)
    try {
      await onSave({
        id: bom?.id,
        code: values.code.trim() || undefined,
        name: values.name.trim(),
        output_product_id: values.output_product_id,
        output_quantity: Number(values.output_quantity),
        version: Math.max(1, Number(values.version) || 1),
        note: values.note.trim() || null,
      }, items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        scrap_rate: Number(item.scrap_rate) || 0,
        note: item.note.trim() || null,
      })))
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu định mức.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title={bom ? 'Cập nhật định mức' : 'Tạo định mức nguyên vật liệu'} description="Khai báo vật tư cần dùng cho một lượng thành phẩm chuẩn." size="lg" footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="bom-form" disabled={saving}><Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu định mức'}</button></>}>
      <form id="bom-form" className="space-y-6" onSubmit={submit}>
        <fieldset>
          <legend className="form-section-title"><ClipboardList size={18} /> Thông tin định mức</legend>
          <div className="form-grid">
            <Field label="Tên định mức" required className="sm:col-span-2"><input className="field" value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="Ví dụ: Sản phẩm tiêu chuẩn" autoFocus disabled={saving} /></Field>
            <Field label="Mã định mức"><input className="field" value={values.code} onChange={(event) => update('code', event.target.value)} placeholder="Tự sinh nếu để trống" disabled={saving || Boolean(bom)} /></Field>
            <Field label="Phiên bản"><input className="field" type="number" min="1" step="1" value={values.version} onChange={(event) => update('version', event.target.value)} disabled={saving} /></Field>
            <Field label="Sản phẩm đầu ra" required className="sm:col-span-2"><select className="field" value={values.output_product_id} onChange={(event) => update('output_product_id', event.target.value)} disabled={saving}><option value="">Chọn thành phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code || product.unit}</option>)}</select></Field>
            <Field label="Sản lượng chuẩn"><input className="field" type="number" min="0.001" step="0.001" value={values.output_quantity} onChange={(event) => update('output_quantity', event.target.value)} disabled={saving} /></Field>
            <Field label="Ghi chú"><input className="field" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Điều kiện hoặc ghi chú" disabled={saving} /></Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><Boxes size={18} /> Nguyên vật liệu</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="field min-w-0 flex-1" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={saving}><option value="">Chọn nguyên vật liệu để thêm</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · Giá vốn {formatCurrency(product.cost_price)}</option>)}</select>
            <button className="btn-secondary" type="button" onClick={addItem} disabled={!selectedProductId || saving}><Plus size={17} /> Thêm vật tư</button>
          </div>

          {!items.length ? <div className="mt-3 rounded-2xl border border-dashed border-slate-300 px-4 py-9 text-center text-sm text-slate-400">Chưa có nguyên vật liệu. Chọn hàng hóa ở trên để bắt đầu định mức.</div> : <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{items.map((item) => <div className="p-4" key={item.product_id}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600"><Boxes size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.name}</p><p className="mt-1 truncate text-xs text-slate-400">{item.code || 'Chưa có mã'} · {item.unit}</p></div><button className="btn-icon -mr-2 -mt-2 text-rose-500" type="button" onClick={() => removeItem(item.product_id)} aria-label={`Xóa ${item.name}`} disabled={saving}><Trash2 size={17} /></button></div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Số lượng"><input className="field text-right" type="number" min="0.000001" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.product_id, 'quantity', event.target.value)} disabled={saving} /></Field><Field label="Hao hụt (%)"><input className="field text-right" type="number" min="0" max="100" step="0.1" value={item.scrap_rate} onChange={(event) => updateItem(item.product_id, 'scrap_rate', event.target.value)} disabled={saving} /></Field><Field label="Giá vốn tham chiếu"><div className="field bg-slate-50 text-right font-semibold text-slate-600">{formatCurrency(item.cost_price)}</div></Field><div className="text-right"><p className="mb-1.5 text-sm font-semibold text-slate-700">Chi phí dự kiến</p><p className="min-h-11 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-extrabold text-slate-800">{formatCurrency((Number(item.quantity) || 0) * (Number(item.cost_price) || 0) * (1 + (Number(item.scrap_rate) || 0) / 100))}</p></div></div><input className="field mt-3" value={item.note} onChange={(event) => updateItem(item.product_id, 'note', event.target.value)} placeholder="Ghi chú vật tư (tùy chọn)" disabled={saving} /></div>)}</div>}
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white"><span className="font-medium text-white/70">Chi phí nguyên vật liệu / định mức</span><span className="font-extrabold">{formatCurrency(materialCost)}</span></div>
        </fieldset>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      </form>
    </Modal>
  )
}

function Field({ label, required = false, className = '', children }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>{children}</label>
}


