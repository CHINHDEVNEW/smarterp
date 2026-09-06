const toneStyles = {
  sky: {
    accent: 'from-sky-500 to-cyan-400',
    iconBg: 'from-sky-500 to-cyan-600',
    shadow: 'shadow-sky-500/25',
    badge: 'bg-sky-50 text-sky-700',
    glow: 'bg-sky-500/10',
  },
  emerald: {
    accent: 'from-emerald-500 to-teal-400',
    iconBg: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/25',
    badge: 'bg-emerald-50 text-emerald-700',
    glow: 'bg-emerald-500/10',
  },
  amber: {
    accent: 'from-amber-500 to-orange-400',
    iconBg: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-500/25',
    badge: 'bg-amber-50 text-amber-700',
    glow: 'bg-amber-500/10',
  },
  rose: {
    accent: 'from-rose-500 to-pink-500',
    iconBg: 'from-rose-500 to-pink-600',
    shadow: 'shadow-rose-500/25',
    badge: 'bg-rose-50 text-rose-700',
    glow: 'bg-rose-500/10',
  },
  indigo: {
    accent: 'from-indigo-500 to-purple-500',
    iconBg: 'from-indigo-500 to-purple-600',
    shadow: 'shadow-indigo-500/25',
    badge: 'bg-indigo-50 text-indigo-700',
    glow: 'bg-indigo-500/10',
  },
  slate: {
    accent: 'from-slate-600 to-slate-400',
    iconBg: 'from-slate-700 to-slate-800',
    shadow: 'shadow-slate-500/20',
    badge: 'bg-slate-100 text-slate-700',
    glow: 'bg-slate-500/10',
  },
}

export default function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = 'sky',
  size = 'sm',
  className = '',
  onClick,
}) {
  const styles = toneStyles[tone] ?? toneStyles.sky

  if (size === 'lg') {
    return (
      <article
        onClick={onClick}
        className={`surface relative overflow-hidden p-5 sm:p-6 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.accent}`} />
        <div
          className={`pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-40 blur-2xl ${styles.glow}`}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <p className="tabular-nums mt-2.5 truncate text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {value}
            </p>
            {caption && (
              <p className="mt-2 text-xs font-medium text-slate-500">
                {caption}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${styles.iconBg} text-white shadow-md ${styles.shadow}`}
            >
              <Icon size={22} strokeWidth={2.2} />
            </div>
          )}
        </div>
      </article>
    )
  }

  // Mini metric size (for sub-pages)
  return (
    <article
      onClick={onClick}
      className={`surface relative overflow-hidden flex items-center justify-between gap-3.5 p-4 sm:p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.accent}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="tabular-nums mt-1.5 truncate text-xl font-black text-slate-900 sm:text-2xl">
          {value}
        </p>
        {caption && (
          <p className="truncate text-[11px] font-medium text-slate-500 mt-1">{caption}</p>
        )}
      </div>
      {Icon && (
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${styles.iconBg} text-white shadow-md ${styles.shadow}`}
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
      )}
    </article>
  )
}
