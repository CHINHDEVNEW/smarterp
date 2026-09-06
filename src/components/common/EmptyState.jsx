import { Inbox } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Chưa có dữ liệu',
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex min-h-64 flex-col items-center justify-center px-4 py-12 text-center ${className}`}
    >
      <div className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-sky-100/50 blur-lg" />
        <div className="relative grid size-14 place-items-center rounded-2xl border border-slate-200/80 bg-white text-slate-400 shadow-xs">
          <Icon size={26} strokeWidth={1.8} />
        </div>
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
