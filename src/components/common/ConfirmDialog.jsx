import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Xác nhận', loading = false, message = 'Thao tác này không xóa dữ liệu lịch sử. Bạn có thể kích hoạt lại bất cứ lúc nào.' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" type="button" onClick={onClose} disabled={loading}>Hủy</button>
          <button className="btn-danger" type="button" onClick={onConfirm} disabled={loading}>{loading ? 'Đang xử lý...' : confirmLabel}</button>
        </>
      }
    >
      <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={21} />
        <p>{message}</p>
      </div>
    </Modal>
  )
}
