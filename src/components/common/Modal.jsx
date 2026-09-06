import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const iconTones = {
  sky: 'bg-sky-50 text-sky-600 ring-1 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
  rose: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
  indigo: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100',
  slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  badge,
  tone = 'sky',
  children,
  footer,
  size = 'md',
}) {
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const widths = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-5xl',
  }

  const iconStyle = iconTones[tone] ?? iconTones.sky

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        type="button"
        onClick={onClose}
        aria-label="Đóng hộp thoại"
      />
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-slate-200/90 bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200 animate-in fade-in zoom-in-95 sm:max-h-[88vh] sm:rounded-3xl sm:border ${
          widths[size] ?? widths.md
        }`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
        <header className="flex items-start gap-3.5 border-b border-slate-100 px-5 py-4 sm:px-6 sm:py-4.5">
          {Icon && (
            <span className={`grid size-10 shrink-0 place-items-center rounded-2xl shadow-xs ${iconStyle}`}>
              <Icon size={20} strokeWidth={2.2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="modal-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {title}
              </h2>
              {badge && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed sm:text-sm">{description}</p>
            )}
          </div>
          <button
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100/70 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
            type="button"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
