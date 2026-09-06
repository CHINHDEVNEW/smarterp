import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Building2, RefreshCw, WifiOff } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import AppLoading from '../common/AppLoading'
import useBusiness from '../../hooks/useBusiness'
import useOnlineStatus from '../../hooks/useOnlineStatus'
import PwaPrompts from '../common/PwaPrompts'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, error, refresh } = useBusiness()
  const online = useOnlineStatus()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen md:ml-[248px]">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {!online && (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-800">
            <WifiOff size={15} className="shrink-0 text-amber-600" />
            <span>Đang ngoại tuyến · Có thể xem dữ liệu đã lưu, thao tác ghi sẽ tạm dừng.</span>
          </div>
        )}
        <PwaPrompts />
        <main className="mx-auto min-h-[calc(100vh-68px)] max-w-[1480px] px-4 py-6 pb-28 sm:px-6 sm:py-7 lg:px-8 md:pb-10">
          {loading ? (
            <AppLoading label="Đang tải không gian làm việc..." />
          ) : error ? (
            <section className="surface mx-auto mt-12 flex min-h-80 max-w-lg flex-col items-center justify-center p-8 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
                <Building2 size={26} />
              </div>
              <h1 className="mt-5 text-lg font-bold text-slate-900">Không thể mở doanh nghiệp</h1>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{error}</p>
              <button className="btn-primary mt-6" type="button" onClick={refresh}>
                <RefreshCw size={17} /> Thử lại
              </button>
            </section>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
