import { NavLink } from 'react-router-dom'
import { ShieldCheck, X } from 'lucide-react'
import { navigationGroups, settingsItem } from './navigation'
import useBusiness from '../../hooks/useBusiness'
import { canAccess } from '../../lib/permissions'

function NavItem({ item, onNavigate }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 ${
          isActive
            ? 'bg-gradient-to-r from-sky-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-sky-500/20'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            strokeWidth={isActive ? 2.2 : 1.8}
            className={`shrink-0 transition-colors ${
              isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
            }`}
          />
          <span className="truncate flex-1">{item.label}</span>
          {item.to === '/pos' && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                isActive ? 'bg-white/25 text-white' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              Nhanh
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { business } = useBusiness()
  const groups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccess(business?.role, item.permission)
      ),
    }))
    .filter((group) => group.items.length)

  const roleNameMap = {
    owner: 'Chủ doanh nghiệp',
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    sales: 'Nhân viên bán hàng',
    staff: 'Nhân viên',
    member: 'Thành viên',
    warehouse: 'Quản lý kho',
    purchasing: 'Thu mua',
    accountant: 'Kế toán',
  }

  return (
    <>
      <button
        className={`fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-xs transition-opacity md:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
        type="button"
        onClick={onClose}
        aria-label="Đóng menu"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-slate-200/90 bg-white shadow-xs transition-transform duration-300 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[calc(68px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-md shadow-sky-200 ring-2 ring-white">
            <ShieldCheck size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-black tracking-tight text-slate-900">
                SmartERP
              </p>
              <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[9px] font-extrabold text-sky-700">
                PRO
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-slate-400">
              Quản trị vận hành
            </p>
          </div>
          <button
            className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:hidden"
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem key={item.to} item={item} onNavigate={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 space-y-2">
          {canAccess(business?.role, settingsItem.permission) && (
            <NavItem item={settingsItem} onNavigate={onClose} />
          )}
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5 transition hover:bg-slate-50">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-xs font-bold text-white shadow-xs">
              {(business?.name ?? 'S')[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">
                {business?.name ?? 'SmartERP'}
              </p>
              <p className="truncate text-[10px] font-medium text-slate-400">
                {roleNameMap[business?.role] ?? business?.role ?? 'Thành viên'}
              </p>
            </div>
            <span
              className="size-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-100 animate-pulse"
              title="Trực tuyến"
            />
          </div>
        </div>
      </aside>
    </>
  )
}
