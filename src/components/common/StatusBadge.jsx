const toneStyles = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  sky: 'bg-sky-50 text-sky-700 border-sky-200/80',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  slate: 'bg-slate-100 text-slate-700 border-slate-200/80',
}

const statusMap = {
  // Orders
  draft: { label: 'Bản nháp', tone: 'slate' },
  confirmed: { label: 'Đã xác nhận', tone: 'sky' },
  completed: { label: 'Hoàn tất', tone: 'emerald' },
  cancelled: { label: 'Đã hủy', tone: 'slate' },

  // Payments
  unpaid: { label: 'Chưa thanh toán', tone: 'rose' },
  partial: { label: 'Thanh toán một phần', tone: 'amber' },
  paid: { label: 'Đã thanh toán', tone: 'emerald' },

  // Stock
  in_stock: { label: 'Còn hàng', tone: 'emerald' },
  low_stock: { label: 'Sắp hết', tone: 'amber' },
  out_of_stock: { label: 'Hết hàng', tone: 'rose' },
  service: { label: 'Dịch vụ', tone: 'sky' },

  // Active
  active: { label: 'Đang hoạt động', tone: 'emerald' },
  inactive: { label: 'Ngừng hoạt động', tone: 'slate' },

  // Production Orders
  planned: { label: 'Đang chờ', tone: 'slate' },
  in_progress: { label: 'Đang sản xuất', tone: 'sky' },

  // BOM
  archived: { label: 'Lưu trữ', tone: 'slate' },

  // Finance direction
  in: { label: 'Thu tiền', tone: 'emerald' },
  out: { label: 'Chi tiền', tone: 'rose' },
}

export default function StatusBadge({
  status,
  label,
  tone,
  size = 'md',
  dot = true,
  className = '',
}) {
  const resolved = statusMap[status] ?? {
    label: label || status || '—',
    tone: tone || 'slate',
  }

  const finalLabel = label || resolved.label
  const finalTone = tone || resolved.tone || 'slate'
  const style = toneStyles[finalTone] ?? toneStyles.slate

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold leading-none ${sizeClasses} ${style} ${className}`}
    >
      {dot && (
        <span
          className={`size-1.5 rounded-full ${
            finalTone === 'emerald'
              ? 'bg-emerald-500'
              : finalTone === 'sky'
              ? 'bg-sky-500'
              : finalTone === 'amber'
              ? 'bg-amber-500'
              : finalTone === 'rose'
              ? 'bg-rose-500'
              : finalTone === 'indigo'
              ? 'bg-indigo-500'
              : 'bg-slate-400'
          }`}
        />
      )}
      {finalLabel}
    </span>
  )
}
