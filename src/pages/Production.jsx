/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BarChart3,
  Check,
  CircleDollarSign,
  ClipboardList,
  Factory,
  Hammer,
  PackageCheck,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Target,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { canAccess } from '../lib/permissions'
import { formatCurrency, formatDateTime, formatNumber } from '../lib/formatters'
import usePagination from '../hooks/usePagination'
import Pagination from '../components/common/Pagination'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import StatusBadge from '../components/common/StatusBadge'
import ConfirmDialog from '../components/common/ConfirmDialog'
import BomForm from '../components/production/BomForm'
import ProductionOrderForm from '../components/production/ProductionOrderForm'
import ProductionOrderDetail from '../components/production/ProductionOrderDetail'
import {
  addProductionCost,
  createProductionOrder,
  deleteProductionBom,
  deleteProductionOrder,
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
  const [tab, setTab] = useState(
    searchParams.get('tab') === 'boms'
      ? 'boms'
      : searchParams.get('tab') === 'report'
      ? 'report'
      : 'orders'
  )
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
  const [deletingBom, setDeletingBom] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingOrder, setDeletingOrder] = useState(null)
  const [deletingOrderBusy, setDeletingOrderBusy] = useState(false)

  const canManage = canAccess(business?.role, 'production_manage')
  const canManageCosts = canAccess(business?.role, 'production_cost')

  const loadProduction = useCallback(
    async ({ quiet = false } = {}) => {
      if (!businessId) return
      if (!quiet) setLoading(true)
      setError('')
      try {
        const data = await listProductionData(businessId)
        setProducts(data.products)
        setBoms(data.boms)
        setOrders(data.orders)
        setSelectedOrder((current) =>
          current ? data.orders.find((row) => row.id === current.id) ?? current : null
        )
      } catch (loadError) {
        console.error(loadError)
        setError(loadError.message || 'Không tải được dữ liệu sản xuất. Vui lòng thử lại.')
      } finally {
        if (!quiet) setLoading(false)
      }
    },
    [businessId]
  )

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
      return [
        order.code,
        order.output_product_name,
        order.output_product_code,
        order.bom_code,
        order.bom_name,
      ].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [orders, search, statusFilter])

  const filteredBoms = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return boms.filter((bom) => {
      if (bomStatusFilter !== 'all' && bom.status !== bomStatusFilter) return false
      if (!needle) return true
      return [bom.code, bom.name, bom.output_product_name, bom.output_product_code].some((value) =>
        String(value ?? '').toLocaleLowerCase('vi').includes(needle)
      )
    })
  }, [boms, bomStatusFilter, search])

  const orderPages = usePagination(filteredOrders, search + '\u0000' + statusFilter, 10)
  const bomPages = usePagination(filteredBoms, search + '\u0000' + bomStatusFilter, 10)

  const stats = useMemo(
    () => ({
      activeBoms: boms.filter((bom) => bom.status === 'active').length,
      openOrders: orders.filter((order) => ['planned', 'in_progress'].includes(order.status)).length,
      completedOrders: orders.filter((order) => order.status === 'completed').length,
      actualCost: orders.reduce((sum, order) => sum + (Number(order.actual_total_cost) || 0), 0),
      produced: orders.reduce((sum, order) => sum + (Number(order.actual_quantity) || 0), 0),
      scrapped: orders.reduce((sum, order) => sum + (Number(order.scrapped_quantity) || 0), 0),
    }),
    [boms, orders]
  )

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

  async function confirmDeleteBom() {
    if (!deletingBom || deleting) return
    setDeleting(true)
    try {
      await deleteProductionBom(businessId, deletingBom.id)
      setDeletingBom(null)
      showToast('Đã xóa định mức.')
      await refreshQuiet()
    } catch (deleteError) {
      showToast(deleteError.message || 'Không thể xóa định mức.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function saveOrder(order, materials) {
    await createProductionOrder(businessId, order, materials)
    showToast('Đã tạo lệnh sản xuất.')
    setOrderFormOpen(false)
    await refreshQuiet()
  }

  async function confirmDeleteOrder() {
    if (!deletingOrder || deletingOrderBusy) return
    setDeletingOrderBusy(true)
    try {
      await deleteProductionOrder(businessId, deletingOrder.id)
      setDeletingOrder(null)
      showToast('Đã xóa lệnh sản xuất.')
      await refreshQuiet()
    } catch (deleteError) {
      showToast(deleteError.message || 'Không thể xóa lệnh sản xuất.', 'error')
    } finally {
      setDeletingOrderBusy(false)
    }
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
    showToast(
      status === 'in_progress'
        ? 'Đã bắt đầu lệnh sản xuất.'
        : status === 'completed'
        ? 'Đã hoàn tất lệnh sản xuất.'
        : 'Đã hủy lệnh sản xuất.'
    )
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
    await receiveProductionOutput(
      businessId,
      selectedOrder.id,
      payload.quantity,
      payload.unitCost,
      payload.note
    )
    showToast('Đã nhập thành phẩm vào kho.')
    await refreshOrder()
  }

  async function performWaste(payload) {
    await recordProductionWaste(
      businessId,
      selectedOrder.id,
      payload.quantity,
      payload.wasteType,
      payload.productId,
      payload.unitCost,
      payload.reason
    )
    showToast(
      payload.wasteType === 'rework'
        ? 'Đã ghi nhận sản lượng làm lại.'
        : 'Đã ghi nhận phế phẩm.'
    )
    await refreshOrder()
  }

  async function performCost(cost) {
    await addProductionCost(businessId, selectedOrder.id, cost)
    showToast('Đã thêm chi phí sản xuất.')
    await refreshOrder()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Định mức và điều hành xưởng"
        title="Sản xuất"
        description="Theo dõi từ nguyên vật liệu đến thành phẩm, chi phí và chênh lệch thực tế."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {canManage && (
              <button className="btn-secondary flex-1 sm:flex-initial" type="button" onClick={() => openBomForm()}>
                <ClipboardList size={17} />
                <span>Tạo định mức</span>
              </button>
            )}
            {canManage && (
              <button className="btn-primary flex-1 sm:flex-initial" type="button" onClick={() => setOrderFormOpen(true)}>
                <Plus size={18} />
                <span>Tạo lệnh sản xuất</span>
              </button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={ClipboardList}
          label="Định mức đang dùng"
          value={formatNumber(stats.activeBoms)}
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={Factory}
          label="Lệnh đang mở"
          value={formatNumber(stats.openOrders)}
          tone="amber"
          size="sm"
        />
        <MetricCard
          icon={PackageCheck}
          label="Đã hoàn tất"
          value={formatNumber(stats.completedOrders)}
          tone="emerald"
          size="sm"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Giá thành đã ghi nhận"
          value={formatCurrency(stats.actualCost)}
          tone="indigo"
          size="sm"
        />
      </section>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-slate-100 p-1.5">
        <TabButton
          active={tab === 'orders'}
          onClick={() => changeTab('orders')}
          icon={Factory}
        >
          Lệnh sản xuất
        </TabButton>
        <TabButton
          active={tab === 'boms'}
          onClick={() => changeTab('boms')}
          icon={ClipboardList}
        >
          Định mức BOM
        </TabButton>
        <TabButton
          active={tab === 'report'}
          onClick={() => changeTab('report')}
          icon={BarChart3}
        >
          Báo cáo sản xuất
        </TabButton>
      </div>

      {/* Filter / Search for Orders and BOMs */}
      {tab !== 'report' && (
        <section className="surface overflow-hidden">
          <FilterBar
            searchPlaceholder={
              tab === 'orders'
                ? 'Tìm mã lệnh, thành phẩm hoặc định mức...'
                : 'Tìm mã, tên định mức hoặc thành phẩm...'
            }
            searchValue={search}
            onSearchChange={setSearch}
            onRefresh={() => loadProduction()}
            refreshing={loading}
          >
            {tab === 'orders' ? (
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'planned', label: 'Đang chờ' },
                  { id: 'in_progress', label: 'Đang SX' },
                  { id: 'completed', label: 'Hoàn tất' },
                  { id: 'cancelled', label: 'Đã hủy' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      statusFilter === item.id
                        ? item.id === 'completed'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : item.id === 'in_progress'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'active', label: 'Đang dùng' },
                  { id: 'draft', label: 'Bản nháp' },
                  { id: 'archived', label: 'Lưu trữ' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBomStatusFilter(item.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      bomStatusFilter === item.id
                        ? item.id === 'active'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </FilterBar>
        </section>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="surface p-5">
          <Loading rows={6} />
        </div>
      ) : error ? (
        <section className="surface flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <Factory className="text-rose-500" size={34} />
          <h2 className="mt-4 text-lg font-bold text-slate-900">Chưa thể tải module Sản xuất</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{error}</p>
          <button
            className="btn-primary mt-5"
            type="button"
            onClick={() => loadProduction()}
          >
            <RefreshCw size={17} />
            <span>Thử lại</span>
          </button>
        </section>
      ) : tab === 'orders' ? (
        <OrderList
          orders={filteredOrders}
          pageItems={orderPages.pageItems}
          page={orderPages.page}
          pageCount={orderPages.pageCount}
          pageSize={orderPages.pageSize}
          onChangePage={orderPages.setPage}
          onOpen={openOrder}
          onDelete={setDeletingOrder}
          canManage={canManage}
          onCreate={() => setOrderFormOpen(true)}
        />
      ) : tab === 'boms' ? (
        <BomList
          boms={filteredBoms}
          pageItems={bomPages.pageItems}
          page={bomPages.page}
          pageCount={bomPages.pageCount}
          pageSize={bomPages.pageSize}
          onChangePage={bomPages.setPage}
          onEdit={openBomForm}
          onToggleStatus={changeBomStatus}
          onDelete={setDeletingBom}
          canManage={canManage}
          onCreate={() => openBomForm()}
        />
      ) : (
        <ProductionReport orders={orders} boms={boms} />
      )}

      {/* Modals and Drawers */}
      <BomForm
        open={bomFormOpen}
        bom={editingBom}
        products={products}
        bomItems={editingBomItems}
        onClose={() => setBomFormOpen(false)}
        onSave={saveBom}
      />
      <ProductionOrderForm
        open={orderFormOpen}
        boms={boms}
        products={products}
        canManageCosts={canManageCosts}
        onClose={() => setOrderFormOpen(false)}
        onSave={saveOrder}
      />
      <ProductionOrderDetail
        open={Boolean(selectedOrder)}
        order={selectedOrder}
        details={detailsLoading ? null : orderDetails}
        products={products}
        canManage={canManage}
        canManageCosts={canManageCosts}
        onClose={() => {
          setSelectedOrder(null)
          setOrderDetails(null)
        }}
        onStatus={performStatus}
        onIssue={performIssue}
        onReturn={performReturn}
        onReceive={performReceive}
        onWaste={performWaste}
        onAddCost={performCost}
      />
      <ConfirmDialog
        open={Boolean(deletingBom)}
        onClose={() => setDeletingBom(null)}
        onConfirm={confirmDeleteBom}
        loading={deleting}
        title="Xóa vĩnh viễn định mức?"
        description={deletingBom ? `“${deletingBom.code} - ${deletingBom.name}” sẽ bị xóa.` : ''}
        confirmLabel="Xóa định mức"
        message="Chỉ định mức chưa được dùng trong lệnh sản xuất mới có thể xóa. Định mức đã phát sinh lệnh cần được lưu trữ."
      />
      <ConfirmDialog
        open={Boolean(deletingOrder)}
        onClose={() => setDeletingOrder(null)}
        onConfirm={confirmDeleteOrder}
        loading={deletingOrderBusy}
        title="Xóa vĩnh viễn lệnh sản xuất?"
        description={deletingOrder ? `“${deletingOrder.code}” sẽ bị xóa khỏi danh sách.` : ''}
        confirmLabel="Xóa lệnh"
        message="Chỉ lệnh đang chờ hoặc đã hủy và chưa phát sinh kho, sản lượng mới có thể xóa."
      />
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? 'bg-white text-sky-700 shadow-sm'
          : 'text-slate-500 hover:text-slate-800'
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon size={17} />
      <span>{children}</span>
    </button>
  )
}

function OrderList({
  orders,
  pageItems,
  page,
  pageCount,
  pageSize,
  onChangePage,
  onOpen,
  onDelete,
  canManage,
  onCreate,
}) {
  return (
    <section className="surface overflow-hidden">
      {orders.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Chưa có lệnh sản xuất"
          description="Tạo lệnh từ một định mức đang dùng để bắt đầu theo dõi nguyên liệu và giá thành."
          action={
            canManage && (
              <button className="btn-primary" type="button" onClick={onCreate}>
                <Plus size={17} />
                <span>Tạo lệnh sản xuất</span>
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Lệnh</th>
                  <th className="px-4 py-3.5">Thành phẩm</th>
                  <th className="px-4 py-3.5 text-right">Kế hoạch</th>
                  <th className="px-4 py-3.5 text-right">Đã nhập</th>
                  <th className="px-4 py-3.5 text-right">Giá thành</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((order) => (
                  <OrderRow key={order.id} order={order} canManage={canManage} onOpen={() => onOpen(order)} onDelete={() => onDelete(order)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 lg:hidden">
            {pageItems.map((order) => (
              <OrderCard key={order.id} order={order} canManage={canManage} onOpen={() => onOpen(order)} onDelete={() => onDelete(order)} />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={orders.length}
            onChange={onChangePage}
          />
        </>
      )}
    </section>
  )
}

function OrderRow({ order, canManage, onOpen, onDelete }) {
  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <p className="text-sm font-bold text-sky-700">{order.code}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          <span className="tabular-nums">{dateOnly(order.order_date)}</span>
          {order.bom_code ? ` · ${order.bom_code}` : ''}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="max-w-56 truncate text-sm font-bold text-slate-900">
          {order.output_product_name}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {order.output_product_code || 'Chưa có mã'} · {order.output_unit}
        </p>
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-semibold text-slate-700">
        {formatNumber(order.planned_quantity)}
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-semibold text-emerald-700">
        {formatNumber(order.actual_quantity)}
      </td>
      <td className="px-4 py-4 text-right">
        <p className="tabular-nums text-sm font-extrabold text-slate-800">
          {formatCurrency(order.actual_total_cost)}
        </p>
        <p className="tabular-nums mt-0.5 text-xs text-slate-400">
          {formatCurrency(order.actual_unit_cost)} / {order.output_unit}
        </p>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={order.status} size="sm" />
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex justify-end gap-1">
          <button className="btn-ghost" type="button" onClick={onOpen}>Xem lệnh</button>
          {canManage && ['planned', 'in_progress', 'cancelled'].includes(order.status) && (
            <button className="btn-icon text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label={`Xóa lệnh ${order.code}`} title="Xóa"><Trash2 size={17} /></button>
          )}
        </div>
      </td>
    </tr>
  )
}

function OrderCard({ order, canManage, onOpen, onDelete }) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <Factory size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{order.code}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {order.output_product_name} ·{' '}
                <span className="tabular-nums">{dateOnly(order.order_date)}</span>
              </p>
            </div>
            <StatusBadge status={order.status} size="sm" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniValue label="Kế hoạch" value={formatNumber(order.planned_quantity)} />
            <MiniValue label="Đã nhập" value={formatNumber(order.actual_quantity)} />
            <MiniValue label="Giá thành" value={formatCurrency(order.actual_total_cost)} />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-secondary flex-1 justify-center" type="button" onClick={onOpen}>Xem chi tiết lệnh</button>
            {canManage && ['planned', 'in_progress', 'cancelled'].includes(order.status) && (
              <button className="btn-icon text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label={`Xóa lệnh ${order.code}`} title="Xóa"><Trash2 size={17} /></button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function BomList({
  boms,
  pageItems,
  page,
  pageCount,
  pageSize,
  onChangePage,
  onEdit,
  onToggleStatus,
  onDelete,
  canManage,
  onCreate,
}) {
  return (
    <section className="surface overflow-hidden">
      {boms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có định mức"
          description="Tạo định mức để lệnh sản xuất tự chụp nguyên vật liệu và giá vốn tham chiếu."
          action={
            canManage && (
              <button className="btn-primary" type="button" onClick={onCreate}>
                <Plus size={17} />
                <span>Tạo định mức</span>
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Định mức</th>
                  <th className="px-4 py-3.5">Thành phẩm</th>
                  <th className="px-4 py-3.5 text-right">Sản lượng chuẩn</th>
                  <th className="px-4 py-3.5 text-right">Vật tư</th>
                  <th className="px-4 py-3.5 text-right">Chi phí NVL</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((bom) => (
                  <BomRow
                    key={bom.id}
                    bom={bom}
                    canManage={canManage}
                    onEdit={() => onEdit(bom)}
                    onToggleStatus={() => onToggleStatus(bom)}
                    onDelete={() => onDelete(bom)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 lg:hidden">
            {pageItems.map((bom) => (
              <BomCard
                key={bom.id}
                bom={bom}
                canManage={canManage}
                onEdit={() => onEdit(bom)}
                onToggleStatus={() => onToggleStatus(bom)}
                onDelete={() => onDelete(bom)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={boms.length}
            onChange={onChangePage}
          />
        </>
      )}
    </section>
  )
}

function BomRow({ bom, canManage, onEdit, onToggleStatus, onDelete }) {
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <p className="text-sm font-bold text-slate-800">{bom.code}</p>
        <p className="mt-0.5 max-w-52 truncate text-xs text-slate-400">
          {bom.name} · v{bom.version}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="text-sm font-bold text-slate-800">{bom.output_product_name}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {bom.output_product_code || 'Chưa có mã'} · {bom.output_unit}
        </p>
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-semibold text-slate-700">
        {formatNumber(bom.output_quantity)}
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-semibold text-slate-700">
        {formatNumber(bom.item_count)}
      </td>
      <td className="tabular-nums px-4 py-4 text-right text-sm font-extrabold text-slate-800">
        {formatCurrency(bom.planned_material_cost)}
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={bom.status} size="sm" />
      </td>
      <td className="px-5 py-4">
        {canManage && (
          <div className="flex justify-end gap-1">
            {bom.status !== 'archived' && (
              <button
                className="btn-icon"
                type="button"
                onClick={onEdit}
                aria-label="Sửa định mức"
              >
                <Hammer size={17} />
              </button>
            )}
            <button
              className="btn-icon text-sky-600"
              type="button"
              onClick={onToggleStatus}
              aria-label={bom.status === 'active' ? 'Lưu trữ định mức' : 'Kích hoạt định mức'}
            >
              {bom.status === 'active' ? <Archive size={17} /> : <Check size={17} />}
            </button>
            <button
              className="btn-icon text-rose-600 hover:bg-rose-50"
              type="button"
              onClick={onDelete}
              aria-label={`Xóa định mức ${bom.code}`}
              title="Xóa"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function BomCard({ bom, canManage, onEdit, onToggleStatus, onDelete }) {
  return (
    <article className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
          <ClipboardList size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-800">{bom.code}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {bom.name} · {bom.output_product_name}
              </p>
            </div>
            <StatusBadge status={bom.status} size="sm" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniValue label="Sản lượng" value={formatNumber(bom.output_quantity)} />
            <MiniValue label="Vật tư" value={formatNumber(bom.item_count)} />
            <MiniValue label="Chi phí NVL" value={formatCurrency(bom.planned_material_cost)} />
          </div>
          {canManage && (
            <div className="mt-3 flex gap-2">
              {bom.status !== 'archived' && (
                <button
                  className="btn-secondary flex-1 justify-center"
                  type="button"
                  onClick={onEdit}
                >
                  <Hammer size={16} />
                  <span>Chỉnh sửa</span>
                </button>
              )}
              <button
                className="btn-icon text-sky-600"
                type="button"
                onClick={onToggleStatus}
                aria-label={bom.status === 'active' ? 'Lưu trữ định mức' : 'Kích hoạt định mức'}
              >
                {bom.status === 'active' ? <Archive size={17} /> : <Check size={17} />}
              </button>
              <button
                className="btn-icon text-rose-600 hover:bg-rose-50"
                type="button"
                onClick={onDelete}
                aria-label={`Xóa định mức ${bom.code}`}
                title="Xóa"
              >
                <Trash2 size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function ProductionReport({ orders, boms }) {
  const reportOrders = useMemo(
    () => orders.filter((order) => order.status !== 'cancelled'),
    [orders]
  )
  const categoryTotals = useMemo(
    () =>
      reportOrders.reduce((result, order) => {
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
      }, {}),
    [reportOrders]
  )
  const variance = reportOrders.reduce((sum, order) => sum + (Number(order.cost_variance) || 0), 0)
  const rows = Object.values(categoryTotals)
  const produced = reportOrders.reduce((sum, order) => sum + (Number(order.actual_quantity) || 0), 0)
  const scrapped = reportOrders.reduce((sum, order) => sum + (Number(order.scrapped_quantity) || 0), 0)

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 sm:gap-4">
        <MetricCard
          icon={Target}
          label="Sản lượng kế hoạch"
          value={reportOrders.reduce((sum, row) => sum + (Number(row.planned_quantity) || 0), 0)}
          format="number"
          tone="sky"
          size="sm"
        />
        <MetricCard
          icon={PackageCheck}
          label="Sản lượng đã nhập"
          value={produced}
          format="number"
          tone="emerald"
          size="sm"
        />
        <MetricCard
          icon={XCircle}
          label="Phế phẩm"
          value={scrapped}
          format="number"
          tone="rose"
          size="sm"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Chênh lệch giá thành"
          value={variance}
          format="currency"
          tone={variance > 0 ? 'rose' : 'emerald'}
          size="sm"
        />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Chi phí theo nhóm</h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Tổng hợp các lệnh sản xuất, không gồm lệnh đã hủy.
            </p>
          </div>
          <span className="tabular-nums rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
            {formatNumber(reportOrders.length)} lệnh
          </span>
        </div>
        {!rows.length ? (
          <EmptyState icon={BarChart3} title="Chưa có dữ liệu chi phí" />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <div
                className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:px-6"
                key={row.label}
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{row.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Dự kiến <span className="tabular-nums">{formatCurrency(row.planned)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums text-sm font-extrabold text-slate-900">
                    {formatCurrency(row.actual)}
                  </p>
                  <p
                    className={`tabular-nums mt-0.5 text-xs font-bold ${
                      row.actual > row.planned ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {row.actual > row.planned ? '+' : ''}
                    {formatCurrency(row.actual - row.planned)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">Hiệu quả theo lệnh</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            So sánh sản lượng và giá thành thực tế của từng lệnh.
          </p>
        </div>
        {reportOrders.length === 0 ? (
          <EmptyState icon={Factory} title="Chưa có lệnh sản xuất" />
        ) : (
          <div className="divide-y divide-slate-100">
            {reportOrders.slice(0, 12).map((order) => (
              <div
                className="flex flex-col gap-2 px-5 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                key={order.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {order.code} · {order.output_product_name}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className="tabular-nums">{dateOnly(order.order_date)}</span>
                    <span>·</span>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs">
                  <span className="tabular-nums text-slate-500">
                    SL {formatNumber(order.actual_quantity)} / {formatNumber(order.planned_quantity)}
                  </span>
                  <span className="tabular-nums font-extrabold text-slate-800">
                    {formatCurrency(order.actual_unit_cost)} / {order.output_unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Có <span className="tabular-nums font-semibold">{formatNumber(boms.length)}</span> định mức trong danh mục. Giá thành thực tế được tính từ nguyên liệu đã xuất trừ phần trả lại và các chi phí đã ghi nhận.
      </p>
    </div>
  )
}

function MiniValue({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium text-slate-400">{label}</p>
      <p className="tabular-nums mt-0.5 truncate text-xs font-extrabold text-slate-700">{value}</p>
    </div>
  )
}
