/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import { getReportData } from '../services/reportService'
import { formatCurrency, formatNumber, localDateKey } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import { downloadCsv } from '../lib/exportCsv'

const dateOnlyFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
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

const PRESET_OPTIONS = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7', label: '7 ngày' },
  { id: '30', label: '30 ngày' },
  { id: '90', label: '90 ngày' },
  { id: 'month', label: 'Tháng này' },
  { id: 'quarter', label: 'Quý này' },
  { id: 'year', label: 'Năm nay' },
  { id: 'custom', label: 'Tùy chọn' },
]

function rangeFor(preset, customStart, customEnd) {
  const today = parseDateKey(localDateKey())
  if (!today) return { start: '', end: '' }
  if (preset === 'today') return { start: localDateKey(today), end: localDateKey(today) }
  if (preset === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    return { start: localDateKey(yesterday), end: localDateKey(yesterday) }
  }
  if (preset === 'month') {
    return {
      start: localDateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: localDateKey(today),
    }
  }
  if (preset === 'quarter') {
    const currentQuarter = Math.floor(today.getMonth() / 3)
    const start = new Date(today.getFullYear(), currentQuarter * 3, 1)
    return { start: localDateKey(start), end: localDateKey(today) }
  }
  if (preset === 'year') {
    return {
      start: localDateKey(new Date(today.getFullYear(), 0, 1)),
      end: localDateKey(today),
    }
  }
  if (preset === 'custom') {
    return {
      start: customStart || localDateKey(today),
      end: customEnd || localDateKey(today),
    }
  }

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
  const sales = data.sales.filter(
    (order) => inRange(order.order_date, range) && !['cancelled', 'draft'].includes(order.status)
  )
  const purchases = data.purchases.filter(
    (order) => inRange(order.order_date, range) && !['cancelled', 'draft'].includes(order.status)
  )
  const salesReturns = data.returns.filter(
    (row) =>
      row.type === 'sales' &&
      inRange(row.date, range) &&
      !['cancelled', 'canceled', 'draft'].includes(row.status.toLowerCase())
  )
  const purchaseReturns = data.returns.filter(
    (row) =>
      row.type === 'purchase' &&
      inRange(row.date, range) &&
      !['cancelled', 'canceled', 'draft'].includes(row.status.toLowerCase())
  )
  const transactions = data.finance.transactions.filter(
    (transaction) => inRange(transaction.transaction_date, range) && transaction.status !== 'cancelled'
  )
  const salesIds = new Set(sales.map((order) => order.id))
  const saleItems = data.salesItems.filter((item) => salesIds.has(item.sales_order_id))
  const salesReturnIds = new Set(salesReturns.map((row) => row.rawId))
  const returnedSaleItems = data.salesReturnItems.filter((item) =>
    salesReturnIds.has(item.sales_return_id)
  )
  const revenue =
    sales.reduce((sum, order) => sum + (Number(order.total) || 0), 0) -
    salesReturns.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
  const cost =
    saleItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0),
      0
    ) -
    returnedSaleItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0),
      0
    )
  const purchaseTotal =
    purchases.reduce((sum, order) => sum + (Number(order.total) || 0), 0) -
    purchaseReturns.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
  const cashIn = transactions
    .filter((transaction) => transaction.direction === 'in')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
  const cashOut = transactions
    .filter((transaction) => transaction.direction === 'out')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0)
  const span =
    Math.round(
      (new Date(`${range.end}T00:00:00`) - new Date(`${range.start}T00:00:00`)) / 86400000
    ) + 1
  const bucket = (value) => (span > 45 ? weekStart(dateKey(value)) : dateKey(value))
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
    const row = productsMap.get(item.product_id) || {
      id: item.product_id,
      name: item.product_name,
      code: item.product_code,
      quantity: 0,
      revenue: 0,
      cost: 0,
    }
    const quantity = Number(item.quantity) || 0
    row.quantity += quantity
    row.revenue += Number(item.line_total) || quantity * (Number(item.unit_price) || 0)
    row.cost += quantity * (Number(item.unit_cost) || 0)
    productsMap.set(item.product_id, row)
  })
  returnedSaleItems.forEach((item) => {
    const row = productsMap.get(item.product_id) || {
      id: item.product_id,
      name: item.product_name,
      code: item.product_code,
      quantity: 0,
      revenue: 0,
      cost: 0,
    }
    const quantity = Number(item.quantity) || 0
    row.quantity -= quantity
    row.revenue -=
      Number(item.net_line_total ?? item.line_total) || quantity * (Number(item.unit_price) || 0)
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
  const channels = [...channelMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
  const lowStock = data.inventory.products
    .filter((product) => Number(product.stock_on_hand) <= Number(product.min_stock))
    .sort((a, b) => Number(a.stock_on_hand) - Number(b.stock_on_hand))
    .slice(0, 8)

  return {
    sales,
    purchases,
    transactions,
    revenue,
    cost,
    purchaseTotal,
    cashIn,
    cashOut,
    trend,
    topProducts,
    channels,
    lowStock,
  }
}

export default function Reports() {
  const { businessId } = useBusiness()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const range = useMemo(
    () => rangeFor(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  )
  const report = useMemo(() => (data ? calculateReport(data, range) : null), [data, range])
  const invalidRange = range.start > range.end

  const spanDays = useMemo(() => {
    if (!range.start || !range.end) return 0
    const start = new Date(`${range.start}T00:00:00`)
    const end = new Date(`${range.end}T00:00:00`)
    const diff = Math.round((end - start) / 86400000) + 1
    return Math.max(0, diff)
  }, [range.start, range.end])

  function shiftRange(direction) {
    const currentStart = parseDateKey(range.start)
    const currentEnd = parseDateKey(range.end)
    if (!currentStart || !currentEnd) return
    const diffTime = currentEnd.getTime() - currentStart.getTime()
    const stepDays = Math.max(1, Math.round(diffTime / 86400000) + 1)

    if (direction === 'prev') {
      const newEnd = new Date(currentStart)
      newEnd.setDate(newEnd.getDate() - 1)
      const newStart = new Date(newEnd)
      newStart.setDate(newStart.getDate() - stepDays + 1)
      setCustomStart(localDateKey(newStart))
      setCustomEnd(localDateKey(newEnd))
      setPreset('custom')
    } else {
      const newStart = new Date(currentEnd)
      newStart.setDate(newStart.getDate() + 1)
      const newEnd = new Date(newStart)
      newEnd.setDate(newEnd.getDate() + stepDays - 1)
      setCustomStart(localDateKey(newStart))
      setCustomEnd(localDateKey(newEnd))
      setPreset('custom')
    }
  }

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
    downloadCsv(
      `bao-cao-ban-hang-${range.start}-${range.end}.csv`,
      [
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
      ],
      report.sales.map((order) => ({
        ...order,
        channel: order.channel === 'pos' ? 'Bán hàng nhanh' : 'Bán hàng',
        net_total: order.net_total ?? order.total,
      }))
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Phân tích kinh doanh"
        title="Báo cáo"
        description="Theo dõi doanh thu, lợi nhuận, dòng tiền và hàng hóa theo từng giai đoạn."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              className="btn-secondary flex-1 sm:flex-initial"
              type="button"
              onClick={exportReport}
              disabled={loading || !report}
            >
              <Download size={17} />
              <span>Xuất CSV</span>
            </button>
            <button
              className="btn-secondary flex-1 sm:flex-initial"
              type="button"
              onClick={loadReports}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={17} />
              <span>Làm mới</span>
            </button>
          </div>
        }
      />

      {/* Date Range Selector Card */}
      <section className="surface overflow-hidden rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Date Range Display & Duration Badge */}
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500/15 via-sky-500/10 to-cyan-500/20 text-sky-600 ring-1 ring-sky-200/70 shadow-xs">
              <CalendarDays size={22} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Khoảng thời gian</p>
                {spanDays > 0 && (
                  <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-700 ring-1 ring-sky-200/60">
                    {spanDays === 1 ? 'Trong ngày' : `${spanDays} ngày`}
                  </span>
                )}
              </div>
              <p className="tabular-nums mt-0.5 text-base font-black text-slate-900 sm:text-lg flex items-center gap-2 flex-wrap">
                <span>{formatDate(range.start)}</span>
                <span className="text-slate-300 font-normal">→</span>
                <span>{formatDate(range.end)}</span>
              </p>
            </div>
          </div>

          {/* Right: Quick Segmented Pills & Stepper */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Stepper buttons */}
            <div className="flex items-center rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
              <button
                type="button"
                onClick={() => shiftRange('prev')}
                className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-xs"
                title="Lùi về kỳ trước"
                aria-label="Lùi về kỳ trước"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => shiftRange('next')}
                className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-xs"
                title="Tiến tới kỳ kế tiếp"
                aria-label="Tiến tới kỳ kế tiếp"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Segmented Button Group */}
            <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-slate-100/90 p-1.5 ring-1 ring-slate-200/50">
              {PRESET_OPTIONS.map((item) => {
                const isActive = preset === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPreset(item.id)
                      if (item.id === 'custom' && (!customStart || !customEnd)) {
                        setCustomStart(range.start)
                        setCustomEnd(range.end)
                      }
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition duration-150 ${
                      isActive
                        ? 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Expandable Custom Date Bar */}
        {preset === 'custom' && (
          <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-sky-600" />
                  <span>Chọn mốc ngày:</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    className="field text-xs sm:text-sm py-1.5 px-3 max-w-40 font-semibold"
                    type="date"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                  />
                  <span className="text-slate-400 font-bold">→</span>
                  <input
                    className="field text-xs sm:text-sm py-1.5 px-3 max-w-40 font-semibold"
                    type="date"
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                  />
                </div>
              </div>

              {/* Quick shortcut chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400">Chọn nhanh:</span>
                <button
                  type="button"
                  onClick={() => {
                    const today = parseDateKey(localDateKey())
                    const yesterday = new Date(today)
                    yesterday.setDate(yesterday.getDate() - 1)
                    setCustomStart(localDateKey(yesterday))
                    setCustomEnd(localDateKey(yesterday))
                  }}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:border-sky-300 hover:text-sky-600 shadow-2xs transition"
                >
                  Hôm qua
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = parseDateKey(localDateKey())
                    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
                    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
                    setCustomStart(localDateKey(lastMonthStart))
                    setCustomEnd(localDateKey(lastMonthEnd))
                  }}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:border-sky-300 hover:text-sky-600 shadow-2xs transition"
                >
                  Tháng trước
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = parseDateKey(localDateKey())
                    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1)
                    const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31)
                    setCustomStart(localDateKey(lastYearStart))
                    setCustomEnd(localDateKey(lastYearEnd))
                  }}
                  className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200 hover:border-sky-300 hover:text-sky-600 shadow-2xs transition"
                >
                  Năm trước
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {invalidRange ? (
        <section className="surface p-8 text-center">
          <p className="text-sm font-semibold text-rose-700">
            Khoảng thời gian không hợp lệ. Vui lòng chọn ngày kết thúc sau ngày bắt đầu.
          </p>
        </section>
      ) : error ? (
        <section className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <BarChart3 size={27} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Chưa thể tải báo cáo</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{error}</p>
          <button className="btn-primary mt-5" type="button" onClick={loadReports}>
            <RefreshCw size={17} />
            <span>Thử lại</span>
          </button>
        </section>
      ) : loading || !report ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Loading rows={4} />
        </div>
      ) : (
        <ReportContent report={report} />
      )}
    </div>
  )
}

function ReportContent({ report }) {
  const grossProfit = report.revenue - report.cost
  const averageOrder = report.sales.length ? report.revenue / report.sales.length : 0
  const maxTrend = Math.max(1, ...report.trend.map((row) => row.revenue))
  const maxProduct = Math.max(1, ...report.topProducts.map((product) => product.revenue))
  const maxChannel = Math.max(1, ...report.channels.map((channel) => channel.value))

  return (
    <>
      {/* 4 Main KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={CircleDollarSign}
          label="Doanh thu bán hàng"
          value={formatCurrency(report.revenue)}
          caption={`${formatNumber(report.sales.length)} đơn đã xác nhận`}
          tone="emerald"
          size="lg"
        />
        <MetricCard
          icon={TrendingUp}
          label="Lợi nhuận gộp"
          value={formatCurrency(grossProfit)}
          caption="Doanh thu trừ giá vốn dòng hàng"
          tone="sky"
          size="lg"
        />
        <MetricCard
          icon={ReceiptText}
          label="Giá trị đơn trung bình"
          value={formatCurrency(averageOrder)}
          caption="Tính trên đơn không hủy"
          tone="indigo"
          size="lg"
        />
        <MetricCard
          icon={ShoppingBag}
          label="Tổng giá trị nhập"
          value={formatCurrency(report.purchaseTotal)}
          caption={`${formatNumber(report.purchases.length)} phiếu nhập trong kỳ`}
          tone="amber"
          size="lg"
        />
      </section>

      {/* Sales Trend & Sales Channel */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <article className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                Doanh thu theo thời gian
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Thanh cao hơn thể hiện doanh thu lớn hơn trong kỳ.
              </p>
            </div>
            <BarChart3 className="text-sky-500" size={21} />
          </div>
          {report.trend.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Chưa có doanh thu trong kỳ"
              description="Các đơn bán hợp lệ sẽ xuất hiện trên biểu đồ này."
            />
          ) : (
            <div className="p-5 sm:p-6">
              <div className="flex h-56 items-end gap-1.5 sm:gap-2">
                {report.trend.map((row) => (
                  <div
                    className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    key={row.key}
                  >
                    <div className="relative flex h-44 w-full items-end justify-center">
                      <div
                        className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-sky-500 to-emerald-400 transition-all duration-200 group-hover:from-sky-600 group-hover:to-emerald-500 group-hover:shadow-md"
                        style={{ height: `${Math.max(5, (row.revenue / maxTrend) * 100)}%` }}
                        title={`${formatShortDate(row.key)}: ${formatCurrency(row.revenue)}`}
                      />
                    </div>
                    <span className="tabular-nums max-w-full truncate text-[10px] font-semibold text-slate-400">
                      {formatShortDate(row.key)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span className="tabular-nums">
                  {report.trend.length > 1
                    ? `${formatShortDate(report.trend[0].key)} — ${formatShortDate(
                        report.trend[report.trend.length - 1].key
                      )}`
                    : formatShortDate(report.trend[0]?.key)}
                </span>
                <span className="tabular-nums font-bold text-slate-600">
                  {formatNumber(report.sales.length)} đơn
                </span>
              </div>
            </div>
          )}
        </article>

        <article className="surface overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Theo kênh bán</h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Phân bổ doanh thu theo nơi tạo đơn.
            </p>
          </div>
          {report.channels.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Chưa có dữ liệu kênh bán" />
          ) : (
            <div className="space-y-5 p-5 sm:p-6">
              {report.channels.map((channel) => (
                <div key={channel.label}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-slate-700">{channel.label}</span>
                    <span className="tabular-nums font-extrabold text-slate-900">
                      {formatCurrency(channel.value)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                      style={{
                        width: `${Math.max(8, (channel.value / maxChannel) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {/* Top Products & Low Stock Alerts */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <article className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                Sản phẩm đóng góp doanh thu
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Xếp theo giá trị bán trong khoảng thời gian đã chọn.
              </p>
            </div>
            <WalletCards className="text-violet-500" size={21} />
          </div>
          {report.topProducts.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Chưa có sản phẩm bán ra" />
          ) : (
            <div className="divide-y divide-slate-100">
              {report.topProducts.map((product, index) => (
                <div
                  className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:px-6"
                  key={product.id || product.name}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${
                      index < 3
                        ? 'bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-slate-800">{product.name}</p>
                      <p className="tabular-nums shrink-0 text-xs font-bold text-slate-600">
                        {formatNumber(product.quantity)} đơn vị
                      </p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{
                          width: `${Math.max(8, (product.revenue / maxProduct) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="tabular-nums hidden min-w-28 text-right text-sm font-extrabold text-slate-900 sm:block">
                    {formatCurrency(product.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="surface overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Cảnh báo tồn kho</h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Mặt hàng chạm hoặc thấp hơn tồn tối thiểu.
              </p>
            </div>
            <span className="tabular-nums rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              {formatNumber(report.lowStock.length)}
            </span>
          </div>
          {report.lowStock.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Tồn kho đang ổn định"
              description="Chưa có mặt hàng nào cần bổ sung."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {report.lowStock.map((product) => (
                <div
                  className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:px-6"
                  key={product.id}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                    <PackageOpen size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{product.name}</p>
                    <p className="tabular-nums mt-0.5 text-xs text-slate-400">
                      {product.code || 'Chưa có mã'} · Mức tối thiểu {formatNumber(product.min_stock)}
                    </p>
                  </div>
                  <p className="tabular-nums text-right text-sm font-extrabold text-amber-700">
                    {formatNumber(product.stock_on_hand)} {product.unit}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {/* Cash Flow in Period */}
      <section className="surface mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Dòng tiền trong kỳ</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Tổng hợp các giao dịch đã ghi nhận trong sổ quỹ.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5 sm:gap-4">
          <CashMetric
            icon={ArrowDownLeft}
            label="Khoản thu"
            value={report.cashIn}
            tone="emerald"
          />
          <CashMetric
            icon={ArrowUpRight}
            label="Khoản chi"
            value={report.cashOut}
            tone="rose"
          />
          <CashMetric
            icon={WalletCards}
            label="Chênh lệch thu chi"
            value={report.cashIn - report.cashOut}
            tone={report.cashIn - report.cashOut >= 0 ? 'sky' : 'rose'}
          />
        </div>
      </section>
    </>
  )
}

const cashTones = {
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
}

function CashMetric({ icon: Icon, label, value, tone }) {
  const positive = value >= 0
  return (
    <article className="flex items-center gap-3 rounded-2xl bg-slate-50/80 border border-slate-100 p-4 transition hover:bg-slate-50">
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ring-1 ${cashTones[tone]}`}
      >
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p
          className={`tabular-nums mt-0.5 truncate text-lg font-extrabold ${
            label === 'Chênh lệch thu chi' && !positive ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {formatCurrency(value)}
        </p>
      </div>
    </article>
  )
}
