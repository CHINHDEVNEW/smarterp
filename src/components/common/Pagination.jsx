import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pageCount, pageSize, total, onChange }) {
  if (total <= pageSize) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-center text-xs font-medium text-slate-500 sm:text-left">
        Hiển thị {first}–{last} trong {total} kết quả
      </p>
      <div className="flex items-center justify-center gap-2">
        <button className="btn-icon" type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Trang trước"><ChevronLeft size={17} /></button>
        <span className="min-w-20 text-center text-sm font-bold text-slate-700">{page} / {pageCount}</span>
        <button className="btn-icon" type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="Trang sau"><ChevronRight size={17} /></button>
      </div>
    </div>
  )
}
