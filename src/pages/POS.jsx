/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, CircleDollarSign, Minus, Package, Plus, RefreshCw, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { listProducts } from '../services/productService'
import { listCustomersWithSummary } from '../services/customerService'
import { createPosSale } from '../services/salesService'
import { listFinanceAccounts } from '../services/financeService'
import { formatCurrency, formatNumber, localDateKey } from '../lib/formatters'

export default function POS() {
  const { businessId, settings } = useBusiness()
  const defaultVat = Number(settings?.default_vat) || 0
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError('')
    try {
      const [productRows, customerRows, accountRows] = await Promise.all([listProducts(businessId), listCustomersWithSummary(businessId), listFinanceAccounts(businessId)])
      setProducts(productRows.filter((product) => product.active))
      setCustomers(customerRows.filter((customer) => customer.active))
      setAccounts(accountRows)
      setAccountId((current) => current || accountRows[0]?.id || '')
    } catch (loadError) {
      console.error(loadError)
      setError('Không tải được dữ liệu bán hàng nhanh. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [products])
  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi')
    return products.filter((product) => {
      if (category !== 'all' && product.category !== category) return false
      if (!needle) return true
      return [product.name, product.code, product.sku, product.barcode].some((value) => String(value ?? '').toLocaleLowerCase('vi').includes(needle))
    })
  }, [products, search, category])
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0), [cart])
  const vatAmount = subtotal * defaultVat / 100
  const total = subtotal + vatAmount

  function addToCart(product) {
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id)
      if (existing) return current.map((item) => item.product_id === product.id ? { ...item, quantity: Number(item.quantity) + 1 } : item)
      return [...current, { product_id: product.id, name: product.name, code: product.code, unit: product.unit, product_type: product.product_type, stock_on_hand: product.stock_on_hand, quantity: 1, unit_price: Number(product.sale_price) || 0 }]
    })
  }

  function updateQuantity(productId, quantity) {
    setCart((current) => current.map((item) => item.product_id === productId ? { ...item, quantity: Math.max(0.001, Number(quantity) || 0) } : item))
  }

  function removeFromCart(productId) {
    setCart((current) => current.filter((item) => item.product_id !== productId))
  }

  async function checkout() {
    if (!cart.length || saving) return
    if (!accountId) {
      setError('Vui lòng chọn tài khoản nhận tiền trước khi thanh toán.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const created = await createPosSale(
        businessId,
        { customer_id: customerId || null, order_date: localDateKey(), due_date: null, discount: 0, shipping_fee: 0, vat_rate: defaultVat, note: null, channel: 'pos' },
        cart.map((item) => ({ product_id: item.product_id, quantity: Number(item.quantity), unit_price: Number(item.unit_price), note: null })),
        { accountId, paymentMethod },
      )
      showToast(`Đã thanh toán đơn ${created?.code || ''}.`)
      setCart([])
      setCustomerId('')
      await loadData()
    } catch (checkoutError) {
      console.error(checkoutError)
      setError(checkoutError.message || 'Không thể tạo đơn bán.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="-m-4 min-h-[calc(100dvh-5rem)] bg-slate-100 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="page-eyebrow">Quầy bán hàng</p><h1 className="page-title">Bán hàng nhanh</h1><p className="page-description">Chọn sản phẩm, kiểm tra giỏ hàng và tạo đơn trong vài thao tác.</p></div><button className="btn-secondary self-start" type="button" onClick={loadData} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} size={17} /> Làm mới</button></div>
      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="field pl-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, mã hoặc barcode..." autoFocus /></div><select className="field sm:w-44" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tất cả nhóm hàng</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
          {loading ? <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4"><ProductSkeleton count={8} /></div> : filteredProducts.length === 0 ? <div className="p-12 text-center"><Package className="mx-auto text-slate-300" size={40} /><p className="mt-4 text-sm font-semibold text-slate-600">Không tìm thấy sản phẩm</p><p className="mt-1 text-xs text-slate-400">Thử từ khóa hoặc nhóm hàng khác.</p></div> : <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">{filteredProducts.map((product) => <ProductTile key={product.id} product={product} onAdd={() => addToCart(product)} />)}</div>}
        </section>

        <aside className="surface overflow-hidden xl:sticky xl:top-6"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><ShoppingBag size={18} /></span><div><h2 className="text-sm font-extrabold text-slate-900">Đơn hàng hiện tại</h2><p className="text-xs text-slate-400">{formatNumber(cart.length)} mặt hàng</p></div></div>{cart.length > 0 && <button className="text-xs font-bold text-rose-500 hover:text-rose-700" type="button" onClick={() => setCart([])}>Xóa hết</button>}</div><div className="max-h-[45dvh] min-h-40 overflow-y-auto p-3 sm:max-h-[50dvh]">{cart.length === 0 ? <div className="grid min-h-36 place-items-center px-6 text-center"><ShoppingBag className="text-slate-200" size={34} /><p className="mt-3 text-xs font-semibold text-slate-400">Chưa có sản phẩm<br />Chọn sản phẩm để thêm vào đơn.</p></div> : <div className="space-y-2">{cart.map((item) => <CartItem key={item.product_id} item={item} onChange={(value) => updateQuantity(item.product_id, value)} onRemove={() => removeFromCart(item.product_id)} />)}</div>}</div><div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5"><label className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-600"><UserRound size={15} /> Khách hàng</span><select className="field bg-white" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Khách lẻ</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-2"><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Tài khoản nhận</span><select className="field bg-white" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Chọn tài khoản</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Phương thức</span><select className="field bg-white" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="cash">Tiền mặt</option><option value="bank">Chuyển khoản</option><option value="card">Thẻ</option><option value="other">Khác</option></select></label></div><div className="mt-4 space-y-2 text-sm"><div className="flex items-center justify-between"><span className="font-semibold text-slate-500">Tạm tính</span><span className="font-extrabold text-slate-900">{formatCurrency(subtotal)}</span></div>{defaultVat > 0 && <div className="flex items-center justify-between text-xs text-slate-500"><span>VAT ({defaultVat}%)</span><span>{formatCurrency(vatAmount)}</span></div>}<div className="flex items-center justify-between border-t border-slate-200 pt-2"><span className="font-bold text-slate-700">Tổng thanh toán</span><span className="font-extrabold text-slate-900">{formatCurrency(total)}</span></div></div><p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-400"><CircleDollarSign className="mt-0.5 shrink-0" size={14} />Đơn, thu tiền và xuất kho được ghi nhận cùng lúc. Nếu một bước lỗi, toàn bộ giao dịch sẽ được hoàn tác.</p><button className="btn-primary mt-4 w-full py-3.5" type="button" onClick={checkout} disabled={!cart.length || saving || !accountId}>{saving ? 'Đang thanh toán...' : 'Thanh toán và hoàn tất'} <ChevronRight size={17} /></button></div></aside>
      </div>
    </div>
  )
}

function ProductTile({ product, onAdd }) {
  const outOfStock = product.product_type !== 'service' && Number(product.stock_on_hand) <= 0
  return <button className="group rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={onAdd} disabled={outOfStock}><div className="grid aspect-square place-items-center rounded-xl bg-gradient-to-br from-sky-50 via-white to-emerald-50 text-sky-500"><Package size={30} strokeWidth={1.5} /></div><p className="mt-3 truncate text-sm font-bold text-slate-800">{product.name}</p><p className="mt-1 truncate text-xs text-slate-400">{product.code || product.unit}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-sm font-extrabold text-sky-700">{formatCurrency(product.sale_price)}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${product.product_type === 'service' ? 'bg-sky-50 text-sky-600' : outOfStock ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{product.product_type === 'service' ? 'DV' : outOfStock ? 'Hết' : `Tồn ${formatNumber(product.stock_on_hand)}`}</span></div></button>
}

function CartItem({ item, onChange, onRemove }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.name}</p><p className="mt-1 text-xs text-slate-400">{formatCurrency(item.unit_price)} / {item.unit}</p></div><button className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" type="button" onClick={onRemove} aria-label={`Xóa ${item.name}`}><X size={15} /></button></div><div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center"><button className="grid size-8 place-items-center rounded-l-lg border border-slate-200 text-slate-500 hover:bg-slate-50" type="button" onClick={() => onChange(Number(item.quantity) - 1)}><Minus size={14} /></button><input className="h-8 w-14 border-y border-slate-200 text-center text-xs font-bold outline-none" type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => onChange(event.target.value)} /><button className="grid size-8 place-items-center rounded-r-lg border border-slate-200 text-slate-500 hover:bg-slate-50" type="button" onClick={() => onChange(Number(item.quantity) + 1)}><Plus size={14} /></button></div><p className="text-sm font-extrabold text-slate-900">{formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</p></div></div>
}

function ProductSkeleton({ count }) {
  return Array.from({ length: count }, (_, index) => <div className="animate-pulse rounded-2xl border border-slate-100 p-3" key={index}><div className="aspect-square rounded-xl bg-slate-100" /><div className="mt-3 h-3 rounded bg-slate-100" /><div className="mt-2 h-3 w-2/3 rounded bg-slate-100" /></div>)
}
