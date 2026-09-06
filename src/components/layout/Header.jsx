import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PackagePlus,
  Search,
  UserRound,
  Zap,
} from 'lucide-react'
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
  const searchInputRef = useRef(null)

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
    <header className="sticky top-0 z-20 flex h-[calc(64px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] items-center gap-2.5 border-b border-slate-200/80 bg-white/90 px-3 backdrop-blur-md sm:h-[calc(68px+env(safe-area-inset-top))] sm:gap-4 sm:px-6">
      <button
        className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 md:hidden"
        type="button"
        onClick={onOpenSidebar}
        aria-label="Mở menu"
      >
        <Menu size={20} />
      </button>

      <div className="hidden items-center gap-2 lg:flex min-w-36">
        <span className="text-xs font-semibold text-slate-400">SmartERP</span>
        <span className="text-slate-300">/</span>
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">
          {pageNames[location.pathname] ?? 'Tổng quan'}
        </span>
      </div>

      <form
        className="relative min-w-0 flex-1 sm:max-w-md"
        onSubmit={handleSearch}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
        />
        <input
          ref={searchInputRef}
          className="h-9.5 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pl-10 pr-12 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm sản phẩm nhanh... (Ctrl + K)"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 shadow-2xs">
          ⌘K
        </span>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sẵn sàng</span>
        </div>
        <button
          className="hidden sm:inline-flex items-center gap-1.5 h-9 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 text-xs font-bold text-white shadow-xs shadow-emerald-500/20 transition hover:brightness-105 active:scale-95"
          type="button"
          onClick={() => navigate('/pos')}
        >
          <Zap size={14} />
          <span>Bán POS</span>
        </button>

        <button
          className="btn-primary hidden md:inline-flex text-xs h-9 px-3.5"
          type="button"
          onClick={() => navigate('/products?new=1')}
        >
          <PackagePlus size={15} />
          <span>Thêm sản phẩm</span>
        </button>

        <button
          className="relative grid size-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          type="button"
          onClick={() => showToast('Bạn chưa có thông báo mới.', 'info')}
          aria-label="Thông báo"
          title="Thông báo"
        >
          <Bell size={18} />
        </button>

        <div className="relative" ref={profileRef}>
          <button
            className="flex h-9.5 items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-slate-100"
            type="button"
            onClick={() => setProfileOpen((value) => !value)}
            aria-label="Tài khoản người dùng"
          >
            <span className="grid size-7.5 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-xs font-bold text-white shadow-xs">
              {initials}
            </span>
            <ChevronDown
              className="hidden text-slate-400 transition sm:block"
              size={14}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-11 w-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95">
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {business?.name ?? 'SmartERP'}
                  </p>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    {business?.role ?? 'Member'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email}</p>
              </div>

              <div className="border-t border-slate-100 my-1" />

              <button
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                type="button"
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/settings')
                }}
              >
                <UserRound size={15} className="text-slate-400" />
                <span>Cài đặt tài khoản</span>
              </button>

              <button
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                type="button"
                onClick={logout}
              >
                <LogOut size={15} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
