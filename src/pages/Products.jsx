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
import PageHeader from '../components/common/PageHeader'
import MetricCard from '../components/common/MetricCard'
import FilterBar from '../components/common/FilterBar'
import ProductForm from '../components/products/ProductForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Loading from '../components/common/Loading'
import useToast from '../hooks/useToast'
import usePagination from '../hooks/usePagination'
import Pagination from '../components/common/Pagination'
import { canAccess } from '../lib/permissions'
import { removeProductImageByUrl } from '../services/productImageService'
import { formDraftKey, hasFormDraft } from '../lib/formDraft'

function getStockState(product) {
  if (!product.active) return { label: 'Ngừng bán', className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' }
  if (product.product_type === 'service') return { label: 'Dịch vụ', className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/60' }
  const stock = Number(product.stock_on_hand) || 0
  const min = Number(product.min_stock) || 0
  if (stock <= 0) return { label: 'Hết hàng', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60' }
  if (stock <= min) return { label: 'Sắp hết', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60' }
  return { label: 'Còn hàng', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60' }
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false)
  if (!product.image_url || failed) {
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/80 text-slate-400 ring-1 ring-slate-200/60">
        <Package size={20} />
      </span>
    )
  }
  return (
    <img
      className="size-11 shrink-0 rounded-xl border border-slate-200/80 object-cover shadow-xs"
      src={product.image_url}
      alt=""
      onError={() => setFailed(true)}
    />
  )
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

  useEffect(() => {
    if (businessId && hasFormDraft(formDraftKey(businessId, 'product-new'))) {
      setEditingProduct(null)
      setFormOpen(true)
    }
  }, [businessId])

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return products.filter((product) => {
      if (status === 'active' && !product.active) return false
      if (status === 'inactive' && product.active) return false
      if (status === 'low_stock' && (!product.active || product.product_type === 'service' || Number(product.stock_on_hand) > Number(product.min_stock))) return false
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Danh mục hàng hóa"
        title="Sản phẩm"
        description="Quản lý hàng hóa, dịch vụ, giá bán niêm yết và định mức tồn kho."
        actions={
          canManageProducts && (
            <button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>
              <Plus size={16} /> Thêm sản phẩm
            </button>
          )
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard icon={Boxes} label="Tổng sản phẩm" value={formatNumber(stats.total)} tone="sky" />
        <MetricCard icon={CircleDollarSign} label="Đang kinh doanh" value={formatNumber(stats.active)} tone="emerald" />
        <MetricCard icon={Archive} label="Ngừng kinh doanh" value={formatNumber(stats.inactive)} tone="slate" />
        <MetricCard icon={PackageOpen} label="Tồn kho thấp" value={formatNumber(stats.lowStock)} tone="amber" />
      </section>

      <section className="surface overflow-hidden">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Tìm theo tên, mã SKU hoặc barcode..."
          onRefresh={() => loadProducts()}
          loading={loading}
        >
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/90 p-1 ring-1 ring-slate-200/50">
            <button
              type="button"
              onClick={() => setStatus('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Đang bán</span>
              {stats.active > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${status === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {stats.active}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatus('low_stock')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'low_stock'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tồn thấp</span>
              {stats.lowStock > 0 && (
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${status === 'low_stock' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {stats.lowStock}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatus('inactive')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                status === 'inactive'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ngừng bán
            </button>
          </div>
        </FilterBar>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <PackageOpen className="text-rose-500" size={32} />
            <p className="mt-3 text-sm font-semibold text-slate-700">{error}</p>
            <button className="btn-secondary mt-4" type="button" onClick={() => loadProducts()}>
              <RefreshCw size={16} /> Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="p-5"><Loading rows={6} /></div>
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}
            description={products.length ? 'Hãy thử từ khóa hoặc bộ lọc khác.' : 'Thêm sản phẩm đầu tiên để bắt đầu bán hàng.'}
            action={!products.length && canManageProducts && <button className="btn-primary" type="button" onClick={openCreate}><Plus size={16} /> Thêm sản phẩm</button>}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3.5">Sản phẩm</th>
                    <th className="px-4 py-3.5">Mã / SKU</th>
                    <th className="px-4 py-3.5">Nhóm</th>
                    <th className="px-4 py-3.5 text-right">Giá bán</th>
                    <th className="px-4 py-3.5 text-right">Tồn kho</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productPages.pageItems.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      canManage={canManageProducts}
                      canDelete={canDeleteProducts}
                      onEdit={() => openEdit(product)}
                      onDeactivate={() => setDeactivatingProduct(product)}
                      onReactivate={() => reactivate(product)}
                      onDelete={() => setDeletingProduct(product)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {productPages.pageItems.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  canManage={canManageProducts}
                  canDelete={canDeleteProducts}
                  onEdit={() => openEdit(product)}
                  onDeactivate={() => setDeactivatingProduct(product)}
                  onReactivate={() => reactivate(product)}
                  onDelete={() => setDeletingProduct(product)}
                />
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

      <ProductForm open={formOpen} product={editingProduct} businessId={businessId} onClose={() => setFormOpen(false)} onSave={saveProduct} />
      <ConfirmDialog open={Boolean(deactivatingProduct)} onClose={() => setDeactivatingProduct(null)} onConfirm={confirmDeactivate} loading={deactivating} title="Ngừng kinh doanh sản phẩm?" description={deactivatingProduct ? `“${deactivatingProduct.name}” sẽ không còn xuất hiện trong danh sách bán hàng.` : ''} confirmLabel="Ngừng kinh doanh" />
      <ConfirmDialog open={Boolean(deletingProduct)} onClose={() => setDeletingProduct(null)} onConfirm={confirmDelete} loading={deleting} title="Xóa vĩnh viễn sản phẩm?" description={deletingProduct ? `“${deletingProduct.name}” sẽ bị xóa khỏi danh mục.` : ''} confirmLabel="Xóa sản phẩm" message="Chỉ sản phẩm chưa phát sinh giao dịch mới có thể xóa. Thao tác này không thể hoàn tác." />
    </div>
  )
}

function ProductRow({ product, canManage, canDelete, onEdit, onDeactivate, onReactivate, onDelete }) {
  const stockState = getStockState(product)
  return (
    <tr className="transition hover:bg-slate-50/70">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <ProductImage product={product} />
          <div className="min-w-0">
            <p className="max-w-64 truncate text-sm font-bold text-slate-800">{product.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{product.product_type === 'service' ? 'Dịch vụ' : product.unit}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-xs font-semibold text-slate-700">{product.code || '—'}</p>
        <p className="mt-0.5 text-xs text-slate-400">{product.sku || product.barcode || 'Chưa có SKU'}</p>
      </td>
      <td className="px-4 py-3.5 text-xs text-slate-600">{product.category || 'Chưa phân nhóm'}</td>
      <td className="tabular-nums px-4 py-3.5 text-right text-sm font-bold text-slate-900">{formatCurrency(product.sale_price)}</td>
      <td className="px-4 py-3.5 text-right">
        <p className="tabular-nums text-sm font-bold text-slate-900">
          {product.product_type === 'service' ? '—' : formatNumber(product.stock_on_hand)}
        </p>
        {product.product_type !== 'service' && (
          <p className="tabular-nums mt-0.5 text-[11px] text-slate-400">Tối thiểu {formatNumber(product.min_stock)}</p>
        )}
      </td>
      <td className="px-4 py-3.5">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${stockState.className}`}>
          {stockState.label}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        {canManage && (
          <div className="flex justify-end gap-1">
            <button className="btn-icon" type="button" onClick={onEdit} aria-label={`Sửa ${product.name}`} title="Chỉnh sửa">
              <Edit3 size={16} />
            </button>
            {product.active ? (
              <button className="btn-icon text-amber-600 hover:bg-amber-50" type="button" onClick={onDeactivate} aria-label={`Ngừng kinh doanh ${product.name}`} title="Ngừng kinh doanh">
                <Archive size={16} />
              </button>
            ) : (
              <button className="btn-icon text-emerald-600 hover:bg-emerald-50" type="button" onClick={onReactivate} aria-label={`Kích hoạt ${product.name}`} title="Kích hoạt lại">
                <ArchiveRestore size={16} />
              </button>
            )}
            {canDelete && (
              <button className="btn-icon text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label={`Xóa ${product.name}`} title="Xóa">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

function ProductCard({ product, canManage, canDelete, onEdit, onDeactivate, onReactivate, onDelete }) {
  const stockState = getStockState(product)
  return (
    <article className="p-4 transition hover:bg-slate-50/50">
      <div className="flex items-start gap-3">
        <ProductImage product={product} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-900">{product.name}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {product.code || product.sku || 'Chưa có mã'} · {product.category || 'Chưa phân nhóm'}
              </p>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${stockState.className}`}>
              {stockState.label}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50/80 p-2.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Giá bán</p>
          <p className="tabular-nums mt-0.5 text-sm font-extrabold text-slate-900">{formatCurrency(product.sale_price)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Tồn kho</p>
          <p className="tabular-nums mt-0.5 text-sm font-extrabold text-slate-900">
            {product.product_type === 'service' ? 'Không theo dõi' : `${formatNumber(product.stock_on_hand)} ${product.unit}`}
          </p>
        </div>
      </div>
      {product.barcode && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-400">
          <Barcode size={14} /> {product.barcode}
        </p>
      )}
      {canManage && (
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
          <button className="btn-secondary flex-1 min-h-9 text-xs" type="button" onClick={onEdit}>
            <Edit3 size={15} /> Chỉnh sửa
          </button>
          {product.active ? (
            <button className="btn-icon size-9 text-amber-600 hover:bg-amber-50" type="button" onClick={onDeactivate} aria-label="Ngừng kinh doanh" title="Ngừng kinh doanh">
              <Archive size={16} />
            </button>
          ) : (
            <button className="btn-icon size-9 text-emerald-600 hover:bg-emerald-50" type="button" onClick={onReactivate} aria-label="Kích hoạt lại" title="Kích hoạt lại">
              <ArchiveRestore size={16} />
            </button>
          )}
          {canDelete && (
            <button className="btn-icon size-9 text-rose-600 hover:bg-rose-50" type="button" onClick={onDelete} aria-label="Xóa sản phẩm" title="Xóa">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </article>
  )
}
