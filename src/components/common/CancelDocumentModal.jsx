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

  return <Modal open={open} onClose={saving ? () => {} : onClose} title={title} description={description} size="sm" footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Giữ lại</button><button className="btn-primary bg-rose-600 hover:bg-rose-700" type="submit" form="cancel-document-form" disabled={saving}><Ban size={17} /> {saving ? 'Đang hủy...' : 'Xác nhận hủy'}</button></>}><form id="cancel-document-form" className="space-y-4" onSubmit={submit}><p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Hệ thống sẽ tạo bút toán đảo cho kho và tiền đã ghi nhận. Lịch sử chứng từ vẫn được giữ lại để đối soát.</p><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Lý do hủy</span><textarea className="field min-h-24 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Lập nhầm chứng từ" required autoFocus /></label>{error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}</form></Modal>
}
