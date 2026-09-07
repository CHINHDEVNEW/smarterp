/* oxlint-disable react/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'
import { BadgeDollarSign, Image, Package, Save, Upload, Warehouse, X } from 'lucide-react'
import Modal from '../common/Modal'
import { formatCurrency, formatNumber } from '../../lib/formatters'
import { removeProductImage, uploadProductImage, validateProductImage } from '../../services/productImageService'
import { clearFormDraft, formDraftKey, loadFormDraft, saveFormDraft } from '../../lib/formDraft'

const initialValues = {
  code: '',
  sku: '',
  barcode: '',
  name: '',
  category: '',
  unit: 'cái',
  product_type: 'goods',
  cost_price: '0',
  sale_price: '0',
  min_stock: '0',
  max_stock: '0',
  image_url: '',
  note: '',
  active: true,
}

function valuesFromProduct(product) {
  if (!product) return initialValues
  return {
    code: product.code ?? '',
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    name: product.name ?? '',
    category: product.category ?? '',
    unit: product.unit ?? 'cái',
    product_type: product.product_type ?? 'goods',
    cost_price: String(product.cost_price ?? 0),
    sale_price: String(product.sale_price ?? 0),
    min_stock: String(product.min_stock ?? 0),
    max_stock: String(product.max_stock ?? 0),
    image_url: product.image_url ?? '',
    note: product.note ?? '',
    active: product.active ?? true,
  }
}

function optionalText(value) {
  const normalized = value.trim()
  return normalized || null
}

export default function ProductForm({ open, product, businessId, onClose, onSave }) {
  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const draftKey = formDraftKey(businessId, 'product-new')

  useEffect(() => {
    if (!open) return
    setValues(product ? valuesFromProduct(product) : (loadFormDraft(draftKey) ?? initialValues))
    setError('')
    setImageFile(null)
    setImagePreview('')
  }, [draftKey, open, product])

  useEffect(() => {
    if (open && !product) saveFormDraft(draftKey, values)
  }, [draftKey, open, product, values])

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  const profit = useMemo(
    () => (Number(values.sale_price) || 0) - (Number(values.cost_price) || 0),
    [values.sale_price, values.cost_price],
  )

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function selectImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      validateProductImage(file)
      setError('')
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    } catch (imageError) {
      setError(imageError.message)
    }
  }

  function clearSelectedImage() {
    setImageFile(null)
    setImagePreview('')
  }

  function closeForm() {
    if (!product) clearFormDraft(draftKey)
    onClose()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const costPrice = Number(values.cost_price) || 0
    const salePrice = Number(values.sale_price) || 0
    const minStock = Number(values.min_stock) || 0
    const maxStock = Number(values.max_stock) || 0

    if (!values.name.trim()) {
      setError('Vui lòng nhập tên sản phẩm.')
      return
    }
    if (costPrice < 0 || salePrice < 0 || minStock < 0 || maxStock < 0) {
      setError('Giá và định mức tồn kho không được là số âm.')
      return
    }
    if (values.product_type === 'goods' && maxStock > 0 && maxStock < minStock) {
      setError('Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu.')
      return
    }

    const payload = {
      code: optionalText(values.code),
      sku: optionalText(values.sku),
      barcode: optionalText(values.barcode),
      name: values.name.trim(),
      category: optionalText(values.category),
      unit: values.unit.trim() || (values.product_type === 'service' ? 'lần' : 'cái'),
      product_type: values.product_type,
      cost_price: costPrice,
      sale_price: salePrice,
      min_stock: values.product_type === 'service' ? 0 : minStock,
      max_stock: values.product_type === 'service' ? 0 : maxStock,
      image_url: optionalText(values.image_url),
      note: optionalText(values.note),
      active: values.active,
    }

    if (!payload.code) delete payload.code

    setSaving(true)
    let uploadedImagePath = ''
    try {
      if (imageFile) {
        const uploadedImage = await uploadProductImage(businessId, imageFile)
        uploadedImagePath = uploadedImage.path
        payload.image_url = uploadedImage.publicUrl
      }
      await onSave(payload)
      if (!product) clearFormDraft(draftKey)
    } catch (saveError) {
      await removeProductImage(uploadedImagePath)
      setError(saveError.message || 'Không thể lưu sản phẩm.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : closeForm}
      title={product ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
      description={product ? 'Chỉnh sửa thông tin bán hàng và định mức tồn kho.' : 'Tạo mặt hàng hoặc dịch vụ trong danh mục.'}
      icon={Package}
      tone="sky"
      badge={product ? 'Chỉnh sửa' : 'Tạo mới'}
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeForm} disabled={saving}>Hủy</button>
          <button className="btn-primary w-full sm:w-auto" type="submit" form="product-form" disabled={saving}><Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}</button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-100 p-1.5">
          <button className={`rounded-xl px-3 py-3 text-sm font-bold transition ${values.product_type === 'goods' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} type="button" onClick={() => update('product_type', 'goods')}><span className="flex items-center justify-center gap-2"><Package size={18} /> Hàng hóa</span></button>
          <button className={`rounded-xl px-3 py-3 text-sm font-bold transition ${values.product_type === 'service' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} type="button" onClick={() => update('product_type', 'service')}><span className="flex items-center justify-center gap-2"><BadgeDollarSign size={18} /> Dịch vụ</span></button>
        </div>

        <fieldset>
          <legend className="form-section-title"><Package size={18} /> Thông tin cơ bản</legend>
          <div className="form-grid">
            <Field label="Tên sản phẩm / dịch vụ" required className="sm:col-span-2"><input className="field" value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="Ví dụ: Cà phê rang xay" autoFocus required /></Field>
            <Field label="Mã sản phẩm"><input className="field" value={values.code} onChange={(event) => update('code', event.target.value)} placeholder="Tự sinh nếu để trống" /></Field>
            <Field label="SKU"><input className="field" value={values.sku} onChange={(event) => update('sku', event.target.value)} placeholder="Mã quản lý nội bộ" /></Field>
            <Field label="Barcode"><input className="field" value={values.barcode} onChange={(event) => update('barcode', event.target.value)} placeholder="Quét hoặc nhập mã vạch" /></Field>
            <Field label="Đơn vị" required><input className="field" value={values.unit} onChange={(event) => update('unit', event.target.value)} placeholder={values.product_type === 'service' ? 'lần, giờ, gói...' : 'cái, hộp, kg...'} required /></Field>
            <Field label="Nhóm hàng" className="sm:col-span-2"><input className="field" value={values.category} onChange={(event) => update('category', event.target.value)} placeholder="Ví dụ: Đồ uống" /></Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><BadgeDollarSign size={18} /> Giá bán</legend>
          <div className="form-grid">
            <Field label="Giá vốn"><input className="field" min="0" step="1" type="number" value={values.cost_price} onChange={(event) => update('cost_price', event.target.value)} /></Field>
            <Field label="Giá bán"><input className="field" min="0" step="1" type="number" value={values.sale_price} onChange={(event) => update('sale_price', event.target.value)} /></Field>
          </div>
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>Lợi nhuận dự kiến: {formatCurrency(profit)}</div>
        </fieldset>

        {values.product_type === 'goods' ? (
          <fieldset>
            <legend className="form-section-title"><Warehouse size={18} /> Định mức tồn kho</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tồn hiện tại"><div className="field flex items-center bg-slate-50 font-bold text-slate-600">{formatNumber(product?.stock_on_hand ?? 0)}</div></Field>
              <Field label="Tồn tối thiểu"><input className="field" min="0" step="0.001" type="number" value={values.min_stock} onChange={(event) => update('min_stock', event.target.value)} /></Field>
              <Field label="Tồn tối đa"><input className="field" min="0" step="0.001" type="number" value={values.max_stock} onChange={(event) => update('max_stock', event.target.value)} /></Field>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">Tồn hiện tại được tính từ sổ kho và không chỉnh trực tiếp tại đây.</p>
          </fieldset>
        ) : (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-800">Dịch vụ không theo dõi tồn kho và không tạo biến động kho.</div>
        )}

        <fieldset>
          <legend className="form-section-title"><Image size={18} /> Thông tin bổ sung</legend>
          <div className="form-grid">
            <Field label="Ảnh sản phẩm" className="sm:col-span-2">
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 p-3 sm:flex-row sm:items-center">
                <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                  {imagePreview || values.image_url ? <img className="size-full object-cover" src={imagePreview || values.image_url} alt="Xem trước sản phẩm" /> : <Image size={25} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">{imageFile ? imageFile.name : 'Chọn ảnh từ thiết bị'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">JPG, PNG, WebP hoặc GIF, tối đa 5 MB.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="btn-secondary cursor-pointer">
                      <Upload size={16} /> {imageFile || values.image_url ? 'Đổi ảnh' : 'Chọn ảnh'}
                      <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectImage} disabled={saving} />
                    </label>
                    {(imageFile || values.image_url) && <button className="btn-secondary text-rose-600" type="button" onClick={() => { clearSelectedImage(); update('image_url', '') }} disabled={saving}><X size={16} /> Bỏ ảnh</button>}
                  </div>
                </div>
              </div>
            </Field>
            <Field label="Hoặc nhập đường dẫn ảnh" className="sm:col-span-2"><input className="field" type="url" value={values.image_url} onChange={(event) => { clearSelectedImage(); update('image_url', event.target.value) }} placeholder="https://..." disabled={saving} /></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><textarea className="field min-h-24 resize-y" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Ghi chú thêm về sản phẩm" /></Field>
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
          <span><span className="block text-sm font-bold text-slate-800">Đang kinh doanh</span><span className="mt-1 block text-xs text-slate-500">Sản phẩm được hiển thị trong danh sách bán hàng.</span></span>
          <input className="size-5 accent-sky-600" type="checkbox" checked={values.active} onChange={(event) => update('active', event.target.checked)} />
        </label>

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
