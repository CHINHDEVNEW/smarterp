import { LayoutDashboard, Package, Plus, ReceiptText, WalletCards } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import useBusiness from '../../hooks/useBusiness'
import { canAccess } from '../../lib/permissions'

const items = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, permission: 'dashboard' },
  { to: '/sales', label: 'Bán hàng', icon: ReceiptText, permission: 'sales' },
  { to: '/products', label: 'Sản phẩm', icon: Package, permission: 'products' },
  { to: '/finance', label: 'Tài chính', icon: WalletCards, permission: 'finance' },
]

export default function MobileNav() {
  const navigate = useNavigate()
  const { business } = useBusiness()
  const visibleItems = items.filter((item) => canAccess(business?.role, item.permission))
  const canUsePos = canAccess(business?.role, 'pos')

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4.2rem+env(safe-area-inset-bottom))] items-stretch justify-around border-t border-slate-200/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-md md:hidden">
      {visibleItems.slice(0, 2).map((item) => (
        <MobileLink key={item.to} item={item} />
      ))}
      {canUsePos && (
        <button
          className="relative flex min-w-16 flex-col items-center justify-center text-slate-500"
          type="button"
          onClick={() => navigate('/pos')}
          aria-label="Tạo đơn bán hàng nhanh"
        >
          <span className="absolute -top-4 grid size-12 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-md shadow-sky-500/30 ring-4 ring-white transition active:scale-95">
            <Plus size={24} strokeWidth={2.4} />
          </span>
          <span className="mt-8 text-[10px] font-bold text-slate-600">POS</span>
        </button>
      )}
      {visibleItems.slice(2, 4).map((item) => (
        <MobileLink key={item.to} item={item} />
      ))}
    </nav>
  )
}

function MobileLink({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex min-w-16 flex-col items-center justify-center gap-1 py-1 text-[10px] font-semibold transition ${
          isActive
            ? 'text-sky-600 font-bold'
            : 'text-slate-400 hover:text-slate-600'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`grid size-8 place-items-center rounded-xl transition ${
              isActive ? 'bg-sky-50 text-sky-600' : 'text-slate-400'
            }`}
          >
            <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
          </span>
          <span className="leading-none">{item.label}</span>
          {isActive && <span className="size-1 rounded-full bg-sky-600 -mt-0.5" />}
        </>
      )}
    </NavLink>
  )
}
