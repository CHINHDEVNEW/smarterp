import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title = 'Chưa có dữ liệu', description, action }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={27} />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-800">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
