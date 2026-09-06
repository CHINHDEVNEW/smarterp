/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Building2, Phone, Save } from 'lucide-react'
import Modal from '../common/Modal'

const emptyValues = { code: '', name: '', contact_person: '', phone: '', email: '', tax_code: '', website: '', supplier_group: '', address: '', note: '', active: true }
function fromSupplier(supplier) { return supplier ? { ...emptyValues, ...supplier } : emptyValues }
function optionalText(value) { const normalized = value.trim(); return normalized || null }

export default function SupplierForm({ open, supplier, onClose, onSave }) {
  const [values, setValues] = useState(emptyValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setValues(fromSupplier(supplier)); setError('') } }, [open, supplier])
  function update(field, value) { setValues((current) => ({ ...current, [field]: value })) }
  async function submit(event) { event.preventDefault(); if (!values.name.trim()) return setError('Vui lòng nhập tên nhà cung cấp.'); setSaving(true); setError(''); try { await onSave({ code: optionalText(values.code), name: values.name.trim(), contact_person: optionalText(values.contact_person), phone: optionalText(values.phone), email: optionalText(values.email), tax_code: optionalText(values.tax_code), website: optionalText(values.website), supplier_group: optionalText(values.supplier_group), address: optionalText(values.address), note: optionalText(values.note), active: values.active }) } catch (saveError) { setError(saveError.message || 'Không thể lưu nhà cung cấp.') } finally { setSaving(false) } }
  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={supplier ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp mới'}
      description="Lưu thông tin liên hệ để theo dõi các phiếu nhập và công nợ phải trả."
      icon={Building2}
      tone="sky"
      badge={supplier ? 'Chỉnh sửa' : 'Thêm mới'}
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button className="btn-primary w-full sm:w-auto" type="submit" form="supplier-form" disabled={saving}>
            <Save size={17} />
            <span>{saving ? 'Đang lưu...' : 'Lưu nhà cung cấp'}</span>
          </button>
        </div>
      }
    >
      <form id="supplier-form" className="space-y-6" onSubmit={submit}>
        <fieldset>
          <legend className="form-section-title"><Building2 size={18} /> Thông tin cơ bản</legend>
          <div className="form-grid">
            <Field label="Tên nhà cung cấp" required className="sm:col-span-2">
              <input className="field" value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="Tên công ty hoặc cá nhân" autoFocus />
            </Field>
            <Field label="Mã nhà cung cấp">
              <input className="field uppercase font-semibold" value={values.code} onChange={(event) => update('code', event.target.value)} placeholder="Tự sinh nếu để trống" />
            </Field>
            <Field label="Nhóm nhà cung cấp">
              <input className="field" value={values.supplier_group} onChange={(event) => update('supplier_group', event.target.value)} placeholder="Ví dụ: Đồ uống" />
            </Field>
            <Field label="Người liên hệ">
              <input className="field" value={values.contact_person} onChange={(event) => update('contact_person', event.target.value)} placeholder="Họ tên người phụ trách" />
            </Field>
            <Field label="Mã số thuế">
              <input className="field font-mono" value={values.tax_code} onChange={(event) => update('tax_code', event.target.value)} placeholder="0101234567" />
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><Phone size={18} /> Liên hệ</legend>
          <div className="form-grid">
            <Field label="Số điện thoại">
              <input className="field" type="tel" value={values.phone} onChange={(event) => update('phone', event.target.value)} placeholder="09xx xxx xxx" />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={values.email} onChange={(event) => update('email', event.target.value)} placeholder="nhacungcap@email.com" />
            </Field>
            <Field label="Website">
              <input className="field" type="url" value={values.website} onChange={(event) => update('website', event.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Địa chỉ">
              <input className="field" value={values.address} onChange={(event) => update('address', event.target.value)} placeholder="Địa chỉ trụ sở / kho hàng" />
            </Field>
            <Field label="Ghi chú" className="sm:col-span-2">
              <textarea className="field min-h-20 resize-y" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Ghi chú thêm về nhà cung cấp..." />
            </Field>
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50">
          <span>
            <span className="block text-sm font-bold text-slate-800">Đang giao dịch</span>
            <span className="mt-0.5 block text-xs text-slate-500">Nhà cung cấp được hiển thị khi lập phiếu nhập.</span>
          </span>
          <input className="size-5 accent-sky-600" type="checkbox" checked={values.active} onChange={(event) => update('active', event.target.checked)} />
        </label>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      </form>
    </Modal>
  )
}
function Field({ label, required = false, className = '', children }) { return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>{children}</label> }
