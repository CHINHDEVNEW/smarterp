/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Ban } from 'lucide-react'
import Modal from './Modal'

export default function CancelDocumentModal({ open, title, description, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
    setError('')
  }, [open])

  async function submit(event) {
    event.preventDefault()
    if (!reason.trim()) return setError('Vui lòng ghi rõ lý do hủy chứng từ.')
    setSaving(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (actionError) {
      setError(actionError.message || 'Không thể hủy chứng từ.')
    } finally {
      setSaving(false)
    }
  }

  const quickReasons = ['Nhập nhầm thông tin', 'Khách đổi ý', 'Trùng lặp chứng từ', 'Hàng có lỗi']

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={title}
      description={description}
      icon={Ban}
      tone="rose"
      badge="Đảo sổ tự động"
      size="sm"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Giữ lại chứng từ
          </button>
          <button className="btn-danger w-full sm:w-auto" type="submit" form="cancel-document-form" disabled={saving}>
            <Ban size={16} />
            <span>{saving ? 'Đang xử lý...' : 'Xác nhận hủy'}</span>
          </button>
        </div>
      }
    >
      <form id="cancel-document-form" className="space-y-4" onSubmit={submit}>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900">
          <p className="font-bold">Lưu ý quan trọng:</p>
          <p className="mt-1">
            Hệ thống sẽ tự động tạo bút toán đảo cho tồn kho và dòng tiền đã ghi nhận. Chứng từ này sẽ chuyển sang trạng thái Đã hủy để phục vụ kiểm toán đối soát.
          </p>
        </div>

        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Lý do thường gặp
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickReasons.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  reason === item
                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Nội dung chi tiết <span className="text-rose-500">*</span>
          </span>
          <textarea
            className="field min-h-20 resize-y text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do hủy chứng từ này..."
            required
            autoFocus
          />
        </label>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
