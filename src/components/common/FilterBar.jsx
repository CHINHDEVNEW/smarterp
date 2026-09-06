import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'

export default function FilterBar({
  search,
  searchValue,
  onSearchChange,
  placeholder,
  searchPlaceholder = 'Tìm kiếm...',
  children,
  onRefresh,
  loading = false,
  refreshing = false,
  className = '',
}) {
  const currentSearch = search ?? searchValue ?? ''
  const currentPlaceholder = placeholder ?? searchPlaceholder ?? 'Tìm kiếm...'
  const isLoading = Boolean(loading || refreshing)

  return (
    <div
      className={`flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-4.5 ${className}`}
    >
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={17}
        />
        <input
          className="field pl-10 pr-9 text-sm placeholder:text-slate-400"
          value={currentSearch}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={currentPlaceholder}
        />
        {currentSearch && (
          <button
            type="button"
            onClick={() => onSearchChange?.('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
            aria-label="Xóa tìm kiếm"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {children && (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-initial">
            <SlidersHorizontal
              className="hidden text-slate-400 sm:block"
              size={17}
            />
            {children}
          </div>
        )}

        {onRefresh && (
          <button
            className="btn-icon shrink-0"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Làm mới dữ liệu"
            title="Làm mới"
          >
            <RefreshCw
              className={`text-slate-500 ${isLoading ? 'animate-spin' : ''}`}
              size={17}
            />
          </button>
        )}
      </div>
    </div>
  )
}
