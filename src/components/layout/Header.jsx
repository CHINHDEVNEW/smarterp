import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, LogOut, Menu, PackagePlus, Search, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'
import useBusiness from '../../hooks/useBusiness'
import { supabase } from '../../lib/supabase'
import useToast from '../../hooks/useToast'

const pageNames = {
  '/dashboard': 'Tổng quan',
  '/products': 'Sản phẩm',
  '/customers': 'Khách hàng',
  '/sales': 'Bán hàng',
  '/pos': 'Bán hàng nhanh',
  '/purchases': 'Mua hàng',
  '/inventory': 'Kho hàng',
  '/finance': 'Tài chính',
  '/reports': 'Báo cáo',
  '/quotes': 'Báo giá',
  '/returns': 'Trả hàng',
  '/production': 'Sản xuất',
  '/settings': 'Cài đặt',
}

export default function Header({ onOpenSidebar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { business } = useBusiness()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    function closeProfile(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false)
    }
    document.addEventListener('pointerdown', closeProfile)
    return () => document.removeEventListener('pointerdown', closeProfile)
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    const normalized = query.trim()
    navigate(normalized ? `/products?q=${encodeURIComponent(normalized)}` : '/products')
  }

  async function logout() {
    setProfileOpen(false)
    const { error } = await supabase.auth.signOut()
    if (error) showToast('Không thể đăng xuất. Vui lòng thử lại.', 'error')
  }

  const initials = (business?.name || user?.email || 'SE')
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:h-[68px] sm:gap-4 sm:px-6">
      <button className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden" type="button" onClick={onOpenSidebar} aria-label="Mở menu"><Menu size={22} /></button>
      <div className="hidden min-w-28 lg:block">
        <p className="text-xs font-medium text-slate-400">Không gian làm việc</p>
        <p className="text-sm font-bold text-slate-800">{pageNames[location.pathname] ?? 'SmartERP'}</p>
      </div>
      <form className="relative min-w-0 flex-1 sm:max-w-md" onSubmit={handleSearch}>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm..." />
      </form>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button className="btn-primary hidden sm:flex" type="button" onClick={() => navigate('/products?new=1')}><PackagePlus size={18} /> Thêm sản phẩm</button>
        <button className="relative grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" type="button" onClick={() => showToast('Bạn chưa có thông báo mới.', 'info')} aria-label="Thông báo"><Bell size={20} /></button>
        <div className="relative" ref={profileRef}>
          <button className="flex h-10 items-center gap-2 rounded-xl pl-1 pr-2 hover:bg-slate-100" type="button" onClick={() => setProfileOpen((value) => !value)}>
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-xs font-bold text-white">{initials}</span>
            <ChevronDown className="hidden text-slate-400 sm:block" size={15} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="px-3 py-3">
                <p className="truncate text-sm font-bold text-slate-900">{business?.name ?? 'SmartERP'}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <div className="my-1 h-px bg-slate-100" />
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50" type="button" onClick={() => navigate('/settings')}><UserRound size={18} /> Hồ sơ và cài đặt</button>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50" type="button" onClick={logout}><LogOut size={18} /> Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
