/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BarChart3, Boxes, CalendarDays, CircleDollarSign, Download, PackageOpen, ReceiptText, RefreshCw, ShoppingBag, TrendingUp, WalletCards } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import { getReportData } from '../services/reportService'
import { formatCurrency, formatNumber, localDateKey } from '../lib/formatters'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import { downloadCsv } from '../lib/exportCsv'

const dateOnlyFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const shortDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' })

function dateKey(value) {
  return value ? String(value).slice(0, 10) : ''
}

function parseDateKey(value) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDateKey(dateKey(value))
  return date ? dateOnlyFormatter.format(date) : '—'
}

function formatShortDate(value) {
  const date = parseDateKey(dateKey(value))
  return date ? shortDateFormatter.format(date) : '—'
}

function rangeFor(preset, customStart, customEnd) {
  const today = parseDateKey(localDateKey())
  if (!today) return { start: '', end: '' }
  if (preset === 'today') return { start: localDateKey(today), end: localDateKey(today) }
  if (preset === 'month') return { start: localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: localDateKey(today) }
  if (preset === 'custom') return { start: customStart || localDateKey(today), end: customEnd || localDateKey(today) }

  const days = Number(preset) || 30
  const start = new Date(today)
  start.setDate(start.getDate() - days + 1)
  return { start: localDateKey(start), end: localDateKey(today) }
}

function inRange(value, range) {
  const key = dateKey(value)
  return key >= range.start && key <= range.end
}

function weekStart(value) {
  const date = parseDateKey(value)
  if (!date) return value
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return localDateKey(date)
}

function calculateReport(data, range) {
  const sales = data.sales.filter((order) => inRange(order.order_date, range) && !['cancelled', 'draft'].includes(order.status))
  const purchases = data.purchases.filter((order) => inRange(order.order_date, range) && !['cancelled', 'draft'].includes(order.status))
  const salesReturns = data.returns.filter((row) => row.type === 'sales' && inRange(row.date, range) && !['cancelled', 'canceled', 'draft'].includes(row.status.toLowerCase()))
  const purchaseReturns = data.returns.filter((row) => row.type === 'purchase' && inRange(row.date, range) && !['cancelled', 'canceled', 'draft'].includes(row.status.toLowerCase()))
  const transactions = data.finance.transactions.filter((transaction) => inRange(transaction.transaction_date, range) && transaction.status !== 'cancelled')
  const salesIds = new Set(sales.map((order) => order.id))
  const saleItems = data.salesItems.filter((item) => salesIds.has(item.sales_order_id))
  const salesReturnIds = new Set(salesReturns.map((row) => row.rawId))
  const returnedSaleItems = data.salesReturnItems.filter((item) => salesReturnIds.has(item.sales_return_id))
  const revenue = sales.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
    - salesReturns.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
  const cost = saleItems.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)), 0)
    - returnedSaleItems.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)), 0)
  const purchaseTotal = purchases.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
    - purchaseReturns.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
  const cashIn = transactions.filter((transaction) => transaction.direction === 'in').reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
  const cashOut = transactions.filter((transaction) => transaction.direction === 'out').reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
  const span = Math.round((new Date(`${range.end}T00:00:00`) - new Date(`${range.start}T00:00:00`)) / 86400000) + 1
  const bucket = (value) => span > 45 ? weekStart(dateKey(value)) : dateKey(value)
  const trendMap = new Map()
  sales.forEach((order) => {
    const key = bucket(order.order_date)
    const row = trendMap.get(key) || { key, revenue: 0, orders: 0 }
    row.revenue += Number(order.total) || 0
    row.orders += 1
    trendMap.set(key, row)
  })
  salesReturns.forEach((returned) => {
    const key = bucket(returned.date)
    const row = trendMap.get(key) || { key, revenue: 0, orders: 0 }
    row.revenue -= Number(returned.total) || 0
    trendMap.set(key, row)
  })
  const trend = [...trendMap.values()].sort((a, b) => a.key.localeCompare(b.key))
  const productsMap = new Map()
  saleItems.forEach((item) => {
    const row = productsMap.get(item.product_id) || { id: item.product_id, name: item.product_name, code: item.product_code, quantity: 0, revenue: 0, cost: 0 }
    const quantity = Number(item.quantity) || 0
    row.quantity += quantity
    row.revenue += Number(item.line_total) || quantity * (Number(item.unit_price) || 0)
    row.cost += quantity * (Number(item.unit_cost) || 0)
    productsMap.set(item.product_id, row)
  })
  returnedSaleItems.forEach((item) => {
    const row = productsMap.get(item.product_id) || { id: item.product_id, name: item.product_name, code: item.product_code, quantity: 0, revenue: 0, cost: 0 }
    const quantity = Number(item.quantity) || 0
    row.quantity -= quantity
    row.revenue -= Number(item.net_line_total ?? item.line_total) || quantity * (Number(item.unit_price) || 0)
    row.cost -= quantity * (Number(item.unit_cost) || 0)
    productsMap.set(item.product_id, row)
  })
  const topProducts = [...productsMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
  const channelMap = new Map()
  sales.forEach((order) => {
    const key = order.channel === 'pos' ? 'Bán hàng nhanh' : 'Bán hàng'
    channelMap.set(key, (channelMap.get(key) || 0) + (Number(order.total) || 0))
  })
  const salesById = new Map(data.sales.map((order) => [order.id, order]))
  salesReturns.forEach((returned) => {
    const source = salesById.get(returned.sales_order_id)
    const key = source?.channel === 'pos' ? 'Bán hàng nhanh' : 'Bán hàng'
    channelMap.set(key, (channelMap.get(key) || 0) - (Number(returned.total) || 0))
  })
  const channels = [...channelMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const lowStock = data.inventory.products
    .filter((product) => Number(product.stock_on_hand) <= Number(product.min_stock))
    .sort((a, b) => Number(a.stock_on_hand) - Number(b.stock_on_hand))
    .slice(0, 8)

  return { sales, purchases, transactions, revenue, cost, purchaseTotal, cashIn, cashOut, trend, topProducts, channels, lowStock }
}

export default function Reports() {
  const { businessId } = useBusiness()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const range = useMemo(() => rangeFor(preset, customStart, customEnd), [preset, customStart, customEnd])
  const report = useMemo(() => data ? calculateReport(data, range) : null, [data, range])
  const invalidRange = range.start > range.end

  const loadReports = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError('')
    try {
      setData(await getReportData(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được dữ liệu báo cáo. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  function exportReport() {
    if (!report) return
    downloadCsv(`bao-cao-ban-hang-${range.start}-${range.end}.csv`, [
      { key: 'code', label: 'Mã đơn' },
      { key: 'order_date', label: 'Ngày bán' },
      { key: 'customer_name', label: 'Khách hàng' },
      { key: 'channel', label: 'Kênh bán' },
      { key: 'total', label: 'Tổng ban đầu' },
      { key: 'return_total', label: 'Hàng trả lại' },
      { key: 'net_total', label: 'Doanh thu ròng' },
      { key: 'paid_amount', label: 'Đã thu' },
      { key: 'balance_due', label: 'Còn nợ' },
      { key: 'status', label: 'Trạng thái' },
    ], report.sales.map((order) => ({ ...order, channel: order.channel === 'pos' ? 'Bán hàng nhanh' : 'Bán hàng', net_total: order.net_total ?? order.total })))
  }

  return (
    <div>
      <div className="page-heading">
        <div><p className="page-eyebrow">Phân tích kinh doanh</p><h1 className="page-title">Báo cáo</h1><p className="page-description">Theo dõi doanh thu, lợi nhuận, dòng tiền và hàng hóa theo từng giai đoạn.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={exportReport} disabled={loading || !report}><Download size={17} /> Xuất CSV</button><button className="btn-secondary" type="button" onClick={loadReports} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} size={17} /> Làm mới</button></div>
      </div>

      <section className="surface mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-600"><CalendarDays size={19} /></span><div><p className="text-sm font-bold text-slate-800">Khoảng thời gian</p><p className="mt-0.5 text-xs text-slate-400">{formatDate(range.start)} — {formatDate(range.end)}</p></div></div>
        <div className="flex flex-wrap items-end gap-2"><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">Xem theo</span><select className="field w-full sm:w-44" value={preset} onChange={(event) => setPreset(event.target.value)}><option value="today">Hôm nay</option><option value="7">7 ngày gần nhất</option><option value="30">30 ngày gần nhất</option><option value="90">90 ngày gần nhất</option><option value="month">Tháng này</option><option value="custom">Tùy chọn</option></select></label>{preset === 'custom' && <><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">Từ ngày</span><input className="field" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-500">Đến ngày</span><input className="field" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}</div>
      </section>

      {invalidRange ? <section className="surface p-8 text-center"><p className="text-sm font-semibold text-rose-700">Khoảng thời gian không hợp lệ. Vui lòng chọn ngày kết thúc sau ngày bắt đầu.</p></section> : error ? <section className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center"><div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><BarChart3 size={27} /></div><h2 className="mt-4 text-lg font-bold text-slate-900">Chưa thể tải báo cáo</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{error}</p><button className="btn-primary mt-5" type="button" onClick={loadReports}><RefreshCw size={17} /> Thử lại</button></section> : loading || !report ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Loading rows={4} /></div> : <ReportContent report={report} />}
    </div>
  )
}

function ReportContent({ report }) {
  const grossProfit = report.revenue - report.cost
  const averageOrder = report.sales.length ? report.revenue / report.sales.length : 0
  const maxTrend = Math.max(1, ...report.trend.map((row) => row.revenue))
  const maxProduct = Math.max(1, ...report.topProducts.map((product) => product.revenue))
  const maxChannel = Math.max(1, ...report.channels.map((channel) => channel.value))

  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={CircleDollarSign} label="Doanh thu bán hàng" value={formatCurrency(report.revenue)} caption={`${formatNumber(report.sales.length)} đơn đã xác nhận`} tone="emerald" /><MetricCard icon={TrendingUp} label="Lợi nhuận gộp" value={formatCurrency(grossProfit)} caption="Doanh thu trừ giá vốn dòng hàng" tone="sky" /><MetricCard icon={ReceiptText} label="Giá trị đơn trung bình" value={formatCurrency(averageOrder)} caption="Tính trên đơn không hủy" tone="indigo" /><MetricCard icon={ShoppingBag} label="Tổng giá trị nhập" value={formatCurrency(report.purchaseTotal)} caption={`${formatNumber(report.purchases.length)} phiếu nhập trong kỳ`} tone="violet" /></section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><article className="surface overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="section-title">Doanh thu theo thời gian</h2><p className="section-description">Thanh cao hơn thể hiện doanh thu lớn hơn trong kỳ.</p></div><BarChart3 className="text-sky-500" size={21} /></div>{report.trend.length === 0 ? <EmptyState icon={BarChart3} title="Chưa có doanh thu trong kỳ" description="Các đơn bán hợp lệ sẽ xuất hiện trên biểu đồ này." /> : <div className="p-5 sm:p-6"><div className="flex h-56 items-end gap-1.5 sm:gap-2">{report.trend.map((row) => <div className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2" key={row.key}><div className="relative flex h-44 w-full items-end justify-center"><div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-sky-500 to-emerald-400 transition group-hover:from-sky-600 group-hover:to-emerald-500" style={{ height: `${Math.max(5, (row.revenue / maxTrend) * 100)}%` }} title={`${formatShortDate(row.key)}: ${formatCurrency(row.revenue)}`} /></div><span className="max-w-full truncate text-[10px] font-semibold text-slate-400">{formatShortDate(row.key)}</span></div>)}</div><div className="mt-4 flex items-center justify-between text-xs text-slate-400"><span>{report.trend.length > 1 ? `${formatShortDate(report.trend[0].key)} — ${formatShortDate(report.trend[report.trend.length - 1].key)}` : formatShortDate(report.trend[0]?.key)}</span><span className="font-bold text-slate-600">{formatNumber(report.sales.length)} đơn</span></div></div>}</article><article className="surface overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="section-title">Theo kênh bán</h2><p className="section-description">Phân bổ doanh thu theo nơi tạo đơn.</p></div>{report.channels.length === 0 ? <EmptyState icon={ShoppingBag} title="Chưa có dữ liệu kênh bán" /> : <div className="space-y-5 p-5 sm:p-6">{report.channels.map((channel) => <div key={channel.label}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{channel.label}</span><span className="font-extrabold text-slate-900">{formatCurrency(channel.value)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500" style={{ width: `${Math.max(8, (channel.value / maxChannel) * 100)}%` }} /></div></div>)}</div>}</article></section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><article className="surface overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="section-title">Sản phẩm đóng góp doanh thu</h2><p className="section-description">Xếp theo giá trị bán trong khoảng thời gian đã chọn.</p></div><WalletCards className="text-violet-500" size={21} /></div>{report.topProducts.length === 0 ? <EmptyState icon={ShoppingBag} title="Chưa có sản phẩm bán ra" /> : <div className="divide-y divide-slate-100">{report.topProducts.map((product, index) => <div className="flex items-center gap-3 px-5 py-4 sm:px-6" key={product.id || product.name}><span className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${index < 3 ? 'bg-gradient-to-br from-sky-500 to-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-bold text-slate-800">{product.name}</p><p className="shrink-0 text-xs font-bold text-slate-600">{formatNumber(product.quantity)} {product.quantity === 1 ? 'đơn vị' : 'đơn vị'}</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(8, (product.revenue / maxProduct) * 100)}%` }} /></div></div><p className="hidden min-w-28 text-right text-sm font-extrabold text-slate-900 sm:block">{formatCurrency(product.revenue)}</p></div>)}</div>}</article><article className="surface overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="section-title">Cảnh báo tồn kho</h2><p className="section-description">Mặt hàng chạm hoặc thấp hơn tồn tối thiểu.</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{formatNumber(report.lowStock.length)}</span></div>{report.lowStock.length === 0 ? <EmptyState icon={Boxes} title="Tồn kho đang ổn định" description="Chưa có mặt hàng nào cần bổ sung." /> : <div className="divide-y divide-slate-100">{report.lowStock.map((product) => <div className="flex items-center gap-3 px-5 py-4 sm:px-6" key={product.id}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><PackageOpen size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{product.name}</p><p className="mt-1 text-xs text-slate-400">{product.code || 'Chưa có mã'} · Mức tối thiểu {formatNumber(product.min_stock)}</p></div><p className="text-right text-sm font-extrabold text-amber-700">{formatNumber(product.stock_on_hand)} {product.unit}</p></div>)}</div>}</article></section>

    <section className="surface mt-5 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="section-title">Dòng tiền trong kỳ</h2><p className="section-description">Tổng hợp các giao dịch đã ghi nhận trong sổ quỹ.</p></div><div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5"><CashMetric icon={ArrowDownLeft} label="Khoản thu" value={report.cashIn} tone="emerald" /><CashMetric icon={ArrowUpRight} label="Khoản chi" value={report.cashOut} tone="rose" /><CashMetric icon={WalletCards} label="Chênh lệch thu chi" value={report.cashIn - report.cashOut} tone={report.cashIn - report.cashOut >= 0 ? 'sky' : 'rose'} /></div></section>
  </>
}

const metricTones = { sky: 'bg-sky-50 text-sky-600', emerald: 'bg-emerald-50 text-emerald-600', indigo: 'bg-indigo-50 text-indigo-600', violet: 'bg-violet-50 text-violet-600' }
function MetricCard({ icon: Icon, label, value, caption, tone }) { return <article className="surface relative overflow-hidden p-5"><div className={`absolute -right-7 -top-7 size-24 rounded-full opacity-50 ${metricTones[tone]}`} /><div className="relative flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-3 truncate text-2xl font-extrabold tracking-tight text-slate-950">{value}</p><p className="mt-2 text-xs font-medium text-slate-400">{caption}</p></div><div className={`grid size-11 shrink-0 place-items-center rounded-2xl ${metricTones[tone]}`}><Icon size={22} /></div></div></article> }
function CashMetric({ icon: Icon, label, value, tone }) { const positive = value >= 0; return <article className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-1 truncate text-lg font-extrabold ${label === 'Chênh lệch thu chi' && !positive ? 'text-rose-600' : 'text-slate-900'}`}>{formatCurrency(value)}</p></div></article> }
