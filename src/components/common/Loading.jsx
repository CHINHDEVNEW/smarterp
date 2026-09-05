export default function Loading({ rows = 5 }) {
  return (
    <div className="space-y-3" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  )
}
