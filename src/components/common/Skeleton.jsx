export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-slate-100 ${className}`}
      {...props}
    />
  )
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`surface p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-5 w-32 rounded" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5, className = '' }) {
  return (
    <div className={`space-y-3 p-4 sm:p-5 ${className}`}>
      <div className="flex gap-4 border-b border-slate-100 pb-3">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton
            key={i}
            className={`h-4 rounded ${i === 0 ? 'w-40' : 'flex-1'}`}
          />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 py-2">
          {Array.from({ length: cols }, (_, colIndex) => (
            <Skeleton
              key={colIndex}
              className={`h-4 rounded ${colIndex === 0 ? 'w-40' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default Skeleton
