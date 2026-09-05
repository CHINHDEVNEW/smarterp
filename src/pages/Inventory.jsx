/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, ClipboardCheck, ClipboardPenLine, Edit3, Eye, Package, PackageOpen, Plus, RefreshCw, Search, SlidersHorizontal, Warehouse } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { createStockAdjustment, createStocktake, listInventoryData, listStocktakes, subscribeToInventory } from '../services/inventoryService'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import Modal from '../components/common/Modal'
import Loading from '../components/common/Loading'
import EmptyState from '../components/common/EmptyState'
import StocktakeForm from '../components/inventory/StocktakeForm'
import StocktakeDetail from '../components/inventory/StocktakeDetail'
import Pagination from '../components/common/Pagination'
import usePagination from '../hooks/usePagination'

const movementLabels = { sale: 'Xuất bán', purchase: 'Nhập hàng', adjustment: 'Điều chỉnh', return: 'Hàng trả' }

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

  const loadInventory = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [data, stocktakeRows] = await Promise.all([listInventoryData(businessId), listStocktakes(businessId)])
      setProducts(data.products.filter((product) => product.product_type !== 'service'))
      setMovements(data.movements)
      setStocktakes(stocktakeRows)
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được dữ liệu kho. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToInventory(businessId, () => loadInventory({ quiet: true }))
  }, [businessId, loadInventory])

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return products.filter((product) => {
      const low = Number(product.stock_on_hand) <= Number(product.min_stock)
      if (stockFilter === 'low' && !low) return false
      if (stockFilter === 'out' && Number(product.stock_on_hand) > 0) return false
      if (!needle) return true
      return [product.name, product.code, product.sku].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [products, search, stockFilter])

  const filteredMovements = useMemo(() => movements.filter((movement) => {
    if (movementType !== 'all' && movement.movement_type !== movementType) return false
    if (!search.trim()) return true
    const product = productMap.get(movement.product_id)
    const needle = search.trim().toLocaleLowerCase('vi')
    return [product?.name, product?.code, movement.note, movement.reference_type].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
  }), [movements, movementType, productMap, search])

  const stats = useMemo(() => ({
    total: products.length,
    low: products.filter((product) => Number(product.stock_on_hand) <= Number(product.min_stock)).length,
    out: products.filter((product) => Number(product.stock_on_hand) <= 0).length,
    value: products.reduce((sum, product) => sum + (Number(product.stock_on_hand) || 0) * (Number(product.cost_price) || 0), 0),
  }), [products])

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

  return (
    <div>
      <div className="page-heading"><div><p className="page-eyebrow">Tồn kho và biến động</p><h1 className="page-title">Kho hàng</h1><p className="page-description">Theo dõi tồn hiện tại và ghi nhận điều chỉnh qua sổ kho bất biến.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={() => setStocktakeOpen(true)}><ClipboardCheck size={18} /> Kiểm kê kho</button><button className="btn-primary" type="button" onClick={() => setAdjustmentOpen(true)}><Plus size={18} /> Điều chỉnh kho</button></div></div>
      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"><MiniMetric icon={Boxes} label="Mặt hàng theo dõi" value={formatNumber(stats.total)} tone="sky" /><MiniMetric icon={AlertTriangle} label="Tồn kho thấp" value={formatNumber(stats.low)} tone="amber" /><MiniMetric icon={PackageOpen} label="Hết hàng" value={formatNumber(stats.out)} tone="rose" /><MiniMetric icon={Warehouse} label="Giá trị tồn kho" value={formatCurrency(stats.value)} tone="emerald" /></section>

      <section className="surface mb-5 overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, mã SKU..." /></div><div className="flex items-center gap-2"><select className="field min-w-0 flex-1 sm:w-44" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">Tất cả tồn kho</option><option value="low">Tồn kho thấp</option><option value="out">Hết hàng</option></select><button className="btn-icon" type="button" onClick={() => loadInventory()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button></div></div>{error ? <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><Warehouse className="text-rose-500" size={34} /><p className="mt-4 text-sm font-semibold text-slate-700">{error}</p><button className="btn-secondary mt-5" type="button" onClick={() => loadInventory()}><RefreshCw size={17} /> Thử lại</button></div> : loading ? <div className="p-5"><Loading rows={4} /></div> : filteredProducts.length === 0 ? <EmptyState icon={Package} title={products.length ? 'Không tìm thấy mặt hàng' : 'Chưa có hàng hóa'} description={products.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Tạo hàng hóa trong mục Sản phẩm để theo dõi tồn kho.'} /> : <><div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{productPages.pageItems.map((product) => <StockCard key={product.id} product={product} />)}</div><Pagination page={productPages.page} pageCount={productPages.pageCount} pageSize={productPages.pageSize} total={filteredProducts.length} onChange={productPages.setPage} /></>}</section>

      <section className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="section-title">Sổ biến động kho</h2><p className="section-description">Mọi nhập, xuất và điều chỉnh được lưu thành dòng lịch sử riêng.</p></div><div className="flex items-center gap-2"><SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} /><select className="field w-full sm:w-44" value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="all">Tất cả biến động</option><option value="sale">Xuất bán</option><option value="purchase">Nhập hàng</option><option value="adjustment">Điều chỉnh</option><option value="return">Hàng trả</option></select></div></div>{filteredMovements.length === 0 ? <EmptyState icon={ClipboardPenLine} title="Chưa có biến động kho" description="Lịch sử nhập xuất sẽ xuất hiện sau khi có đơn bán hoặc điều chỉnh." /> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[820px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Thời gian</th><th className="px-4 py-3.5">Sản phẩm</th><th className="px-4 py-3.5">Loại</th><th className="px-4 py-3.5 text-right">Số lượng</th><th className="px-4 py-3.5 text-right">Đơn giá vốn</th><th className="px-5 py-3.5">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">{movementPages.pageItems.map((movement) => <MovementRow key={movement.id} movement={movement} product={productMap.get(movement.product_id)} />)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{movementPages.pageItems.map((movement) => <MovementCard key={movement.id} movement={movement} product={productMap.get(movement.product_id)} />)}</div><Pagination page={movementPages.page} pageCount={movementPages.pageCount} pageSize={movementPages.pageSize} total={filteredMovements.length} onChange={movementPages.setPage} /></>}</section>
      <StocktakeHistory stocktakes={stocktakes} onView={setStocktakeViewing} />
      <AdjustmentForm open={adjustmentOpen} products={products} onClose={() => setAdjustmentOpen(false)} onSave={saveAdjustment} />
      <StocktakeForm open={stocktakeOpen} products={products} onClose={() => setStocktakeOpen(false)} onSave={saveStocktake} />
      <StocktakeDetail open={Boolean(stocktakeViewing)} stocktake={stocktakeViewing} businessId={businessId} onClose={() => setStocktakeViewing(null)} />
    </div>
  )
}

const metricTones = { sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600', emerald: 'bg-emerald-50 text-emerald-600' }
function MiniMetric({ icon: Icon, label, value, tone }) { return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">{value}</p></div></article> }
function stockState(product) { const stock = Number(product.stock_on_hand) || 0; const min = Number(product.min_stock) || 0; if (stock <= 0) return { label: 'Hết hàng', className: 'bg-rose-50 text-rose-700' }; if (stock <= min) return { label: 'Sắp hết', className: 'bg-amber-50 text-amber-700' }; return { label: 'Còn hàng', className: 'bg-emerald-50 text-emerald-700' } }
function StockCard({ product }) { const state = stockState(product); return <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-sky-200 hover:shadow-sm"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><Package size={19} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="truncate text-sm font-bold text-slate-900">{product.name}</h2><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${state.className}`}>{state.label}</span></div><p className="mt-1 truncate text-xs text-slate-400">{product.code || product.sku || 'Chưa có mã'} · {product.unit}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[11px] text-slate-400">Tồn hiện tại</p><p className="mt-1 text-base font-extrabold text-slate-900">{formatNumber(product.stock_on_hand)} <span className="text-xs font-semibold text-slate-400">{product.unit}</span></p></div><div className="text-right"><p className="text-[11px] text-slate-400">Tối thiểu</p><p className="mt-1 text-base font-extrabold text-slate-700">{formatNumber(product.min_stock)}</p></div></div><p className="mt-3 text-xs text-slate-400">Giá vốn: <span className="font-bold text-slate-600">{formatCurrency(product.cost_price)}</span></p></article> }
function MovementRow({ movement, product }) { const positive = Number(movement.quantity) >= 0; return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4 text-sm text-slate-600">{formatDateTime(movement.created_at)}</td><td className="px-4 py-4"><p className="max-w-52 truncate text-sm font-bold text-slate-800">{product?.name || 'Sản phẩm đã lưu trữ'}</p><p className="mt-1 text-xs text-slate-400">{product?.code || product?.sku || '—'}</p></td><td className="px-4 py-4 text-sm font-semibold text-slate-600">{movementLabels[movement.movement_type] || movement.movement_type}</td><td className={`px-4 py-4 text-right text-sm font-extrabold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>{positive ? '+' : '−'} {formatNumber(Math.abs(Number(movement.quantity) || 0))} {product?.unit || ''}</td><td className="px-4 py-4 text-right text-sm text-slate-600">{formatCurrency(movement.unit_cost)}</td><td className="max-w-56 truncate px-5 py-4 text-sm text-slate-500">{movement.note || '—'}</td></tr> }
function MovementCard({ movement, product }) { const positive = Number(movement.quantity) >= 0; return <article className="flex items-start gap-3 p-4"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{positive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="truncate text-sm font-bold text-slate-800">{product?.name || 'Sản phẩm đã lưu trữ'}</p><p className="mt-1 text-xs text-slate-400">{movementLabels[movement.movement_type] || movement.movement_type} · {formatDateTime(movement.created_at)}</p></div><p className={`shrink-0 text-sm font-extrabold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>{positive ? '+' : '−'} {formatNumber(Math.abs(Number(movement.quantity) || 0))}</p></div>{movement.note && <p className="mt-2 truncate text-xs text-slate-400">{movement.note}</p>}</div></article> }

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

function stocktakeStatus(value) {
  const normalized = String(value || 'completed').toLowerCase()
  if (['cancelled', 'canceled'].includes(normalized)) return { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700' }
  if (['draft', 'pending'].includes(normalized)) return { label: 'Nháp', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Đã hoàn tất', className: 'bg-emerald-50 text-emerald-700' }
}

function StocktakeHistory({ stocktakes, onView }) {
  return <section className="surface mt-5 overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="section-title">Lịch sử kiểm kê</h2><p className="section-description">Mỗi phiếu lưu lại tồn hệ thống, tồn thực tế và phần chênh lệch.</p></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{formatNumber(stocktakes.length)} phiếu</span></div>{stocktakes.length === 0 ? <EmptyState icon={ClipboardCheck} title="Chưa có phiếu kiểm kê" description="Tạo phiếu kiểm kê để đối chiếu tồn thực tế và cập nhật sổ kho." /> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Phiếu</th><th className="px-4 py-3.5">Ngày</th><th className="px-4 py-3.5 text-right">Mặt hàng</th><th className="px-4 py-3.5 text-right">Chênh lệch SL</th><th className="px-4 py-3.5 text-right">Giá trị lệch</th><th className="px-5 py-3.5 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{stocktakes.map((stocktake) => <StocktakeRow key={stocktake.id} stocktake={stocktake} onView={onView} />)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{stocktakes.map((stocktake) => <StocktakeCard key={stocktake.id} stocktake={stocktake} onView={onView} />)}</div></>}</section>
}

function StocktakeRow({ stocktake, onView }) {
  const status = stocktakeStatus(stocktake.status || stocktake.stocktake_status)
  const difference = Number(stocktakeValue(stocktake, ['total_difference_quantity', 'difference_quantity', 'total_difference'], 0)) || 0
  const differenceValue = Number(stocktakeValue(stocktake, ['total_difference_value', 'difference_value', 'total_adjustment_value'], 0)) || 0
  return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-sm font-bold text-slate-800">{stocktakeValue(stocktake, ['code', 'stocktake_code', 'stocktake_number'], 'Phiếu kiểm kê')}</p><span className={'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ' + status.className}>{status.label}</span></td><td className="px-4 py-4 text-sm text-slate-600">{formatStocktakeDate(stocktakeValue(stocktake, ['stocktake_date', 'date', 'document_date', 'created_at']))}</td><td className="px-4 py-4 text-right text-sm font-semibold text-slate-700">{formatNumber(stocktakeValue(stocktake, ['total_items', 'item_count', 'total_products'], 0))}</td><td className={(difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-emerald-600' : 'text-slate-500') + ' px-4 py-4 text-right text-sm font-extrabold'}>{difference > 0 ? '+' : difference < 0 ? '−' : ''} {formatNumber(Math.abs(difference))}</td><td className={(differenceValue < 0 ? 'text-rose-600' : differenceValue > 0 ? 'text-emerald-600' : 'text-slate-500') + ' px-4 py-4 text-right text-sm font-extrabold'}>{differenceValue > 0 ? '+' : differenceValue < 0 ? '−' : ''} {formatCurrency(Math.abs(differenceValue))}</td><td className="px-5 py-4 text-right"><button className="btn-ghost" type="button" onClick={() => onView(stocktake)}><Eye size={16} /> Xem</button></td></tr>
}

function StocktakeCard({ stocktake, onView }) {
  const status = stocktakeStatus(stocktake.status || stocktake.stocktake_status)
  const difference = Number(stocktakeValue(stocktake, ['total_difference_quantity', 'difference_quantity', 'total_difference'], 0)) || 0
  const differenceValue = Number(stocktakeValue(stocktake, ['total_difference_value', 'difference_value', 'total_adjustment_value'], 0)) || 0
  return <article className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{stocktakeValue(stocktake, ['code', 'stocktake_code', 'stocktake_number'], 'Phiếu kiểm kê')}</p><p className="mt-1 text-xs text-slate-400">{formatStocktakeDate(stocktakeValue(stocktake, ['stocktake_date', 'date', 'document_date', 'created_at']))} · {formatNumber(stocktakeValue(stocktake, ['total_items', 'item_count', 'total_products'], 0))} mặt hàng</p></div><span className={'rounded-full px-2 py-1 text-[10px] font-bold ' + status.className}>{status.label}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-400">Chênh lệch SL</p><p className={(difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-emerald-600' : 'text-slate-600') + ' mt-1 text-sm font-extrabold'}>{difference > 0 ? '+' : difference < 0 ? '−' : ''} {formatNumber(Math.abs(difference))}</p></div><div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[11px] text-slate-400">Giá trị lệch</p><p className={(differenceValue < 0 ? 'text-rose-600' : differenceValue > 0 ? 'text-emerald-600' : 'text-slate-600') + ' mt-1 text-sm font-extrabold'}>{differenceValue > 0 ? '+' : differenceValue < 0 ? '−' : ''} {formatCurrency(Math.abs(differenceValue))}</p></div></div><button className="btn-ghost mt-3 w-full justify-center" type="button" onClick={() => onView(stocktake)}><Eye size={16} /> Xem chi tiết</button></article>
}

function AdjustmentForm({ open, products, onClose, onSave }) {
  const [values, setValues] = useState({ product_id: '', quantity: '', unit_cost: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setValues({ product_id: products[0]?.id || '', quantity: '', unit_cost: products[0]?.cost_price ?? '', note: '' }); setError('') } }, [open, products])
  function update(field, value) { setValues((current) => ({ ...current, [field]: value })) }
  function productChanged(value) { const product = products.find((row) => row.id === value); setValues((current) => ({ ...current, product_id: value, unit_cost: product?.cost_price ?? '' })) }
  async function submit(event) { event.preventDefault(); const quantity = Number(values.quantity) || 0; const unitCost = Number(values.unit_cost) || 0; if (!values.product_id) return setError('Vui lòng chọn sản phẩm.'); if (quantity === 0) return setError('Số lượng điều chỉnh phải khác 0.'); if (unitCost < 0) return setError('Giá vốn không được là số âm.'); if (!values.note.trim()) return setError('Vui lòng ghi rõ lý do điều chỉnh.'); setSaving(true); setError(''); try { await onSave({ product_id: values.product_id, quantity, unit_cost: unitCost, reference_type: 'manual', note: values.note.trim() }) } catch (saveError) { setError(saveError.message || 'Không thể ghi nhận điều chỉnh.') } finally { setSaving(false) } }
  return <Modal open={open} onClose={saving ? () => {} : onClose} title="Điều chỉnh tồn kho" description="Tăng dùng số dương, giảm dùng số âm. Không sửa trực tiếp tồn hiện tại." footer={<><button className="btn-secondary" type="button" onClick={onClose} disabled={saving}>Hủy</button><button className="btn-primary" type="submit" form="adjustment-form" disabled={saving || !products.length}><Edit3 size={17} /> {saving ? 'Đang lưu...' : 'Ghi nhận điều chỉnh'}</button></>}><form id="adjustment-form" className="space-y-5" onSubmit={submit}><Field label="Sản phẩm"><select className="field" value={values.product_id} onChange={(event) => productChanged(event.target.value)} required><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · Tồn {formatNumber(product.stock_on_hand)} {product.unit}</option>)}</select></Field><div className="form-grid"><Field label="Số lượng điều chỉnh"><input className="field text-right text-lg font-bold" type="number" step="0.001" value={values.quantity} onChange={(event) => update('quantity', event.target.value)} placeholder="+10 hoặc -2" required /></Field><Field label="Giá vốn tham chiếu"><input className="field text-right" type="number" min="0" step="1" value={values.unit_cost} onChange={(event) => update('unit_cost', event.target.value)} /></Field></div><Field label="Lý do điều chỉnh"><textarea className="field min-h-24 resize-y" value={values.note} onChange={(event) => update('note', event.target.value)} placeholder="Ví dụ: Kiểm kê thực tế ngày 05/09" required /></Field><div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-5 text-sky-800">Mỗi lần điều chỉnh sẽ tạo một dòng mới trong sổ kho để có thể kiểm tra lại lịch sử.</div>{error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}</form></Modal>
}

function Field({ label, className = '', children }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}
