/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Boxes,
  CalendarDays,
  Package,
  PackageOpen,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  WalletCards,
  Warehouse,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useBusiness from '../hooks/useBusiness'
import { getDashboardData } from '../services/dashboardService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import StatusBadge from '../components/common/StatusBadge'
import { Skeleton } from '../components/common/Skeleton'

export default function Dashboard() {
  const { business, businessId } = useBusiness()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError('')
    try {
      setData(await getDashboardData(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được dữ liệu tổng quan. Vui lòng kiểm tra kết nối và thử lại.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const todayLabel = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="space-y-6">
      {/* Premium Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-72 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-200 backdrop-blur-sm">
                <CalendarDays size={14} />
                <span>{todayLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Hệ thống trực tuyến</span>
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Chào mừng trở lại, {business?.name || 'SmartERP'}
            </h1>
            <p className="max-w-xl text-xs text-slate-300 sm:text-sm leading-relaxed">
              Theo dõi tình hình kinh doanh hôm nay: doanh số bán lẻ, biến động tồn kho và công nợ khách hàng tức thời.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition duration-150 hover:brightness-105 active:scale-95"
              type="button"
              onClick={() => navigate('/pos')}
            >
              <Zap size={16} />
              <span>Bán hàng POS</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition duration-150 hover:bg-white/20 active:scale-95"
              type="button"
              onClick={() => navigate('/products?new=1')}
            >
              <Plus size={16} />
              <span>Thêm hàng hóa</span>
            </button>
            <button
              className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-sm transition duration-150 hover:bg-white/20 active:scale-95"
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <section className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
            <TrendingUp size={26} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">Chưa thể tải tổng quan</h2>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">{error}</p>
          <button className="btn-primary mt-5" type="button" onClick={loadData}>
            <RefreshCw size={16} /> Thử lại
          </button>
        </section>
      ) : loading || !data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="surface p-5 space-y-3">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-8 w-36 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <div className="surface p-5 space-y-4">
              <Skeleton className="h-5 w-40 rounded" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="surface p-5 space-y-4">
              <Skeleton className="h-5 w-36 rounded" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 4 High-Impact KPI Cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Revenue */}
            <article className="surface relative overflow-hidden p-5 sm:p-6 transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Doanh thu hôm nay
                  </p>
                  <p className="tabular-nums mt-2.5 truncate text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    {formatCurrency(data.revenueToday)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Hôm nay
                    </span>
                    <span className="truncate">Không tính đơn hủy</span>
                  </div>
                </div>
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
                  <Banknote size={24} />
                </div>
              </div>
            </article>

            {/* Orders */}
            <article className="surface relative overflow-hidden p-5 sm:p-6 transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-400" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Đơn hàng hôm nay
                  </p>
                  <p className="tabular-nums mt-2.5 truncate text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                    {formatNumber(data.ordersToday)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                      Tất cả kênh
                    </span>
                    <span className="truncate">POS & Đơn bán lẻ</span>
                  </div>
                </div>
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/25">
                  <ReceiptText size={24} />
                </div>
              </div>
            </article>

            {/* Low Stock */}
            <article
              className="surface relative overflow-hidden p-5 sm:p-6 transition hover:shadow-md cursor-pointer"
              onClick={() => navigate('/inventory')}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Tồn kho thấp
                  </p>
                  <p
                    className={`tabular-nums mt-2.5 truncate text-2xl font-black tracking-tight sm:text-3xl ${
                      data.lowStock.length > 0 ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {formatNumber(data.lowStock.length)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Cảnh báo
                    </span>
                    <span className="truncate">Chạm ngưỡng tối thiểu</span>
                  </div>
                </div>
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25">
                  <Boxes size={24} />
                </div>
              </div>
            </article>

            {/* Receivable Debt */}
            <article
              className="surface relative overflow-hidden p-5 sm:p-6 transition hover:shadow-md cursor-pointer"
              onClick={() => navigate('/customers')}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Công nợ phải thu
                  </p>
                  <p
                    className={`tabular-nums mt-2.5 truncate text-2xl font-black tracking-tight sm:text-3xl ${
                      Number(data.receivable) > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {formatCurrency(data.receivable)}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      Khách nợ
                    </span>
                    <span className="truncate">Cần đối soát thanh toán</span>
                  </div>
                </div>
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25">
                  <WalletCards size={24} />
                </div>
              </div>
            </article>
          </section>

          {/* Quick Launchpad (SaaS Navigation Shortcuts) */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <button
              className="surface group flex items-center gap-3.5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
              type="button"
              onClick={() => navigate('/pos')}
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 transition group-hover:bg-sky-600 group-hover:text-white">
                <Zap size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">Bán hàng POS</p>
                <p className="truncate text-xs text-slate-400">Quẹt đơn & in bill nhanh</p>
              </div>
            </button>

            <button
              className="surface group flex items-center gap-3.5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              type="button"
              onClick={() => navigate('/inventory')}
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition group-hover:bg-emerald-600 group-hover:text-white">
                <Warehouse size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">Quản lý kho</p>
                <p className="truncate text-xs text-slate-400">Tồn kho & sổ biến động</p>
              </div>
            </button>

            <button
              className="surface group flex items-center gap-3.5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              type="button"
              onClick={() => navigate('/finance')}
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition group-hover:bg-indigo-600 group-hover:text-white">
                <Banknote size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">Sổ quỹ thu chi</p>
                <p className="truncate text-xs text-slate-400">Dòng tiền & tài khoản</p>
              </div>
            </button>

            <button
              className="surface group flex items-center gap-3.5 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
              type="button"
              onClick={() => navigate('/reports')}
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 transition group-hover:bg-violet-600 group-hover:text-white">
                <BarChart3 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">Báo cáo kinh doanh</p>
                <p className="truncate text-xs text-slate-400">Doanh thu & biểu đồ</p>
              </div>
            </button>
          </section>

          {/* Analytics Panels: Top Products & Low Stock */}
          <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
            {/* Top Products */}
            <section className="surface flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Sản phẩm bán chạy</h2>
                  <p className="text-xs text-slate-500">Xếp hạng theo sản lượng đã xuất bán</p>
                </div>
                <button
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
                  type="button"
                  onClick={() => navigate('/products')}
                >
                  <span>Xem tất cả</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="flex-1 p-5">
                {data.topProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="grid size-14 place-items-center rounded-3xl bg-sky-50 text-sky-600 ring-8 ring-sky-50/50">
                      <ShoppingBag size={26} />
                    </div>
                    <h3 className="mt-4 text-sm font-bold text-slate-800">
                      Chưa có giao dịch bán hàng
                    </h3>
                    <p className="mt-1 max-w-xs text-xs text-slate-400 leading-relaxed">
                      Sản phẩm có lượng bán nhiều nhất sẽ tự động xuất hiện và xếp hạng tại đây.
                    </p>
                    <button
                      className="btn-primary mt-4 text-xs h-9"
                      type="button"
                      onClick={() => navigate('/pos')}
                    >
                      <Zap size={14} />
                      <span>Mở quầy POS ngay</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.topProducts.map((product, index) => {
                      const maxQty = data.topProducts[0]?.quantity || 1
                      const percent = Math.min(100, Math.round((product.quantity / maxQty) * 100))
                      const medalColors = [
                        'bg-amber-400 text-amber-950 ring-amber-200',
                        'bg-slate-300 text-slate-800 ring-slate-200',
                        'bg-amber-600 text-white ring-amber-400',
                      ]
                      return (
                        <div key={product.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black ring-2 ${
                                  medalColors[index] ?? 'bg-slate-100 text-slate-500 ring-slate-100'
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="truncate font-bold text-slate-800">
                                {product.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="tabular-nums font-extrabold text-slate-900">
                                {formatNumber(product.quantity)} sp
                              </span>
                              <span className="tabular-nums text-slate-400 hidden sm:inline">
                                {formatCurrency(product.revenue)}
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                              style={{ width: `${Math.max(5, percent)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Low Stock Warning */}
            <section className="surface flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Cảnh báo tồn kho</h2>
                  <p className="text-xs text-slate-500">Mặt hàng chạm hoặc dưới mức tối thiểu</p>
                </div>
                <span
                  className={`tabular-nums rounded-full px-2.5 py-1 text-xs font-bold ${
                    data.lowStock.length > 0
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {data.lowStock.length} mặt hàng
                </span>
              </div>

              <div className="flex-1 p-5">
                {data.lowStock.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="grid size-14 place-items-center rounded-3xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
                      <ShieldCheck size={26} />
                    </div>
                    <h3 className="mt-4 text-sm font-bold text-slate-800">
                      Tồn kho an toàn
                    </h3>
                    <p className="mt-1 max-w-xs text-xs text-slate-400 leading-relaxed">
                      Tất cả mặt hàng đang theo dõi đều nằm trên mức tồn kho tối thiểu.
                    </p>
                    <button
                      className="btn-secondary mt-4 text-xs h-9"
                      type="button"
                      onClick={() => navigate('/inventory')}
                    >
                      <Warehouse size={14} />
                      <span>Xem sổ kho</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 -mx-5 -my-2">
                    {data.lowStock.slice(0, 5).map((product) => {
                      const isOut = Number(product.stock_on_hand) <= 0
                      return (
                        <div
                          key={product.id}
                          className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {product.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {product.code || product.sku || 'Chưa có mã'} · Mức min:{' '}
                              <span className="tabular-nums">{formatNumber(product.min_stock)}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`tabular-nums inline-block rounded-lg px-2.5 py-1 text-xs font-black ${
                                isOut
                                  ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}
                            >
                              Tồn: {formatNumber(product.stock_on_hand)} {product.unit}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Recent Orders Stream */}
          {data.recentOrders.length > 0 && (
            <section className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Giao dịch gần đây</h2>
                  <p className="text-xs text-slate-500">Các đơn bán hàng mới phát sinh trong hệ thống</p>
                </div>
                <button
                  className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
                  type="button"
                  onClick={() => navigate('/sales')}
                >
                  <span>Xem sổ bán hàng</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {data.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-2 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                        <ReceiptText size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{order.code}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          <span className="tabular-nums">{formatDateTime(order.order_date)}</span> ·{' '}
                          {order.channel === 'pos' ? 'Bán hàng nhanh POS' : 'Đơn bán'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <StatusBadge status={order.status} size="sm" />
                      <p className="tabular-nums text-sm font-black text-slate-900">
                        {formatCurrency(order.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
