/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, BarChart3, Check, CircleDollarSign, ClipboardList, Factory, Hammer, PackageCheck, Plus, RefreshCw, Search, SlidersHorizontal, Target, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { canAccess } from '../lib/permissions'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import usePagination from '../hooks/usePagination'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import BomForm from '../components/production/BomForm'
import ProductionOrderForm from '../components/production/ProductionOrderForm'
import ProductionOrderDetail from '../components/production/ProductionOrderDetail'
import {
  addProductionCost,
  createProductionOrder,
  getProductionBomItems,
  getProductionOrderDetails,
  issueProductionMaterials,
  listProductionData,
  receiveProductionOutput,
  recordProductionWaste,
  returnProductionMaterials,
  saveProductionBom,
  setProductionBomStatus,
  subscribeToProduction,
  updateProductionOrderStatus,
} from '../services/productionService'

const orderStatusLabels = {
  planned: { label: 'Đang chờ', className: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'Đang sản xuất', className: 'bg-sky-50 text-sky-700' },
  completed: { label: 'Đã hoàn tất', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700' },
}
const bomStatusLabels = {
  draft: { label: 'Bản nháp', className: 'bg-amber-50 text-amber-700' },
  active: { label: 'Đang dùng', className: 'bg-emerald-50 text-emerald-700' },
  archived: { label: 'Lưu trữ', className: 'bg-slate-100 text-slate-600' },
}

function statusLabel(map, value) {
  return map[value] ?? { label: value || 'Không rõ', className: 'bg-slate-100 text-slate-600' }
}

function dateOnly(value) {
  if (!value) return '—'
  const text = String(value).slice(0, 10)
  const parts = text.split('-')
  return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : formatDateTime(value)
}

export default function Production() {
  const { businessId, business } = useBusiness()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') === 'boms' ? 'boms' : searchParams.get('tab') === 'report' ? 'report' : 'orders')
  const [products, setProducts] = useState([])
  const [boms, setBoms] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [bomStatusFilter, setBomStatusFilter] = useState('all')
  const [bomFormOpen, setBomFormOpen] = useState(false)
  const [editingBom, setEditingBom] = useState(null)
  const [editingBomItems, setEditingBomItems] = useState([])
  const [orderFormOpen, setOrderFormOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderDetails, setOrderDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  const canManage = canAccess(business?.role, 'production_manage')
  const canManageCosts = canAccess(business?.role, 'production_cost')

  const loadProduction = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      const data = await listProductionData(businessId)
      setProducts(data.products)
      setBoms(data.boms)
      setOrders(data.orders)
      setSelectedOrder((current) => current ? data.orders.find((row) => row.id === current.id) ?? current : null)
    } catch (loadError) {
      console.error(loadError)
      setError(loadError.message || 'Không tải được dữ liệu sản xuất. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadProduction()
  }, [loadProduction])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToProduction(businessId, () => loadProduction({ quiet: true }))
  }, [businessId, loadProduction])

  useEffect(() => {
    const nextTab = searchParams.get('tab')
    if (nextTab === 'orders' || nextTab === 'boms' || nextTab === 'report') setTab(nextTab)
    if (searchParams.get('new') === '1') {
      setOrderFormOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (!needle) return true
      return [order.code, order.output_product_name, order.output_product_code, order.bom_code, order.bom_name]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [orders, search, statusFilter])
  const filteredBoms = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return boms.filter((bom) => {
      if (bomStatusFilter !== 'all' && bom.status !== bomStatusFilter) return false
      if (!needle) return true
      return [bom.code, bom.name, bom.output_product_name, bom.output_product_code]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [boms, bomStatusFilter, search])
  const orderPages = usePagination(filteredOrders, search + '\u0000' + statusFilter, 10)
  const bomPages = usePagination(filteredBoms, search + '\u0000' + bomStatusFilter, 10)

  const stats = useMemo(() => ({
    activeBoms: boms.filter((bom) => bom.status === 'active').length,
    openOrders: orders.filter((order) => ['planned', 'in_progress'].includes(order.status)).length,
    completedOrders: orders.filter((order) => order.status === 'completed').length,
    actualCost: orders.reduce((sum, order) => sum + (Number(order.actual_total_cost) || 0), 0),
    produced: orders.reduce((sum, order) => sum + (Number(order.actual_quantity) || 0), 0),
    scrapped: orders.reduce((sum, order) => sum + (Number(order.scrapped_quantity) || 0), 0),
  }), [boms, orders])

  function changeTab(nextTab) {
    setTab(nextTab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  async function refreshQuiet() {
    await loadProduction({ quiet: true })
  }

  async function openBomForm(bom = null) {
    setEditingBom(bom)
    setEditingBomItems([])
    setBomFormOpen(true)
    if (bom) {
      try {
        setEditingBomItems(await getProductionBomItems(businessId, bom.id))
      } catch (loadError) {
        setBomFormOpen(false)
        showToast(loadError.message || 'Không tải được chi tiết định mức.', 'error')
      }
    }
  }

  async function saveBom(values, items) {
    await saveProductionBom(businessId, values, items)
    showToast(values.id ? 'Đã cập nhật định mức.' : 'Đã tạo định mức mới.')
    setBomFormOpen(false)
    setEditingBom(null)
    await refreshQuiet()
  }

  async function changeBomStatus(bom) {
    const nextStatus = bom.status === 'active' ? 'archived' : 'active'
    try {
      await setProductionBomStatus(businessId, bom.id, nextStatus)
      showToast(nextStatus === 'active' ? 'Đã kích hoạt định mức.' : 'Đã lưu trữ định mức.')
      await refreshQuiet()
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật định mức.', 'error')
    }
  }

  async function saveOrder(order, materials) {
    await createProductionOrder(businessId, order, materials)
    showToast('Đã tạo lệnh sản xuất.')
    setOrderFormOpen(false)
    await refreshQuiet()
  }

  async function openOrder(order) {
    setSelectedOrder(order)
    setOrderDetails(null)
    setDetailsLoading(true)
    try {
      setOrderDetails(await getProductionOrderDetails(businessId, order.id))
    } catch (loadError) {
      setOrderDetails({ materials: [], costs: [], outputs: [], wastes: [] })
      showToast(loadError.message || 'Không tải được chi tiết lệnh.', 'error')
    } finally {
      setDetailsLoading(false)
    }
  }

  async function refreshOrder() {
    await refreshQuiet()
    if (selectedOrder) {
      setOrderDetails(await getProductionOrderDetails(businessId, selectedOrder.id))
    }
  }

  async function performStatus(status) {
    await updateProductionOrderStatus(businessId, selectedOrder.id, status)
    showToast(status === 'in_progress' ? 'Đã bắt đầu lệnh sản xuất.' : status === 'completed' ? 'Đã hoàn tất lệnh sản xuất.' : 'Đã hủy lệnh sản xuất.')
    await refreshOrder()
  }

  async function performIssue(items) {
    await issueProductionMaterials(businessId, selectedOrder.id, items)
    showToast('Đã xuất nguyên liệu cho lệnh.')
    await refreshOrder()
  }

  async function performReturn(items) {
    await returnProductionMaterials(businessId, selectedOrder.id, items)
    showToast('Đã trả nguyên liệu thừa về kho.')
    await refreshOrder()
  }

  async function performReceive(payload) {
    await receiveProductionOutput(businessId, selectedOrder.id, payload.quantity, payload.unitCost, payload.note)
    showToast('Đã nhập thành phẩm vào kho.')
    await refreshOrder()
  }

  async function performWaste(payload) {
    await recordProductionWaste(businessId, selectedOrder.id, payload.quantity, payload.wasteType, payload.productId, payload.unitCost, payload.reason)
    showToast(payload.wasteType === 'rework' ? 'Đã ghi nhận sản lượng làm lại.' : 'Đã ghi nhận phế phẩm.')
    await refreshOrder()
  }

  async function performCost(cost) {
    await addProductionCost(businessId, selectedOrder.id, cost)
    showToast('Đã thêm chi phí sản xuất.')
    await refreshOrder()
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Định mức và điều hành xưởng</p>
          <h1 className="page-title">Sản xuất</h1>
          <p className="page-description">Theo dõi từ nguyên vật liệu đến thành phẩm, chi phí và chênh lệch thực tế.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && <button className="btn-secondary" type="button" onClick={() => openBomForm()}><ClipboardList size={17} /> Tạo định mức</button>}
          {canManage && <button className="btn-primary" type="button" onClick={() => setOrderFormOpen(true)}><Plus size={18} /> Tạo lệnh sản xuất</button>}
        </div>
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={ClipboardList} label="Định mức đang dùng" value={formatNumber(stats.activeBoms)} tone="sky" />
        <Metric icon={Factory} label="Lệnh đang mở" value={formatNumber(stats.openOrders)} tone="amber" />
        <Metric icon={PackageCheck} label="Đã hoàn tất" value={formatNumber(stats.completedOrders)} tone="emerald" />
        <Metric icon={CircleDollarSign} label="Giá thành đã ghi nhận" value={formatCurrency(stats.actualCost)} tone="violet" />
      </section>

      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5">
        <TabButton active={tab === 'orders'} onClick={() => changeTab('orders')} icon={Factory}>Lệnh sản xuất</TabButton>
        <TabButton active={tab === 'boms'} onClick={() => changeTab('boms')} icon={ClipboardList}>Định mức BOM</TabButton>
        <TabButton active={tab === 'report'} onClick={() => changeTab('report')} icon={BarChart3}>Báo cáo sản xuất</TabButton>
      </div>

      {tab !== 'report' && <section className="surface mb-5 overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'orders' ? 'Tìm mã lệnh, thành phẩm hoặc định mức...' : 'Tìm mã, tên định mức hoặc thành phẩm...'} /></div><div className="flex items-center gap-2"><SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} />{tab === 'orders' ? <select className="field min-w-0 flex-1 sm:w-44" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="planned">Đang chờ</option><option value="in_progress">Đang sản xuất</option><option value="completed">Đã hoàn tất</option><option value="cancelled">Đã hủy</option></select> : <select className="field min-w-0 flex-1 sm:w-44" value={bomStatusFilter} onChange={(event) => setBomStatusFilter(event.target.value)}><option value="all">Tất cả định mức</option><option value="active">Đang dùng</option><option value="draft">Bản nháp</option><option value="archived">Lưu trữ</option></select>}<button className="btn-icon" type="button" onClick={() => loadProduction()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button></div></div></section>}

      {loading ? <div className="surface p-5"><Loading rows={6} /></div> : error ? <section className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center"><Factory className="text-rose-500" size={34} /><h2 className="mt-4 text-lg font-bold text-slate-900">Chưa thể tải module Sản xuất</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{error}</p><button className="btn-primary mt-5" type="button" onClick={() => loadProduction()}><RefreshCw size={17} /> Thử lại</button></section> : tab === 'orders' ? <OrderList orders={filteredOrders} pageItems={orderPages.pageItems} page={orderPages.page} pageCount={orderPages.pageCount} pageSize={orderPages.pageSize} onChangePage={orderPages.setPage} onOpen={openOrder} canManage={canManage} onCreate={() => setOrderFormOpen(true)} /> : tab === 'boms' ? <BomList boms={filteredBoms} pageItems={bomPages.pageItems} page={bomPages.page} pageCount={bomPages.pageCount} pageSize={bomPages.pageSize} onChangePage={bomPages.setPage} onEdit={openBomForm} onToggleStatus={changeBomStatus} canManage={canManage} onCreate={() => openBomForm()} /> : <ProductionReport orders={orders} boms={boms} stats={stats} />}

      <BomForm open={bomFormOpen} bom={editingBom} products={products} bomItems={editingBomItems} onClose={() => setBomFormOpen(false)} onSave={saveBom} />
      <ProductionOrderForm open={orderFormOpen} boms={boms} products={products} onClose={() => setOrderFormOpen(false)} onSave={saveOrder} />
      <ProductionOrderDetail open={Boolean(selectedOrder)} order={selectedOrder} details={detailsLoading ? null : orderDetails} products={products} canManage={canManage} canManageCosts={canManageCosts} onClose={() => { setSelectedOrder(null); setOrderDetails(null) }} onStatus={performStatus} onIssue={performIssue} onReturn={performReturn} onReceive={performReceive} onWaste={performWaste} onAddCost={performCost} />
    </div>
  )
}

function OrderList({ orders, pageItems, page, pageCount, pageSize, onChangePage, onOpen, canManage, onCreate }) {
  return <section className="surface overflow-hidden">{orders.length === 0 ? <EmptyState icon={Factory} title="Chưa có lệnh sản xuất" description="Tạo lệnh từ một định mức đang dùng để bắt đầu theo dõi nguyên liệu và giá thành." action={canManage && <button className="btn-primary" type="button" onClick={onCreate}><Plus size={17} /> Tạo lệnh sản xuất</button>} /> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1040px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Lệnh</th><th className="px-4 py-3.5">Thành phẩm</th><th className="px-4 py-3.5">Kế hoạch</th><th className="px-4 py-3.5">Đã nhập</th><th className="px-4 py-3.5 text-right">Giá thành</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-5 py-3.5 text-right">Chi tiết</th></tr></thead><tbody className="divide-y divide-slate-100">{pageItems.map((order) => <OrderRow key={order.id} order={order} onOpen={() => onOpen(order)} />)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{pageItems.map((order) => <OrderCard key={order.id} order={order} onOpen={() => onOpen(order)} />)}</div><Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={orders.length} onChange={onChangePage} /></>}</section>
}

function OrderRow({ order, onOpen }) {
  const status = statusLabel(orderStatusLabels, order.status)
  return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-sm font-bold text-slate-800">{order.code}</p><p className="mt-1 text-xs text-slate-400">{dateOnly(order.order_date)}{order.bom_code ? ' · ' + order.bom_code : ''}</p></td><td className="px-4 py-4"><p className="max-w-56 truncate text-sm font-bold text-slate-800">{order.output_product_name}</p><p className="mt-1 text-xs text-slate-400">{order.output_product_code || 'Chưa có mã'} · {order.output_unit}</p></td><td className="px-4 py-4 text-sm font-semibold text-slate-700">{formatNumber(order.planned_quantity)}</td><td className="px-4 py-4 text-sm font-semibold text-emerald-700">{formatNumber(order.actual_quantity)}</td><td className="px-4 py-4 text-right"><p className="text-sm font-extrabold text-slate-800">{formatCurrency(order.actual_total_cost)}</p><p className="mt-1 text-xs text-slate-400">{formatCurrency(order.actual_unit_cost)} / {order.output_unit}</p></td><td className="px-4 py-4"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-bold ' + status.className}>{status.label}</span></td><td className="px-5 py-4 text-right"><button className="btn-ghost" type="button" onClick={onOpen}>Xem lệnh</button></td></tr>
}

function OrderCard({ order, onOpen }) {
  const status = statusLabel(orderStatusLabels, order.status)
  return <article className="p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><Factory size={19} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{order.code}</p><p className="mt-1 truncate text-xs text-slate-400">{order.output_product_name} · {dateOnly(order.order_date)}</p></div><span className={'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ' + status.className}>{status.label}</span></div><div className="mt-4 grid grid-cols-3 gap-2"><MiniValue label="Kế hoạch" value={formatNumber(order.planned_quantity)} /><MiniValue label="Đã nhập" value={formatNumber(order.actual_quantity)} /><MiniValue label="Giá thành" value={formatCurrency(order.actual_total_cost)} /></div><button className="btn-secondary mt-3 w-full" type="button" onClick={onOpen}>Xem chi tiết lệnh</button></div></div></article>
}

function BomList({ boms, pageItems, page, pageCount, pageSize, onChangePage, onEdit, onToggleStatus, canManage, onCreate }) {
  return <section className="surface overflow-hidden">{boms.length === 0 ? <EmptyState icon={ClipboardList} title="Chưa có định mức" description="Tạo định mức để lệnh sản xuất tự chụp nguyên vật liệu và giá vốn tham chiếu." action={canManage && <button className="btn-primary" type="button" onClick={onCreate}><Plus size={17} /> Tạo định mức</button>} /> : <><div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[940px] border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3.5">Định mức</th><th className="px-4 py-3.5">Thành phẩm</th><th className="px-4 py-3.5 text-right">Sản lượng chuẩn</th><th className="px-4 py-3.5 text-right">Vật tư</th><th className="px-4 py-3.5 text-right">Chi phí NVL</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-5 py-3.5 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{pageItems.map((bom) => <BomRow key={bom.id} bom={bom} canManage={canManage} onEdit={() => onEdit(bom)} onToggleStatus={() => onToggleStatus(bom)} />)}</tbody></table></div><div className="divide-y divide-slate-100 lg:hidden">{pageItems.map((bom) => <BomCard key={bom.id} bom={bom} canManage={canManage} onEdit={() => onEdit(bom)} onToggleStatus={() => onToggleStatus(bom)} />)}</div><Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={boms.length} onChange={onChangePage} /></>}</section>
}

function BomRow({ bom, canManage, onEdit, onToggleStatus }) {
  const status = statusLabel(bomStatusLabels, bom.status)
  return <tr className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><p className="text-sm font-bold text-slate-800">{bom.code}</p><p className="mt-1 max-w-52 truncate text-xs text-slate-400">{bom.name} · v{bom.version}</p></td><td className="px-4 py-4"><p className="text-sm font-bold text-slate-800">{bom.output_product_name}</p><p className="mt-1 text-xs text-slate-400">{bom.output_product_code || 'Chưa có mã'} · {bom.output_unit}</p></td><td className="px-4 py-4 text-right text-sm font-semibold text-slate-700">{formatNumber(bom.output_quantity)}</td><td className="px-4 py-4 text-right text-sm font-semibold text-slate-700">{formatNumber(bom.item_count)}</td><td className="px-4 py-4 text-right text-sm font-extrabold text-slate-800">{formatCurrency(bom.planned_material_cost)}</td><td className="px-4 py-4"><span className={'inline-flex rounded-full px-2.5 py-1 text-xs font-bold ' + status.className}>{status.label}</span></td><td className="px-5 py-4">{canManage && <div className="flex justify-end gap-1">{bom.status !== 'archived' && <button className="btn-icon" type="button" onClick={onEdit} aria-label="Sửa định mức"><Hammer size={17} /></button>}<button className="btn-icon text-sky-600" type="button" onClick={onToggleStatus} aria-label={bom.status === 'active' ? 'Lưu trữ định mức' : 'Kích hoạt định mức'}>{bom.status === 'active' ? <Archive size={17} /> : <Check size={17} />}</button></div>}</td></tr>
}

function BomCard({ bom, canManage, onEdit, onToggleStatus }) {
  const status = statusLabel(bomStatusLabels, bom.status)
  return <article className="p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><ClipboardList size={19} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{bom.code}</p><p className="mt-1 truncate text-xs text-slate-400">{bom.name} · {bom.output_product_name}</p></div><span className={'shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ' + status.className}>{status.label}</span></div><div className="mt-4 grid grid-cols-3 gap-2"><MiniValue label="Sản lượng" value={formatNumber(bom.output_quantity)} /><MiniValue label="Vật tư" value={formatNumber(bom.item_count)} /><MiniValue label="Chi phí NVL" value={formatCurrency(bom.planned_material_cost)} /></div>{canManage && <div className="mt-3 flex gap-2">{bom.status !== 'archived' && <button className="btn-secondary flex-1" type="button" onClick={onEdit}><Hammer size={16} /> Chỉnh sửa</button>}<button className="btn-icon text-sky-600" type="button" onClick={onToggleStatus} aria-label={bom.status === 'active' ? 'Lưu trữ định mức' : 'Kích hoạt định mức'}>{bom.status === 'active' ? <Archive size={17} /> : <Check size={17} />}</button></div>}</div></div></article>
}

function ProductionReport({ orders, boms, stats }) {
  const categoryTotals = useMemo(() => orders.reduce((result, order) => {
    const rows = [
      ['Nguyên vật liệu', Number(order.actual_material_cost) || 0, Number(order.planned_material_cost) || 0],
      ['Nhân công', Number(order.actual_labor_cost) || 0, Number(order.planned_labor_cost) || 0],
      ['Máy móc / thiết bị', Number(order.actual_machine_cost) || 0, Number(order.planned_machine_cost) || 0],
      ['Gia công ngoài', Number(order.actual_outsourcing_cost) || 0, Number(order.planned_outsourcing_cost) || 0],
      ['Chi phí khác', Number(order.actual_other_cost) || 0, Number(order.planned_other_cost) || 0],
    ]
    rows.forEach(([label, actual, planned]) => {
      if (!result[label]) result[label] = { label, actual: 0, planned: 0 }
      result[label].actual += actual
      result[label].planned += planned
    })
    return result
  }, {}), [orders])
  const variance = orders.reduce((sum, order) => sum + (Number(order.cost_variance) || 0), 0)
  const rows = Object.values(categoryTotals)
  return <div className="space-y-5"><section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={Target} label="Sản lượng kế hoạch" value={formatNumber(orders.reduce((sum, row) => sum + (Number(row.planned_quantity) || 0), 0))} tone="sky" /><Metric icon={PackageCheck} label="Sản lượng đã nhập" value={formatNumber(stats.produced)} tone="emerald" /><Metric icon={XCircle} label="Phế phẩm" value={formatNumber(stats.scrapped)} tone="rose" /><Metric icon={CircleDollarSign} label="Chênh lệch giá thành" value={formatCurrency(variance)} tone={variance > 0 ? 'rose' : 'emerald'} /></section><section className="surface overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="section-title">Chi phí theo nhóm</h2><p className="section-description">Tổng hợp toàn bộ lệnh đang có trong hệ thống.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{formatNumber(orders.length)} lệnh</span></div>{!rows.length ? <EmptyState icon={BarChart3} title="Chưa có dữ liệu chi phí" /> : <div className="divide-y divide-slate-100">{rows.map((row) => <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6" key={row.label}><div><p className="text-sm font-bold text-slate-800">{row.label}</p><p className="mt-1 text-xs text-slate-400">Dự kiến {formatCurrency(row.planned)}</p></div><div className="text-right"><p className="text-sm font-extrabold text-slate-900">{formatCurrency(row.actual)}</p><p className={'mt-1 text-xs font-bold ' + (row.actual > row.planned ? 'text-rose-600' : 'text-emerald-600')}>{row.actual > row.planned ? '+' : ''}{formatCurrency(row.actual - row.planned)}</p></div></div>)}</div>}</section><section className="surface overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><h2 className="section-title">Hiệu quả theo lệnh</h2><p className="section-description">So sánh sản lượng và giá thành thực tế của từng lệnh.</p></div>{orders.length === 0 ? <EmptyState icon={Factory} title="Chưa có lệnh sản xuất" /> : <div className="divide-y divide-slate-100">{orders.slice(0, 12).map((order) => <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={order.id}><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{order.code} · {order.output_product_name}</p><p className="mt-1 text-xs text-slate-400">{dateOnly(order.order_date)} · {statusLabel(orderStatusLabels, order.status).label}</p></div><div className="flex items-center gap-5 text-xs"><span className="text-slate-500">SL {formatNumber(order.actual_quantity)} / {formatNumber(order.planned_quantity)}</span><span className="font-extrabold text-slate-800">{formatCurrency(order.actual_unit_cost)} / {order.output_unit}</span></div></div>)}</div>}</section><p className="text-xs leading-5 text-slate-400">Có {formatNumber(boms.length)} định mức trong danh mục. Giá thành thực tế được tính từ nguyên liệu đã xuất trừ phần trả lại và các chi phí đã ghi nhận.</p></div>
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return <button className={'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition ' + (active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')} type="button" onClick={onClick}><Icon size={17} /> {children}</button>
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = { sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600', rose: 'bg-rose-50 text-rose-600' }
  return <article className="surface flex items-center gap-3 p-4 sm:p-5"><span className={'grid size-10 shrink-0 place-items-center rounded-xl ' + tones[tone]}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-xl">{value}</p></div></article>
}

function MiniValue({ label, value }) {
  return <div className="rounded-xl bg-white px-2.5 py-2"><p className="truncate text-[10px] text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-extrabold text-slate-700">{value}</p></div>
}
