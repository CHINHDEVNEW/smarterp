export default function AppLoading({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="grid min-h-[320px] place-items-center p-6">
      <div className="text-center">
        <div className="mx-auto size-11 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
        <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}
