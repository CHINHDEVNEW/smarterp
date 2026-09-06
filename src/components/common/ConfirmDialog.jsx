import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Xác nhận',
  loading = false,
  message = 'Thao tác này không xóa dữ liệu lịch sử. Bạn có thể kích hoạt lại bất cứ lúc nào.',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={AlertTriangle}
      tone="amber"
      size="sm"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button
            className="btn-secondary w-full sm:w-auto"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            className="btn-danger w-full sm:w-auto"
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex gap-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-sm leading-relaxed text-amber-900">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100/80 text-amber-700">
          <AlertTriangle size={19} />
        </span>
        <p className="min-w-0 flex-1 pt-1 text-xs sm:text-sm">{message}</p>
      </div>
    </Modal>
  )
}
