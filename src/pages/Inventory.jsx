/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  ClipboardPenLine,
  Edit3,
  Eye,
  Package,
  PackageOpen,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import {
  createStockAdjustment,
  createStocktake,
  cancelStocktake,
  listInventoryData,
  listStocktakes,
  subscribeToInventory,
} from '../services/inventoryService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
import Modal from '../components/common/Modal'
import Loading from '../components/common/Loading'
import EmptyState from '../components/common/EmptyState'
import StocktakeForm from '../components/inventory/StocktakeForm'
import StocktakeDetail from '../components/inventory/StocktakeDetail'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const movementLabels = {
  sale: 'Xuất bán',
  purchase: 'Nhập hàng',
  adjustment: 'Điều chỉnh',
  return: 'Hàng trả',
}

const referenceMovementLabels = {
  sales_return: 'Hàng khách trả',
  purchase_return: 'Trả nhà cung cấp',
  sales_return_cancel: 'Hủy hàng khách trả',
  purchase_return_cancel: 'Hủy trả nhà cung cấp',
  production_issue: 'Xuất sản xuất',
  production_return: 'Trả nguyên liệu sản xuất',
  production_receipt: 'Nhập thành phẩm',
}

function movementLabel(movement) {
  return (
    referenceMovementLabels[movement.reference_type] ||
    movementLabels[movement.movement_type] ||
    movement.movement_type
  )
}

export default function Inventory() {
  const { businessId } = useBusiness()
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [stocktakes, setStocktakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [movementType, setMovementType] = useState('all')
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [stocktakeOpen, setStocktakeOpen] = useState(false)
  const [stocktakeViewing, setStocktakeViewing] = useState(null)

  const loadInventory = useCallback(
    async ({ quiet = false } = {}) => {
      if (!businessId) return
      if (!quiet) setLoading(true)
      setError('')
      try {
        const [data, stocktakeRows] = await Promise.all([
          listInventoryData(businessId),
          listStocktakes(businessId),
        ])
        setProducts(data.products.filter((product) => product.product_type !== 'service'))
        setMovements(data.movements)
        setStocktakes(stocktakeRows)
      } catch (loadError) {
        console.error(loadError)
        setError('Không tải được dữ liệu kho. Vui lòng thử lại.')
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [businessId]
  )

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToInventory(businessId, () => loadInventory({ quiet: true }))
  }, [businessId, loadInventory])

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  )

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return products.filter((product) => {
      const low = Number(product.stock_on_hand) <= Number(product.min_stock)
      if (stockFilter === 'low' && !low) return false
      if (stockFilter === 'out' && Number(product.stock_on_hand) > 0) return false
      if (!needle) return true
      return [product.name, product.code, product.sku].some((value) =>
        String(value ?? '')
          .toLocaleLowerCase('vi')
          .includes(needle)
      )
    })
  }, [products, search, stockFilter])

  const filteredMovements = useMemo(
    () =>
      movements.filter((movement) => {
        if (movementType !== 'all' && movement.movement_type !== movementType) return false
        if (!search.trim()) return true
        const product = productMap.get(movement.product_id)
        const needle = search.trim().toLocaleLowerCase('vi')
        return [product?.name, product?.code, movement.note, movement.reference_type].some(
          (value) =>
            String(value ?? '')
              .toLocaleLowerCase('vi')
              .includes(needle)
        )
      }),
    [movements, movementType, productMap, search]
  )

  const stats = useMemo(
    () => ({
      total: products.length,
      low: products.filter(
        (product) => Number(product.stock_on_hand) <= Number(product.min_stock)
      ).length,
      out: products.filter((product) => Number(product.stock_on_hand) <= 0).length,
      value: products.reduce(
        (sum, product) =>
          sum + (Number(product.stock_on_hand) || 0) * (Number(product.cost_price) || 0),
        0
      ),
    }),
    [products]
  )

  const productPages = usePagination(filteredProducts, `${search}\u0000${stockFilter}`, 12)
  const movementPages = usePagination(filteredMovements, `${search}\u0000${movementType}`)

  async function saveAdjustment(values) {
    await createStockAdjustment(businessId, values)
    showToast('Đã ghi nhận điều chỉnh kho.')
    setAdjustmentOpen(false)
    await loadInventory({ quiet: true })
  }

  async function saveStocktake(values) {
    const created = await createStocktake(businessId, values)
    showToast('Đã hoàn tất ' + (created?.code || 'phiếu kiểm kê') + '.')
    setStocktakeOpen(false)
    await loadInventory({ quiet: true })
  }

  async function cancelSelectedStocktake(reason) {
    if (!stocktakeViewing) return
    await cancelStocktake(businessId, stocktakeViewing.id, reason)
    setStocktakeViewing(null)
    showToast('Đã hủy phiếu kiểm kê và đảo chênh lệch tồn kho.')
    await loadInventory({ quiet: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tồn kho và biến động"
        title="Kho hàng"
        description="Theo dõi tồn hiện tại và ghi nhận điều chỉnh qua sổ kho bất biến."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              className="btn-secondary flex-1 sm:flex-initial"
              type="button"
              onClick={() => setStocktakeOpen(true)}
            >
              <ClipboardCheck size={18} />
              <span>Kiểm kê kho</span>
            </button>
            <button
              className="btn-primary flex-1 sm:flex-initial"
              type="button"
              onClick={() => setAdjustmentOpen(true)}
            >
              <Plus size={18} />
              <span>Điều chỉnh kho</span>
            </button>
          </div>
        }
      />

      {/* Metrics */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={Boxes}
          label="Mặt hàng theo dõi"
          value={formatNumber(stats.total)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Tồn kho thấp"
          value={formatNumber(stats.low)}
          tone="amber"
          size="sm"
        />
        <MetricCard
          icon={PackageOpen}
          label="Hết hàng"
          value={formatNumber(stats.out)}
          tone="rose"
          size="sm"
        />
        <MetricCard
          icon={Warehouse}
          label="Giá trị tồn kho"
          value={formatCurrency(stats.value)}
          tone="emerald"
          size="sm"
        />
      </section>

      {/* Stock List */}
      <section className="surface overflow-hidden">
        <FilterBar
          searchPlaceholder="Tìm sản phẩm, mã SKU..."
          searchValue={search}
          onSearchChange={setSearch}
          onRefresh={() => loadInventory()}
          refreshing={loading}
        >
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            <button
              type="button"
              onClick={() => setStockFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                stockFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('low')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                stockFilter === 'low'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tồn thấp</span>
              {stats.low > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${stockFilter === 'low' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {stats.low}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('out')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                stockFilter === 'out'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Hết hàng</span>
              {stats.out > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${stockFilter === 'out' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'}`}>
                  {stats.out}
                </span>
              )}
            </button>
          </div>
        </FilterBar>

        {error ? (
          <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
            <Warehouse className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button
              className="btn-secondary mt-5"
              type="button"
              onClick={() => loadInventory()}
            >
              <RefreshCw size={17} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : loading ? (
          <div className="p-5">
            <Loading rows={4} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length ? 'Không tìm thấy mặt hàng' : 'Chưa có hàng hóa'}
            description={
              products.length
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : 'Tạo hàng hóa trong mục Sản phẩm để theo dõi tồn kho.'
            }
          />
        ) : (
          <>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
              {productPages.pageItems.map((product) => (
                <StockCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={productPages.page}
              pageCount={productPages.pageCount}
              pageSize={productPages.pageSize}
              total={filteredProducts.length}
              onChange={productPages.setPage}
            />
          </>
        )}
      </section>

      {/* Stock Movements Ledger */}
      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Sổ biến động kho</h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Mọi nhập, xuất và điều chỉnh được lưu thành dòng lịch sử riêng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'sale', label: 'Xuất bán' },
              { id: 'purchase', label: 'Nhập hàng' },
              { id: 'adjustment', label: 'Điều chỉnh' },
              { id: 'return', label: 'Hàng trả' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMovementType(item.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  movementType === item.id
                    ? 'bg-white text-sky-700 shadow-xs ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <EmptyState
            icon={ClipboardPenLine}
            title="Chưa có biến động kho"
            description="Lịch sử nhập xuất sẽ xuất hiện sau khi có đơn bán hoặc điều chỉnh."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Thời gian</th>
                    <th className="px-4 py-3.5">Sản phẩm</th>
                    <th className="px-4 py-3.5">Loại</th>
                    <th className="px-4 py-3.5 text-right">Số lượng</th>
                    <th className="px-4 py-3.5 text-right">Đơn giá vốn</th>
                    <th className="px-5 py-3.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movementPages.pageItems.map((movement) => (
                    <MovementRow
                      key={movement.id}
                      movement={movement}
                      product={productMap.get(movement.product_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {movementPages.pageItems.map((movement) => (
                <MovementCard
                  key={movement.id}
                  movement={movement}
                  product={productMap.get(movement.product_id)}
                />
              ))}
            </div>
            <Pagination
              page={movementPages.page}
              pageCount={movementPages.pageCount}
              pageSize={movementPages.pageSize}
              total={filteredMovements.length}
              onChange={movementPages.setPage}
            />
          </>
        )}
      </section>

      {/* Stocktake History */}
      <StocktakeHistory stocktakes={stocktakes} onView={setStocktakeViewing} />

      {/* Modals */}
      <AdjustmentForm
        open={adjustmentOpen}
        products={products}
        onClose={() => setAdjustmentOpen(false)}
        onSave={saveAdjustment}
      />
      <StocktakeForm
        open={stocktakeOpen}
        products={products}
        onClose={() => setStocktakeOpen(false)}
        onSave={saveStocktake}
      />
      <StocktakeDetail
        open={Boolean(stocktakeViewing)}
        stocktake={stocktakeViewing}
        businessId={businessId}
        onClose={() => setStocktakeViewing(null)}
        onCancel={cancelSelectedStocktake}
      />
    </div>
  )
}

function StockCard({ product }) {
  const stock = Number(product.stock_on_hand) || 0
  const min = Number(product.min_stock) || 0
  const statusKey = stock <= 0 ? 'out_of_stock' : stock <= min ? 'low_stock' : 'in_stock'

  return (
    <article className="surface rounded-2xl border border-slate-200/80 p-4 transition duration-200 hover:border-sky-300 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <Package size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-bold text-slate-900">{product.name}</h3>
            <StatusBadge status={statusKey} size="sm" dot />
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">
            {product.code || product.sku || 'Chưa có mã'} · {product.unit}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50/80 p-3 border border-slate-100">
        <div>
          <p className="text-[11px] font-medium text-slate-400">Tồn hiện tại</p>
          <p className="mt-1 tabular-nums text-base font-extrabold text-slate-900">
            {formatNumber(product.stock_on_hand)}{' '}
            <span className="text-xs font-semibold text-slate-400">{product.unit}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-slate-400">Tối thiểu</p>
          <p className="mt-1 tabular-nums text-base font-extrabold text-slate-600">
            {formatNumber(product.min_stock)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Giá vốn:</span>
        <span className="tabular-nums font-bold text-slate-700">
          {formatCurrency(product.cost_price)}
        </span>
      </div>
    </article>
  )
}

function MovementRow({ movement, product }) {
  const positive = Number(movement.quantity) >= 0
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="tabular-nums px-5 py-4 text-sm text-slate-600">
        {formatDateTime(movement.created_at)}
      </td>
      <td className="px-4 py-4">
        <p className="max-w-52 truncate text-sm font-bold text-slate-800">
          {product?.name || 'Sản phẩm đã lưu trữ'}
        </p>
        <p className="mt-1 text-xs text-slate-400">{product?.code || product?.sku || '—'}</p>
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-slate-600">
        {movementLabel(movement)}
      </td>
      <td
        className={`tabular-nums px-4 py-4 text-right text-sm font-extrabold ${
          positive ? 'text-emerald-600' : 'text-rose-600'
        }`}
      >
        {positive ? '+' : '−'} {formatNumber(Math.abs(Number(movement.quantity) || 0))}{' '}
        <span className="text-xs font-medium text-slate-400">{product?.unit || ''}</span>
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm text-slate-600">
        {formatCurrency(movement.unit_cost)}
      </td>
      <td className="max-w-56 truncate px-5 py-4 text-sm text-slate-500">
        {movement.note || '—'}
      </td>
    </tr>
  )
}

function MovementCard({ movement, product }) {
  const positive = Number(movement.quantity) >= 0
  return (
    <article className="flex items-start gap-3 p-4">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          positive ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
        }`}
      >
        {positive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="truncate text-sm font-bold text-slate-800">
              {product?.name || 'Sản phẩm đã lưu trữ'}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {movementLabel(movement)} ·{' '}
              <span className="tabular-nums">{formatDateTime(movement.created_at)}</span>
            </p>
          </div>
          <p
            className={`tabular-nums shrink-0 text-sm font-extrabold ${
              positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {positive ? '+' : '−'} {formatNumber(Math.abs(Number(movement.quantity) || 0))}
          </p>
        </div>
        {movement.note && <p className="mt-2 truncate text-xs text-slate-400">{movement.note}</p>}
      </div>
    </article>
  )
}

function stocktakeValue(row, names, fallback = null) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') return row[name]
  }
  return fallback
}

function formatStocktakeDate(value) {
  if (!value) return '—'
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parts = text.split('-')
    return parts[2] + '/' + parts[1] + '/' + parts[0]
  }
  return formatDateTime(value)
}

function StocktakeHistory({ stocktakes, onView }) {
  return (
    <section className="surface mt-6 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Lịch sử kiểm kê</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Mỗi phiếu lưu lại tồn hệ thống, tồn thực tế và phần chênh lệch.
          </p>
        </div>
        <span className="tabular-nums w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
          {formatNumber(stocktakes.length)} phiếu
        </span>
      </div>
      {stocktakes.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Chưa có phiếu kiểm kê"
          description="Tạo phiếu kiểm kê để đối chiếu tồn thực tế và cập nhật sổ kho."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Phiếu</th>
                  <th className="px-4 py-3.5">Ngày</th>
                  <th className="px-4 py-3.5 text-right">Mặt hàng</th>
                  <th className="px-4 py-3.5 text-right">Chênh lệch SL</th>
                  <th className="px-4 py-3.5 text-right">Giá trị lệch</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stocktakes.map((stocktake) => (
                  <StocktakeRow key={stocktake.id} stocktake={stocktake} onView={onView} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 lg:hidden">
            {stocktakes.map((stocktake) => (
              <StocktakeCard key={stocktake.id} stocktake={stocktake} onView={onView} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function StocktakeRow({ stocktake, onView }) {
  const rawStatus = stocktake.cancelled_at ? 'cancelled' : stocktake.status || stocktake.stocktake_status || 'completed'
  const difference =
    Number(
      stocktakeValue(
        stocktake,
        ['total_difference_quantity', 'difference_quantity', 'total_difference'],
        0
      )
    ) || 0
  const differenceValue =
    Number(
      stocktakeValue(
        stocktake,
        ['total_difference_value', 'difference_value', 'total_adjustment_value'],
        0
      )
    ) || 0

  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <p className="text-sm font-bold text-slate-800">
          {stocktakeValue(stocktake, ['code', 'stocktake_code', 'stocktake_number'], 'Phiếu kiểm kê')}
        </p>
        <div className="mt-1">
          <StatusBadge status={rawStatus} size="sm" />
        </div>
      </td>
      <td className="tabular-nums px-4 py-4 text-sm text-slate-600">
        {formatStocktakeDate(
          stocktakeValue(stocktake, ['stocktake_date', 'date', 'document_date', 'created_at'])
        )}
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-semibold text-slate-700">
        {formatNumber(stocktakeValue(stocktake, ['total_items', 'item_count', 'total_products'], 0))}
      </td>
      <td
        className={`tabular-nums px-4 py-4 text-right text-sm font-extrabold ${
          difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-emerald-600' : 'text-slate-500'
        }`}
      >
        {difference > 0 ? '+' : difference < 0 ? '−' : ''} {formatNumber(Math.abs(difference))}
      </td>
      <td
        className={`tabular-nums px-4 py-4 text-right text-sm font-extrabold ${
          differenceValue < 0
            ? 'text-rose-600'
            : differenceValue > 0
            ? 'text-emerald-600'
            : 'text-slate-500'
        }`}
      >
        {differenceValue > 0 ? '+' : differenceValue < 0 ? '−' : ''}{' '}
        {formatCurrency(Math.abs(differenceValue))}
      </td>
      <td className="px-5 py-4 text-right">
        <button className="btn-ghost" type="button" onClick={() => onView(stocktake)}>
          <Eye size={16} />
          <span>Xem</span>
        </button>
      </td>
    </tr>
  )
}

function StocktakeCard({ stocktake, onView }) {
  const rawStatus = stocktake.cancelled_at ? 'cancelled' : stocktake.status || stocktake.stocktake_status || 'completed'
  const difference =
    Number(
      stocktakeValue(
        stocktake,
        ['total_difference_quantity', 'difference_quantity', 'total_difference'],
        0
      )
    ) || 0
  const differenceValue =
    Number(
      stocktakeValue(
        stocktake,
        ['total_difference_value', 'difference_value', 'total_adjustment_value'],
        0
      )
    ) || 0

  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-800">
            {stocktakeValue(stocktake, ['code', 'stocktake_code', 'stocktake_number'], 'Phiếu kiểm kê')}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            <span className="tabular-nums">
              {formatStocktakeDate(
                stocktakeValue(stocktake, ['stocktake_date', 'date', 'document_date', 'created_at'])
              )}
            </span>{' '}
            ·{' '}
            <span className="tabular-nums">
              {formatNumber(
                stocktakeValue(stocktake, ['total_items', 'item_count', 'total_products'], 0)
              )}
            </span>{' '}
            mặt hàng
          </p>
        </div>
        <StatusBadge status={rawStatus} size="sm" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
          <p className="text-[11px] font-medium text-slate-400">Chênh lệch SL</p>
          <p
            className={`tabular-nums mt-1 text-sm font-extrabold ${
              difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-emerald-600' : 'text-slate-600'
            }`}
          >
            {difference > 0 ? '+' : difference < 0 ? '−' : ''} {formatNumber(Math.abs(difference))}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 border border-slate-100">
          <p className="text-[11px] font-medium text-slate-400">Giá trị lệch</p>
          <p
            className={`tabular-nums mt-1 text-sm font-extrabold ${
              differenceValue < 0
                ? 'text-rose-600'
                : differenceValue > 0
                ? 'text-emerald-600'
                : 'text-slate-600'
            }`}
          >
            {differenceValue > 0 ? '+' : differenceValue < 0 ? '−' : ''}{' '}
            {formatCurrency(Math.abs(differenceValue))}
          </p>
        </div>
      </div>
      <button
        className="btn-ghost mt-3 w-full justify-center"
        type="button"
        onClick={() => onView(stocktake)}
      >
        <Eye size={16} />
        <span>Xem chi tiết</span>
      </button>
    </article>
  )
}

function AdjustmentForm({ open, products, onClose, onSave }) {
  const [values, setValues] = useState({ product_id: '', quantity: '', unit_cost: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setValues({
        product_id: products[0]?.id || '',
        quantity: '',
        unit_cost: products[0]?.cost_price ?? '',
        note: '',
      })
      setError('')
    }
  }, [open, products])

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function productChanged(value) {
    const product = products.find((row) => row.id === value)
    setValues((current) => ({
      ...current,
      product_id: value,
      unit_cost: product?.cost_price ?? '',
    }))
  }

  async function submit(event) {
    event.preventDefault()
    const quantity = Number(values.quantity) || 0
    const unitCost = Number(values.unit_cost) || 0
    if (!values.product_id) return setError('Vui lòng chọn sản phẩm.')
    if (quantity === 0) return setError('Số lượng điều chỉnh phải khác 0.')
    if (unitCost < 0) return setError('Giá vốn không được là số âm.')
    if (!values.note.trim()) return setError('Vui lòng ghi rõ lý do điều chỉnh.')

    setSaving(true)
    setError('')
    try {
      await onSave({
        product_id: values.product_id,
        quantity,
        unit_cost: unitCost,
        reference_type: 'manual',
        note: values.note.trim(),
      })
    } catch (saveError) {
      setError(saveError.message || 'Không thể ghi nhận điều chỉnh.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Điều chỉnh tồn kho"
      description="Tăng dùng số dương (+), giảm dùng số âm (−). Không sửa trực tiếp tồn hiện tại."
      icon={SlidersHorizontal}
      tone="sky"
      badge="Điều chỉnh kho"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button
            className="btn-primary w-full sm:w-auto"
            type="submit"
            form="adjustment-form"
            disabled={saving || !products.length}
          >
            <Edit3 size={17} />
            <span>{saving ? 'Đang lưu...' : 'Ghi nhận điều chỉnh'}</span>
          </button>
        </div>
      }
    >
      <form id="adjustment-form" className="space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Sản phẩm <span className="text-rose-500">*</span>
          </span>
          <select
            className="field"
            value={values.product_id}
            onChange={(event) => productChanged(event.target.value)}
            required
          >
            <option value="">Chọn sản phẩm</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · Tồn {formatNumber(product.stock_on_hand)} {product.unit}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Số lượng điều chỉnh <span className="text-rose-500">*</span>
            </span>
            <input
              className="field tabular-nums text-right font-bold text-lg"
              type="number"
              step="0.001"
              value={values.quantity}
              onChange={(event) => update('quantity', event.target.value)}
              placeholder="+10 hoặc -2"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Giá vốn tham chiếu
            </span>
            <input
              className="field tabular-nums text-right"
              type="number"
              min="0"
              step="1"
              value={values.unit_cost}
              onChange={(event) => update('unit_cost', event.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Lý do điều chỉnh <span className="text-rose-500">*</span>
          </span>
          <textarea
            className="field min-h-24 resize-y"
            value={values.note}
            onChange={(event) => update('note', event.target.value)}
            placeholder="Ví dụ: Kiểm kê thực tế ngày 05/09"
            required
          />
        </label>

        <div className="rounded-xl border border-sky-200/80 bg-sky-50/70 px-4 py-3 text-xs leading-relaxed text-sky-800">
          Mỗi lần điều chỉnh sẽ tạo một dòng mới trong sổ kho để bảo đảm tính minh bạch và lịch sử bất biến.
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  )
}
