/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Factory, Plus, Save, Trash2 } from 'lucide-react'
import Modal from '../common/Modal'
import { formatCurrency, localDateKey } from '../../lib/formatters'

const initialValues = {
  code: '',
  bom_id: '',
  output_product_id: '',
  order_date: localDateKey(),
  planned_start_date: '',
  planned_end_date: '',
  planned_quantity: '1',
  note: '',
  labor: '0',
  machine: '0',
  outsourcing: '0',
  other: '0',
}

const costLabels = {
  labor: 'Nhân công',
  machine: 'Máy móc / điện / thiết bị',
  outsourcing: 'Gia công ngoài',
  other: 'Chi phí khác',
}

export default function ProductionOrderForm({ open, boms, products, onClose, onSave }) {
  const [values, setValues] = useState(initialValues)
  const [materials, setMaterials] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setValues({ ...initialValues, order_date: localDateKey() })
    setMaterials([])
    setSelectedProductId('')
    setError('')
  }, [open])

  const selectedBom = useMemo(() => boms.find((bom) => bom.id === values.bom_id), [boms, values.bom_id])
  const availableProducts = useMemo(() => products.filter((product) => product.id !== (selectedBom?.output_product_id || values.output_product_id) && !materials.some((item) => item.product_id === product.id)), [materials, products, selectedBom, values.output_product_id])
  const plannedNonMaterialCost = useMemo(() => ['labor', 'machine', 'outsourcing', 'other'].reduce((sum, type) => sum + (Number(values[type]) || 0), 0), [values])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function chooseBom(value) {
    const bom = boms.find((row) => row.id === value)
    setValues((current) => ({ ...current, bom_id: value, output_product_id: bom?.output_product_id ?? '' }))
    if (value) setMaterials([])
  }

  function addMaterial() {
    const product = products.find((row) => row.id === selectedProductId)
    if (!product) return
    setMaterials((current) => [...current, {
      product_id: product.id,
      name: product.name,
      code: product.code ?? '',
      unit: product.unit ?? '',
      cost_price: Number(product.cost_price) || 0,
      planned_quantity: '1',
    }])
    setSelectedProductId('')
  }

  function updateMaterial(productId, value) {
    setMaterials((current) => current.map((item) => item.product_id === productId ? { ...item, planned_quantity: value } : item))
  }

  function removeMaterial(productId) {
    setMaterials((current) => current.filter((item) => item.product_id !== productId))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    const quantity = Number(values.planned_quantity) || 0
    if (quantity <= 0) return setError('Sản lượng kế hoạch phải lớn hơn 0.')
    if (!values.bom_id && !values.output_product_id) return setError('Vui lòng chọn định mức hoặc sản phẩm đầu ra.')
    if (values.planned_start_date && values.planned_end_date && values.planned_end_date < values.planned_start_date) return setError('Ngày kết thúc phải sau ngày bắt đầu.')
    if (!values.bom_id && materials.some((item) => (Number(item.planned_quantity) || 0) <= 0)) return setError('Số lượng nguyên vật liệu phải lớn hơn 0.')

    const costs = Object.entries(costLabels).map(([type, description]) => ({
      cost_type: type,
      description,
      planned_amount: Number(values[type]) || 0,
      actual_amount: 0,
    })).filter((cost) => cost.planned_amount > 0)

    setSaving(true)
    try {
      await onSave({
        code: values.code.trim() || undefined,
        bom_id: values.bom_id || null,
        output_product_id: values.bom_id ? selectedBom?.output_product_id : values.output_product_id,
        order_date: values.order_date,
        planned_start_date: values.planned_start_date || null,
        planned_end_date: values.planned_end_date || null,
        planned_quantity: quantity,
        note: values.note.trim() || null,
        costs,
      }, materials.map((item) => ({
        product_id: item.product_id,
        planned_quantity: Number(item.planned_quantity),
      })))
    } catch (saveError) {
      setError(saveError.message || 'Không thể tạo lệnh sản xuất.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={saving ? () => {} : onClose} title="Tạo lệnh sản xuất" description="Chọn định mức, sản lượng và các chi phí dự kiến cho một lệnh mới." size="lg" footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="production-order-form" disabled={saving}><Save size={17} /> {saving ? 'Đang lưu...' : 'Tạo lệnh sản xuất'}</button></>}>
      <form id="production-order-form" className="space-y-6" onSubmit={submit}>
        <fieldset>
          <legend className="form-section-title"><Factory size={18} /> Thông tin lệnh</legend>
          <div className="form-grid">
            <Field label="Mã lệnh"><input className="field" value={values.code} onChange={(event) => update('code', event.target.value)} placeholder="Tự sinh nếu để trống" disabled={saving} /></Field>
            <Field label="Ngày lập"><input className="field" type="date" value={values.order_date} onChange={(event) => update('order_date', event.target.value)} disabled={saving} required /></Field>
            <Field label="Định mức áp dụng" className="sm:col-span-2"><select className="field" value={values.bom_id} onChange={(event) => chooseBom(event.target.value)} disabled={saving}><option value="">Không dùng định mức (nhập vật tư trực tiếp)</option>{boms.filter((bom) => bom.status === 'active').map((bom) => <option key={bom.id} value={bom.id}>{bom.code} · {bom.name} · {bom.output_product_name}</option>)}</select></Field>
            {selectedBom ? <Field label="Sản phẩm đầu ra"><div className="field bg-slate-50 font-bold text-slate-700">{selectedBom.output_product_name} · {selectedBom.output_unit}</div></Field> : <Field label="Sản phẩm đầu ra" required><select className="field" value={values.output_product_id} onChange={(event) => update('output_product_id', event.target.value)} disabled={saving}><option value="">Chọn thành phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code || product.unit}</option>)}</select></Field>}
            <Field label="Sản lượng kế hoạch" required><input className="field text-right" type="number" min="0.001" step="0.001" value={values.planned_quantity} onChange={(event) => update('planned_quantity', event.target.value)} disabled={saving} /></Field>
            <Field label="Bắt đầu dự kiến"><input className="field" type="date" value={values.planned_start_date} onChange={(event) => update('planned_start_date', event.target.value)} disabled={saving} /></Field>
            <Field label="Kết thúc dự kiến"><input className="field" type="date" value={values.planned_end_date} onChange={(event) => update('planned_end_date', event.target.value)} disabled={saving} /></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><textarea className="field min-h-20 resize-y" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Ghi chú cho lệnh sản xuất" disabled={saving} /></Field>
          </div>
        </fieldset>

        {!selectedBom && <fieldset>
          <legend className="form-section-title"><Plus size={18} /> Nguyên liệu kế hoạch</legend>
          <div className="flex flex-col gap-2 sm:flex-row"><select className="field min-w-0 flex-1" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} disabled={saving}><option value="">Chọn nguyên vật liệu để thêm</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · Giá vốn {formatCurrency(product.cost_price)}</option>)}</select><button className="btn-secondary" type="button" onClick={addMaterial} disabled={!selectedProductId || saving}><Plus size={17} /> Thêm vật tư</button></div>
          {materials.length > 0 && <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{materials.map((item) => <div className="flex items-center gap-3 p-4" key={item.product_id}><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.code || 'Chưa có mã'} · {item.unit} · Giá vốn {formatCurrency(item.cost_price)}</p></div><input className="field max-w-32 text-right" type="number" min="0.000001" step="0.001" value={item.planned_quantity} onChange={(event) => updateMaterial(item.product_id, event.target.value)} disabled={saving} aria-label={`Số lượng ${item.name}`} /><button className="btn-icon text-rose-500" type="button" onClick={() => removeMaterial(item.product_id)} aria-label={`Xóa ${item.name}`} disabled={saving}><Trash2 size={17} /></button></div>)}</div>}
          <p className="mt-2 text-xs leading-5 text-slate-400">Khi dùng định mức, hệ thống tự chụp lại nguyên liệu và giá vốn tại thời điểm tạo lệnh.</p>
        </fieldset>}

        <fieldset>
          <legend className="form-section-title"><CalendarDays size={18} /> Chi phí dự kiến</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(costLabels).map(([type, label]) => <Field label={label} key={type}><input className="field text-right" type="number" min="0" step="1" value={values[type]} onChange={(event) => update(type, event.target.value)} disabled={saving} /></Field>)}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white"><span className="font-medium text-white/70">Chi phí ngoài nguyên vật liệu</span><span className="font-extrabold">{formatCurrency(plannedNonMaterialCost)}</span></div>
        </fieldset>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      </form>
    </Modal>
  )
}

function Field({ label, required = false, className = '', children }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>{children}</label>
}


