import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pageCount, pageSize, total, onChange }) {
  if (total <= pageSize) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-center text-xs font-medium text-slate-500 sm:text-left">
        Hiển thị <span className="font-semibold text-slate-700">{first}</span>–
        <span className="font-semibold text-slate-700">{last}</span> trong{' '}
        <span className="font-semibold text-slate-700">{total}</span> kết quả
      </p>
      <div className="flex items-center justify-center gap-1.5">
        <button
          className="btn-icon size-8.5 rounded-lg border border-slate-200 bg-white shadow-xs hover:bg-slate-50"
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
          title="Trang trước"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="tabular-nums min-w-16 text-center text-xs font-bold text-slate-700">
          {page} / {pageCount}
        </span>
        <button
          className="btn-icon size-8.5 rounded-lg border border-slate-200 bg-white shadow-xs hover:bg-slate-50"
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Trang sau"
          title="Trang sau"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
