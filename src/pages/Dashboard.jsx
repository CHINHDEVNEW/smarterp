/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Banknote, Boxes, PackageOpen, ReceiptText, RefreshCw, ShoppingBag, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useBusiness from '../hooks/useBusiness'
import { getDashboardData } from '../services/dashboardService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import Loading from '../components/common/Loading'
import EmptyState from '../components/common/EmptyState'

const statusLabels = {
  draft: 'Bản nháp',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

function MetricCard({ icon: Icon, label, value, caption, tone }) {
  return (
    <article className="surface relative overflow-hidden p-5">
      <div className={`absolute -right-7 -top-7 size-24 rounded-full opacity-50 ${tone.glow}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 truncate text-2xl font-extrabold tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">{caption}</p>
        </div>
        <div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tone.icon}`}><Icon size={22} /></div>
      </div>
    </article>
  )
}

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
    <div>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">{todayLabel}</p>
          <h1 className="page-title">Chào mừng trở lại{business?.name ? `, ${business.name}` : ''}</h1>
          <p className="page-description">Theo dõi nhanh tình hình bán hàng, tồn kho và công nợ.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadData} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} size={17} /> Làm mới</button>
      </div>

      {error ? (
        <section className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><TrendingUp size={27} /></div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Chưa thể tải tổng quan</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{error}</p>
          <button className="btn-primary mt-5" type="button" onClick={loadData}><RefreshCw size={17} /> Thử lại</button>
        </section>
      ) : loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Loading rows={4} /></div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Banknote} label="Doanh thu hôm nay" value={formatCurrency(data.revenueToday)} caption="Không gồm đơn đã hủy" tone={{ icon: 'bg-emerald-50 text-emerald-600', glow: 'bg-emerald-100' }} />
            <MetricCard icon={ReceiptText} label="Đơn hàng hôm nay" value={formatNumber(data.ordersToday)} caption="Tất cả kênh bán hàng" tone={{ icon: 'bg-sky-50 text-sky-600', glow: 'bg-sky-100' }} />
            <MetricCard icon={PackageOpen} label="Tồn kho thấp" value={formatNumber(data.lowStock.length)} caption="Đã chạm mức tồn tối thiểu" tone={{ icon: 'bg-amber-50 text-amber-600', glow: 'bg-amber-100' }} />
            <MetricCard icon={ShoppingBag} label="Công nợ phải thu" value={formatCurrency(data.receivable)} caption="Tính từ các khoản thanh toán" tone={{ icon: 'bg-rose-50 text-rose-600', glow: 'bg-rose-100' }} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <article className="surface overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="section-title">Sản phẩm bán chạy</h2>
                  <p className="section-description">Xếp hạng theo tổng số lượng đã bán.</p>
                </div>
                <button className="link-button" type="button" onClick={() => navigate('/products')}>Xem sản phẩm <ArrowRight size={15} /></button>
              </div>
              <div className="p-5 sm:p-6">
                {data.topProducts.length === 0 ? (
                  <EmptyState icon={Boxes} title="Chưa có dữ liệu bán hàng" description="Sản phẩm bán chạy sẽ xuất hiện sau khi có đơn đầu tiên." />
                ) : (
                  <div className="space-y-4">
                    {data.topProducts.map((product, index) => {
                      const max = data.topProducts[0]?.quantity || 1
                      const percentage = Math.max(8, (product.quantity / max) * 100)
                      return (
                        <div key={product.id} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3">
                          <span className={`grid size-8 place-items-center rounded-xl text-xs font-extrabold ${index < 3 ? 'bg-gradient-to-br from-sky-500 to-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-sm font-bold text-slate-800">{product.name}</p>
                              <p className="shrink-0 text-xs font-bold text-slate-600">{formatNumber(product.quantity)} SP</p>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${percentage}%` }} /></div>
                          </div>
                          <p className="hidden min-w-24 text-right text-xs font-semibold text-slate-400 sm:block">{formatCurrency(product.revenue)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </article>

            <article className="surface overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="section-title">Cảnh báo tồn kho</h2>
                  <p className="section-description">Các mặt hàng cần được bổ sung.</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{data.lowStock.length}</span>
              </div>
              <div className="max-h-[390px] overflow-y-auto p-3">
                {data.lowStock.length === 0 ? (
                  <EmptyState icon={PackageOpen} title="Tồn kho đang ổn định" description="Chưa có mặt hàng nào chạm mức tối thiểu." />
                ) : data.lowStock.slice(0, 8).map((product) => (
                  <button key={product.id} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50" type="button" onClick={() => navigate(`/products?q=${encodeURIComponent(product.code || product.sku || product.name)}`)}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><PackageOpen size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800">{product.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{product.code || product.sku || 'Chưa có mã'}</span>
                    </span>
                    <span className="text-right text-xs font-bold text-amber-700">{formatNumber(product.stock_on_hand)} {product.unit}</span>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <section className="surface mt-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="section-title">Giao dịch gần đây</h2>
                <p className="section-description">Các đơn bán mới nhất trong hệ thống.</p>
              </div>
              <button className="link-button" type="button" onClick={() => navigate('/sales')}>Xem tất cả <ArrowRight size={15} /></button>
            </div>
            {data.recentOrders.length === 0 ? (
              <EmptyState icon={ReceiptText} title="Chưa có giao dịch" description="Đơn bán mới sẽ xuất hiện tại đây." />
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><ReceiptText size={19} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-800">{order.code}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{order.channel === 'pos' ? 'POS' : 'Bán hàng'}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(order.order_date)} · {statusLabels[order.status] ?? order.status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-slate-900">{formatCurrency(order.total)}</p>
                      {Number(order.balance_due) > 0 && <p className="mt-1 text-xs font-semibold text-rose-600">Còn nợ {formatCurrency(order.balance_due)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
