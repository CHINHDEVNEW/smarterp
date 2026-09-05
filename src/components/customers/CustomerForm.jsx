/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { BadgeDollarSign, MapPin, Save, UserRound } from 'lucide-react'
import Modal from '../common/Modal'

const initialValues = {
  code: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  customer_group: '',
  credit_limit: '0',
  note: '',
  active: true,
}

function valuesFromCustomer(customer) {
  if (!customer) return initialValues
  return {
    code: customer.code ?? '',
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    customer_group: customer.customer_group ?? '',
    credit_limit: String(customer.credit_limit ?? 0),
    note: customer.note ?? '',
    active: customer.active ?? true,
  }
}

function optionalText(value) {
  const normalized = value.trim()
  return normalized || null
}

export default function CustomerForm({ open, customer, onClose, onSave }) {
  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setValues(valuesFromCustomer(customer))
    setError('')
  }, [open, customer])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const creditLimit = Number(values.credit_limit) || 0
    if (!values.name.trim()) {
      setError('Vui lòng nhập tên khách hàng.')
      return
    }
    if (creditLimit < 0) {
      setError('Hạn mức công nợ không được là số âm.')
      return
    }

    const payload = {
      code: optionalText(values.code),
      name: values.name.trim(),
      phone: optionalText(values.phone),
      email: optionalText(values.email),
      address: optionalText(values.address),
      customer_group: optionalText(values.customer_group),
      credit_limit: creditLimit,
      note: optionalText(values.note),
      active: values.active,
    }
    if (!payload.code) delete payload.code

    setSaving(true)
    try {
      await onSave(payload)
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu khách hàng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={customer ? 'Cập nhật khách hàng' : 'Thêm khách hàng mới'}
      description={customer ? 'Chỉnh sửa thông tin liên hệ và chính sách công nợ.' : 'Tạo hồ sơ để theo dõi giao dịch và công nợ.'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="btn-primary" type="submit" form="customer-form" disabled={saving}><Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu khách hàng'}</button>
        </>
      }
    >
      <form id="customer-form" className="space-y-6" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="form-section-title"><UserRound size={18} /> Thông tin khách hàng</legend>
          <div className="form-grid">
            <Field label="Tên khách hàng" required className="sm:col-span-2"><input className="field" value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="Cá nhân hoặc doanh nghiệp" autoFocus /></Field>
            <Field label="Mã khách hàng"><input className="field" value={values.code} onChange={(event) => update('code', event.target.value)} placeholder="Tự sinh nếu để trống" /></Field>
            <Field label="Nhóm khách hàng"><input className="field" value={values.customer_group} onChange={(event) => update('customer_group', event.target.value)} placeholder="Ví dụ: Khách lẻ" /></Field>
            <Field label="Số điện thoại"><input className="field" type="tel" value={values.phone} onChange={(event) => update('phone', event.target.value)} placeholder="09xx xxx xxx" /></Field>
            <Field label="Email"><input className="field" type="email" value={values.email} onChange={(event) => update('email', event.target.value)} placeholder="khachhang@email.com" /></Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><MapPin size={18} /> Địa chỉ và ghi chú</legend>
          <div className="form-grid">
            <Field label="Địa chỉ" className="sm:col-span-2"><input className="field" value={values.address} onChange={(event) => update('address', event.target.value)} placeholder="Địa chỉ giao hàng hoặc xuất hóa đơn" /></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><textarea className="field min-h-24 resize-y" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Thông tin cần lưu ý về khách hàng" /></Field>
          </div>
        </fieldset>

        <fieldset>
          <legend className="form-section-title"><BadgeDollarSign size={18} /> Chính sách công nợ</legend>
          <Field label="Hạn mức công nợ"><input className="field" min="0" step="1" type="number" value={values.credit_limit} onChange={(event) => update('credit_limit', event.target.value)} /></Field>
          <p className="mt-2 text-xs leading-5 text-slate-400">Số dư công nợ được tự động tính từ đơn bán và các khoản đã thu.</p>
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
          <span><span className="block text-sm font-bold text-slate-800">Đang giao dịch</span><span className="mt-1 block text-xs text-slate-500">Khách hàng được hiển thị khi lập đơn và báo giá.</span></span>
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
