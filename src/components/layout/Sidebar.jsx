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
      className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
    >
      <Icon size={19} strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { business } = useBusiness()
  const groups = navigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccess(business?.role, item.permission)) }))
    .filter((group) => group.items.length)

  return (
    <>
      <button className={`fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition md:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`} type="button" onClick={onClose} aria-label="Đóng menu" />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-slate-200 bg-white transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-[68px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-100">
            <ShieldCheck size={23} />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[17px] font-extrabold tracking-tight text-slate-950">SmartERP</p>
            <p className="truncate text-[11px] font-medium text-slate-400">Quản trị doanh nghiệp</p>
          </div>
          <button className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 md:hidden" type="button" onClick={onClose} aria-label="Đóng menu"><X size={20} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => <NavItem key={item.to} item={item} onNavigate={onClose} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          {canAccess(business?.role, settingsItem.permission) && <NavItem item={settingsItem} onNavigate={onClose} />}
          <div className="mt-2 rounded-2xl bg-slate-50 px-3 py-3">
            <p className="truncate text-xs font-bold text-slate-700">{business?.name ?? 'SmartERP'}</p>
            <p className="mt-0.5 text-[11px] capitalize text-slate-400">Quyền {business?.role ?? 'thành viên'}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
