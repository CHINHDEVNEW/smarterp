export default function Loading({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="animate-shimmer flex h-14 items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4"
        >
          <div className="size-8 shrink-0 rounded-lg bg-slate-200/70" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-200/70" />
            <div className="h-2.5 w-1/4 rounded bg-slate-200/50" />
          </div>
          <div className="h-3.5 w-20 rounded bg-slate-200/60" />
        </div>
      ))}
    </div>
  )
}
