/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Landmark,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
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
    if (!cart.length || saving) return false
    if (!accountId) {
      setError('Vui lòng chọn tài khoản nhận tiền trước khi thanh toán.')
      return false
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
      return true
    } catch (checkoutError) {
      console.error(checkoutError)
      setError(checkoutError.message || 'Không thể tạo đơn bán.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-3 py-0.5 text-[11px] font-black text-white shadow-sm shadow-sky-500/20">
              <Zap size={13} className="fill-white" /> SmartPOS
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sẵn sàng bán hàng
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Bán hàng nhanh</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Chọn sản phẩm, điều chỉnh số lượng và thanh toán tự động ghi nhận vào kho & sổ quỹ.
          </p>
        </div>
        <button
          className="btn-secondary self-start sm:self-auto"
          type="button"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} /> Làm mới
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          <span>{error}</span>
          <button
            className="text-xs font-bold text-rose-600 underline"
            type="button"
            onClick={() => setError('')}
          >
            Đóng
          </button>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left Column: Products catalog */}
        <section className="surface overflow-hidden">
          <div className="border-b border-slate-100 p-4 space-y-3 sm:p-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="field pl-10 pr-9 text-sm placeholder:text-slate-400"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm sản phẩm, mã SKU hoặc barcode..."
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 font-bold transition duration-150 ${
                  category === 'all'
                    ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                Tất cả ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 rounded-xl px-3.5 py-1.5 font-bold transition duration-150 ${
                    category === cat
                      ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-md shadow-sky-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 sm:p-5">
              <ProductSkeleton count={8} />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto text-slate-300" size={42} />
              <p className="mt-4 text-sm font-bold text-slate-700">
                Không tìm thấy sản phẩm
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Thử tìm bằng từ khóa hoặc chọn nhóm hàng khác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 sm:p-5">
              {filteredProducts.map((product) => {
                const cartQty = cart.find((i) => i.product_id === product.id)?.quantity
                return (
                  <ProductTile
                    key={product.id}
                    product={product}
                    cartQty={cartQty}
                    onAdd={() => addToCart(product)}
                  />
                )
              })}
            </div>
          )}
        </section>

        {/* Right Column: Desktop Cart & Checkout */}
        <aside className="surface hidden overflow-hidden xl:sticky xl:top-20 xl:block">
          <CartContent
            cart={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            onClear={() => setCart([])}
            customerId={customerId}
            onCustomerChange={setCustomerId}
            customers={customers}
            accountId={accountId}
            onAccountChange={setAccountId}
            accounts={accounts}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            subtotal={subtotal}
            defaultVat={defaultVat}
            vatAmount={vatAmount}
            total={total}
            saving={saving}
            onCheckout={checkout}
          />
        </aside>
      </div>

      {/* Mobile Floating Cart Summary Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-[calc(4.4rem+env(safe-area-inset-bottom))] inset-x-3 z-30 xl:hidden">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3.5 text-white shadow-xl ring-2 ring-white active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-sky-500 text-white font-bold text-xs">
                {cart.length}
              </span>
              <div className="text-left">
                <p className="text-xs text-slate-300 font-medium">Giỏ hàng</p>
                <p className="tabular-nums text-sm font-bold text-white">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-400">
              Thanh toán <ChevronRight size={16} />
            </span>
          </button>
        </div>
      )}

      {/* Mobile Cart Modal Sheet */}
      {mobileCartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-xs xl:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0"
            onClick={() => setMobileCartOpen(false)}
          />
          <div className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-slate-200 bg-white shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-base font-bold text-slate-900">
                Đơn hàng ({cart.length})
              </h2>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <CartContent
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                onClear={() => setCart([])}
                customerId={customerId}
                onCustomerChange={setCustomerId}
                customers={customers}
                accountId={accountId}
                onAccountChange={setAccountId}
                accounts={accounts}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                subtotal={subtotal}
                defaultVat={defaultVat}
                vatAmount={vatAmount}
                total={total}
                saving={saving}
                onCheckout={async () => {
                  const succeeded = await checkout()
                  if (succeeded) setMobileCartOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CartContent({
  cart,
  onUpdateQuantity,
  onRemove,
  onClear,
  customerId,
  onCustomerChange,
  customers,
  accountId,
  onAccountChange,
  accounts,
  paymentMethod,
  onPaymentMethodChange,
  subtotal,
  defaultVat,
  vatAmount,
  total,
  saving,
  onCheckout,
}) {
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-cyan-400" />
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-500/20">
            <ShoppingBag size={18} />
          </span>
          <div>
            <h2 className="text-sm font-black text-slate-900">Giỏ thanh toán</h2>
            <p className="text-[11px] font-semibold text-slate-400">
              {formatNumber(cart.length)} mặt hàng đã chọn
            </p>
          </div>
        </div>
        {cart.length > 0 && (
          <button
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 transition hover:text-rose-700 hover:underline"
            type="button"
            onClick={onClear}
          >
            <Trash2 size={13} /> Xóa hết
          </button>
        )}
      </div>

      <div className="max-h-[34dvh] min-h-36 overflow-y-auto p-3 sm:max-h-[38dvh]">
        {cart.length === 0 ? (
          <div className="grid min-h-36 place-items-center px-4 py-8 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 ring-8 ring-slate-100/50">
              <ShoppingBag size={22} />
            </div>
            <p className="mt-3 text-xs font-bold text-slate-600">
              Giỏ hàng đang trống
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Nhấp vào sản phẩm ở bảng bên trái để thêm vào đơn.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item) => (
              <CartItem
                key={item.product_id}
                item={item}
                onChange={(value) => onUpdateQuantity(item.product_id, value)}
                onRemove={() => onRemove(item.product_id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/80 p-4 space-y-3 sm:p-5">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <UserRound size={14} className="text-slate-400" /> Khách hàng
          </span>
          <select
            className="field bg-white"
            value={customerId}
            onChange={(event) => onCustomerChange(event.target.value)}
          >
            <option value="">Khách lẻ (Khách vãng lai)</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.phone ? `(${customer.phone})` : ''}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1.5 block text-xs font-bold text-slate-700">
            Hình thức thanh toán
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onPaymentMethodChange('cash')}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-bold transition duration-150 ${
                paymentMethod === 'cash'
                  ? 'bg-sky-50 border-2 border-sky-600 text-sky-700 shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Banknote size={17} className={paymentMethod === 'cash' ? 'text-sky-600' : 'text-slate-400'} />
              <span>Tiền mặt</span>
            </button>
            <button
              type="button"
              onClick={() => onPaymentMethodChange('bank')}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-bold transition duration-150 ${
                paymentMethod === 'bank'
                  ? 'bg-sky-50 border-2 border-sky-600 text-sky-700 shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Landmark size={17} className={paymentMethod === 'bank' ? 'text-sky-600' : 'text-slate-400'} />
              <span>Chuyển khoản</span>
            </button>
            <button
              type="button"
              onClick={() => onPaymentMethodChange('card')}
              className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-bold transition duration-150 ${
                paymentMethod === 'card'
                  ? 'bg-sky-50 border-2 border-sky-600 text-sky-700 shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard size={17} className={paymentMethod === 'card' ? 'text-sky-600' : 'text-slate-400'} />
              <span>Thẻ / POS</span>
            </button>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Wallet size={14} className="text-slate-400" /> Tài khoản ghi nhận tiền <span className="text-rose-500">*</span>
          </span>
          <select
            className="field bg-white"
            value={accountId}
            onChange={(event) => onAccountChange(event.target.value)}
            required
          >
            <option value="">Chọn tài khoản thu</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.account_type === 'bank' ? 'Ngân hàng' : 'Tiền mặt'})
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 space-y-2 text-xs sm:text-sm shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span>Tạm tính ({cart.length} món)</span>
            <span className="tabular-nums font-bold text-slate-800">
              {formatCurrency(subtotal)}
            </span>
          </div>
          {defaultVat > 0 && (
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span>VAT ({defaultVat}%)</span>
              <span className="tabular-nums font-bold">{formatCurrency(vatAmount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-slate-200 pt-2.5">
            <div>
              <span className="text-sm font-black text-slate-900">Tổng thanh toán</span>
              <p className="text-[10px] text-slate-400 font-medium">Tự động trừ kho & sổ quỹ</p>
            </div>
            <span className="tabular-nums font-black text-2xl text-sky-700">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <button
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-base font-black text-white shadow-lg shadow-emerald-600/25 transition duration-150 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          type="button"
          onClick={onCheckout}
          disabled={!cart.length || saving || !accountId}
        >
          {saving ? (
            <>
              <RefreshCw className="animate-spin" size={18} /> Đang thanh toán...
            </>
          ) : (
            <>
              <CheckCircle2 size={19} /> Thanh toán · {formatCurrency(total)}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ProductTile({ product, cartQty, onAdd }) {
  const outOfStock = product.product_type !== 'service' && Number(product.stock_on_hand) <= 0
  const isService = product.product_type === 'service'
  const isLowStock = !isService && !outOfStock && Number(product.stock_on_hand) <= Number(product.min_stock)

  return (
    <button
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-3 text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      type="button"
      onClick={onAdd}
      disabled={outOfStock}
    >
      {cartQty > 0 && (
        <span className="tabular-nums absolute -right-1.5 -top-1.5 z-10 grid size-6.5 place-items-center rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 text-xs font-black text-white shadow-md shadow-sky-500/30 ring-2 ring-white">
          {cartQty}
        </span>
      )}

      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-50 to-slate-100 text-slate-300">
              <Package size={34} strokeWidth={1.5} />
            </div>
          )}
        </div>

        <p className="mt-2.5 line-clamp-2 text-sm font-bold text-slate-800 transition group-hover:text-sky-600">
          {product.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
          {product.code || product.unit}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
        <span className="tabular-nums truncate text-sm sm:text-base font-black text-sky-700">
          {formatCurrency(product.sale_price)}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            isService
              ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200/50'
              : outOfStock
              ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/50'
              : isLowStock
              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/50'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50'
          }`}
        >
          {isService
            ? 'Dịch vụ'
            : outOfStock
            ? 'Hết hàng'
            : isLowStock
            ? `Tồn: ${formatNumber(product.stock_on_hand)}`
            : `Tồn: ${formatNumber(product.stock_on_hand)}`}
        </span>
      </div>
    </button>
  )
}

function CartItem({ item, onChange, onRemove }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-xs transition hover:border-slate-300">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-slate-800">{item.name}</p>
          <p className="tabular-nums mt-0.5 text-[11px] text-slate-400 font-medium">
            {formatCurrency(item.unit_price)} / {item.unit}
          </p>
        </div>
        <button
          className="grid size-6.5 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
          type="button"
          onClick={onRemove}
          aria-label={`Xóa ${item.name}`}
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
          <button
            className="grid size-7 place-items-center text-slate-500 hover:bg-white hover:text-slate-800 rounded-l-lg transition"
            type="button"
            onClick={() => onChange(Number(item.quantity) - 1)}
            aria-label="Giảm số lượng"
          >
            <Minus size={13} />
          </button>
          <input
            className="tabular-nums h-7 w-12 bg-transparent text-center text-xs font-black text-slate-800 outline-none"
            type="number"
            min="0.001"
            step="0.001"
            value={item.quantity}
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            className="grid size-7 place-items-center text-slate-500 hover:bg-white hover:text-slate-800 rounded-r-lg transition"
            type="button"
            onClick={() => onChange(Number(item.quantity) + 1)}
            aria-label="Tăng số lượng"
          >
            <Plus size={13} />
          </button>
        </div>

        <p className="tabular-nums text-xs font-black text-slate-900 sm:text-sm">
          {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
        </p>
      </div>
    </div>
  )
}

function ProductSkeleton({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <div
      className="animate-shimmer rounded-2xl border border-slate-100 bg-white p-3 space-y-2.5"
      key={index}
    >
      <div className="aspect-square rounded-xl bg-slate-100" />
      <div className="h-3.5 w-3/4 rounded bg-slate-100" />
      <div className="h-3 w-1/2 rounded bg-slate-100" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
    </div>
  ))
}
