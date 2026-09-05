/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Barcode,
  Boxes,
  CircleDollarSign,
  Edit3,
  Package,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import useBusiness from '../hooks/useBusiness'
import { createProduct, deleteProduct, listProducts, setProductActive, subscribeToProducts, updateProduct } from '../services/productService'
import { formatCurrency, formatNumber } from '../lib/formatters'
import ProductForm from '../components/products/ProductForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import useToast from '../hooks/useToast'
import usePagination from '../hooks/usePagination'
import Pagination from '../components/common/Pagination'
import { canAccess } from '../lib/permissions'
import { removeProductImageByUrl } from '../services/productImageService'

function getStockState(product) {
  if (!product.active) return { label: 'Ngừng kinh doanh', className: 'bg-slate-100 text-slate-600' }
  if (product.product_type === 'service') return { label: 'Dịch vụ', className: 'bg-sky-50 text-sky-700' }
  const stock = Number(product.stock_on_hand) || 0
  const min = Number(product.min_stock) || 0
  if (stock <= 0) return { label: 'Hết hàng', className: 'bg-rose-50 text-rose-700' }
  if (stock <= min) return { label: 'Sắp hết', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Còn hàng', className: 'bg-emerald-50 text-emerald-700' }
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false)
  if (!product.image_url || failed) {
    return <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-500"><Package size={20} /></span>
  }
  return <img className="size-11 shrink-0 rounded-xl border border-slate-100 object-cover" src={product.image_url} alt="" onError={() => setFailed(true)} />
}

export default function Products() {
  const { businessId, business } = useBusiness()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deactivatingProduct, setDeactivatingProduct] = useState(null)
  const [deactivating, setDeactivating] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadProducts = useCallback(async ({ quiet = false } = {}) => {
    if (!businessId) return
    if (!quiet) setLoading(true)
    setError('')
    try {
      setProducts(await listProducts(businessId))
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được danh sách sản phẩm. Vui lòng thử lại.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    if (!businessId) return undefined
    return subscribeToProducts(businessId, () => loadProducts({ quiet: true }))
  }, [businessId, loadProducts])

  useEffect(() => {
    const query = searchParams.get('q')
    if (query !== null) setSearch(query)
    if (searchParams.get('new') === '1') {
      setEditingProduct(null)
      setFormOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return products.filter((product) => {
      if (status === 'active' && !product.active) return false
      if (status === 'inactive' && product.active) return false
      if (!needle) return true
      return [product.name, product.code, product.sku, product.barcode, product.category]
        .some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [products, search, status])

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter((product) => product.active).length,
    inactive: products.filter((product) => !product.active).length,
    lowStock: products.filter((product) => product.active && product.product_type !== 'service' && Number(product.stock_on_hand) <= Number(product.min_stock)).length,
  }), [products])

  const productPages = usePagination(filteredProducts, `${search}\u0000${status}`)
  const canManageProducts = canAccess(business?.role, 'products_manage')
  const canDeleteProducts = canAccess(business?.role, 'products_delete')

  function openCreate() {
    setEditingProduct(null)
    setFormOpen(true)
  }

  function openEdit(product) {
    setEditingProduct(product)
    setFormOpen(true)
  }

  async function saveProduct(values) {
    if (editingProduct) {
      await updateProduct(businessId, editingProduct.id, values)
      showToast('Đã cập nhật sản phẩm.')
    } else {
      await createProduct(businessId, values)
      showToast('Đã thêm sản phẩm mới.')
    }
    setFormOpen(false)
    setEditingProduct(null)
    await loadProducts({ quiet: true })
  }

  async function confirmDeactivate() {
    if (!deactivatingProduct) return
    setDeactivating(true)
    try {
      await setProductActive(businessId, deactivatingProduct.id, false)
      showToast('Đã ngừng kinh doanh sản phẩm.')
      setDeactivatingProduct(null)
      await loadProducts({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật sản phẩm.', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  async function reactivate(product) {
    try {
      await setProductActive(businessId, product.id, true)
      showToast('Đã kích hoạt lại sản phẩm.')
      await loadProducts({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể cập nhật sản phẩm.', 'error')
    }
  }

  async function confirmDelete() {
    if (!deletingProduct) return
    setDeleting(true)
    try {
      await deleteProduct(businessId, deletingProduct.id)
      await removeProductImageByUrl(businessId, deletingProduct.image_url)
      showToast('Đã xóa sản phẩm.')
      setDeletingProduct(null)
      await loadProducts({ quiet: true })
    } catch (actionError) {
      showToast(actionError.message || 'Không thể xóa sản phẩm.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">Danh mục hàng hóa</p>
          <h1 className="page-title">Sản phẩm</h1>
          <p className="page-description">Quản lý hàng hóa, dịch vụ, giá bán và định mức tồn kho.</p>
        </div>
        {canManageProducts && <button className="btn-primary" type="button" onClick={openCreate}><Plus size={18} /> Thêm sản phẩm</button>}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniMetric icon={Boxes} label="Tổng sản phẩm" value={stats.total} tone="sky" />
        <MiniMetric icon={CircleDollarSign} label="Đang kinh doanh" value={stats.active} tone="emerald" />
        <MiniMetric icon={Archive} label="Ngừng kinh doanh" value={stats.inactive} tone="slate" />
        <MiniMetric icon={PackageOpen} label="Tồn kho thấp" value={stats.lowStock} tone="amber" />
      </section>

      <section className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên, mã, SKU hoặc barcode..." />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="hidden text-slate-400 sm:block" size={18} />
            <select className="field min-w-0 flex-1 sm:w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang kinh doanh</option>
              <option value="inactive">Ngừng kinh doanh</option>
            </select>
            <button className="btn-icon" type="button" onClick={() => loadProducts()} disabled={loading} aria-label="Làm mới"><RefreshCw className={loading ? 'animate-spin' : ''} size={18} /></button>
          </div>
        </div>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <PackageOpen className="text-rose-500" size={34} />
            <p className="mt-4 text-sm font-semibold text-slate-700">{error}</p>
            <button className="btn-secondary mt-5" type="button" onClick={() => loadProducts()}><RefreshCw size={17} /> Thử lại</button>
          </div>
        ) : loading ? (
          <div className="p-5"><Loading rows={6} /></div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
            description={products.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Thêm sản phẩm đầu tiên để bắt đầu bán hàng.'}
            action={!products.length && canManageProducts && <button className="btn-primary" type="button" onClick={openCreate}><Plus size={17} /> Thêm sản phẩm</button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] border-collapse text-left">
                <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3.5">Sản phẩm</th><th className="px-4 py-3.5">Mã / SKU</th><th className="px-4 py-3.5">Nhóm</th><th className="px-4 py-3.5 text-right">Giá bán</th><th className="px-4 py-3.5 text-right">Tồn kho</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {productPages.pageItems.map((product) => <ProductRow key={product.id} product={product} canManage={canManageProducts} canDelete={canDeleteProducts} onEdit={() => openEdit(product)} onDeactivate={() => setDeactivatingProduct(product)} onReactivate={() => reactivate(product)} onDelete={() => setDeletingProduct(product)} />)}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 lg:hidden">
              {productPages.pageItems.map((product) => <ProductCard key={product.id} product={product} canManage={canManageProducts} canDelete={canDeleteProducts} onEdit={() => openEdit(product)} onDeactivate={() => setDeactivatingProduct(product)} onReactivate={() => reactivate(product)} onDelete={() => setDeletingProduct(product)} />)}
            </div>
            <Pagination page={productPages.page} pageCount={productPages.pageCount} pageSize={productPages.pageSize} total={filteredProducts.length} onChange={productPages.setPage} />
          </>
        )}
      </section>

      <ProductForm open={formOpen} product={editingProduct} businessId={businessId} onClose={() => setFormOpen(false)} onSave={saveProduct} />
      <ConfirmDialog open={Boolean(deactivatingProduct)} onClose={() => setDeactivatingProduct(null)} onConfirm={confirmDeactivate} loading={deactivating} title="Ngừng kinh doanh sản phẩm?" description={deactivatingProduct ? `“${deactivatingProduct.name}” sẽ không còn xuất hiện trong danh sách bán hàng.` : ''} confirmLabel="Ngừng kinh doanh" />
      <ConfirmDialog open={Boolean(deletingProduct)} onClose={() => setDeletingProduct(null)} onConfirm={confirmDelete} loading={deleting} title="Xóa vĩnh viễn sản phẩm?" description={deletingProduct ? `“${deletingProduct.name}” sẽ bị xóa khỏi danh mục.` : ''} confirmLabel="Xóa sản phẩm" message="Chỉ sản phẩm chưa phát sinh giao dịch mới có thể xóa. Thao tác này không thể hoàn tác." />
    </div>
  )
}

const metricTones = {
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-50 text-amber-600',
}

function MiniMetric({ icon: Icon, label, value, tone }) {
  return (
    <article className="surface flex items-center gap-3 p-4 sm:p-5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${metricTones[tone]}`}><Icon size={20} /></span>
      <div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{formatNumber(value)}</p></div>
    </article>
  )
}

function ProductRow({ product, canManage, canDelete, onEdit, onDeactivate, onReactivate, onDelete }) {
  const stockState = getStockState(product)
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-4"><div className="flex items-center gap-3"><ProductImage product={product} /><div className="min-w-0"><p className="max-w-64 truncate text-sm font-bold text-slate-800">{product.name}</p><p className="mt-1 text-xs text-slate-400">{product.product_type === 'service' ? 'Dịch vụ' : product.unit}</p></div></div></td>
      <td className="px-4 py-4"><p className="text-sm font-semibold text-slate-700">{product.code || '—'}</p><p className="mt-1 text-xs text-slate-400">{product.sku || product.barcode || 'Chưa có SKU'}</p></td>
      <td className="px-4 py-4 text-sm text-slate-600">{product.category || 'Chưa phân nhóm'}</td>
      <td className="px-4 py-4 text-right text-sm font-bold text-slate-800">{formatCurrency(product.sale_price)}</td>
      <td className="px-4 py-4 text-right"><p className="text-sm font-bold text-slate-800">{product.product_type === 'service' ? '—' : formatNumber(product.stock_on_hand)}</p>{product.product_type !== 'service' && <p className="mt-1 text-xs text-slate-400">Tối thiểu {formatNumber(product.min_stock)}</p>}</td>
      <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stockState.className}`}>{stockState.label}</span></td>
      <td className="px-5 py-4">{canManage && <div className="flex justify-end gap-1"><button className="btn-icon" type="button" onClick={onEdit} aria-label={`Sửa ${product.name}`}><Edit3 size={17} /></button>{product.active ? <button className="btn-icon text-amber-600 hover:bg-amber-50" type="button" onClick={onDeactivate} aria-label={`Ngừng kinh doanh ${product.name}`}><Archive size={17} /></button> : <button className="btn-icon text-emerald-600 hover:bg-emerald-50" type="button" onClick={onReactivate} aria-label={`Kích hoạt ${product.name}`}><ArchiveRestore size={17} /></button>}{canDelete && <button className="btn-icon text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label={`Xóa ${product.name}`}><Trash2 size={17} /></button>}</div>}</td>
    </tr>
  )
}

function ProductCard({ product, canManage, canDelete, onEdit, onDeactivate, onReactivate, onDelete }) {
  const stockState = getStockState(product)
  return (
    <article className="p-4">
      <div className="flex items-start gap-3"><ProductImage product={product} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900">{product.name}</h2><p className="mt-1 truncate text-xs text-slate-400">{product.code || product.sku || 'Chưa có mã'} · {product.category || 'Chưa phân nhóm'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${stockState.className}`}>{stockState.label}</span></div></div></div>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[11px] font-medium text-slate-400">Giá bán</p><p className="mt-1 text-sm font-extrabold text-slate-800">{formatCurrency(product.sale_price)}</p></div><div className="text-right"><p className="text-[11px] font-medium text-slate-400">Tồn kho</p><p className="mt-1 text-sm font-extrabold text-slate-800">{product.product_type === 'service' ? 'Không theo dõi' : `${formatNumber(product.stock_on_hand)} ${product.unit}`}</p></div></div>
      {product.barcode && <p className="mt-3 flex items-center gap-2 text-xs text-slate-400"><Barcode size={15} /> {product.barcode}</p>}
      {canManage && <div className="mt-3 flex gap-2"><button className="btn-secondary flex-1" type="button" onClick={onEdit}><Edit3 size={16} /> Chỉnh sửa</button>{product.active ? <button className="btn-icon text-amber-600" type="button" onClick={onDeactivate} aria-label="Ngừng kinh doanh"><Archive size={17} /></button> : <button className="btn-icon text-emerald-600" type="button" onClick={onReactivate} aria-label="Kích hoạt lại"><ArchiveRestore size={17} /></button>}{canDelete && <button className="btn-icon text-rose-600" type="button" onClick={onDelete} aria-label="Xóa sản phẩm"><Trash2 size={17} /></button>}</div>}
    </article>
  )
}
