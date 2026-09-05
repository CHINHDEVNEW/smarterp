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
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch justify-around border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,.06)] backdrop-blur md:hidden">
      {visibleItems.slice(0, 2).map((item) => <MobileLink key={item.to} item={item} />)}
      {canUsePos && <button className="relative flex min-w-16 flex-col items-center justify-center text-slate-500" type="button" onClick={() => navigate('/pos')} aria-label="Tạo đơn bán hàng">
        <span className="absolute -top-4 grid size-12 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200 ring-4 ring-slate-50"><Plus size={25} /></span>
        <span className="mt-8 text-[10px] font-semibold">Tạo đơn</span>
      </button>}
      {visibleItems.slice(2, 4).map((item) => <MobileLink key={item.to} item={item} />)}
    </nav>
  )
}

function MobileLink({ item }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} className={({ isActive }) => `flex min-w-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isActive ? 'text-sky-600' : 'text-slate-400'}`}>
      <Icon size={20} />
      <span>{item.label}</span>
    </NavLink>
  )
}
