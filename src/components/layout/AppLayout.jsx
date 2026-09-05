import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Building2, RefreshCw } from 'lucide-react'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'
import AppLoading from '../common/AppLoading'
import useBusiness from '../../hooks/useBusiness'
import useOnlineStatus from '../../hooks/useOnlineStatus'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, error, refresh } = useBusiness()
  const online = useOnlineStatus()

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-h-screen md:ml-[248px]">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {!online && <div className="bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-800">Đang ngoại tuyến · Có thể xem dữ liệu đã lưu, thao tác ghi sẽ tạm dừng.</div>}
        <main className="mx-auto min-h-[calc(100vh-68px)] max-w-[1480px] px-3 py-5 pb-24 sm:px-6 sm:py-7 md:pb-8">
          {loading ? (
            <AppLoading label="Đang tải không gian làm việc..." />
          ) : error ? (
            <section className="surface mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center p-8 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><Building2 size={28} /></div>
              <h1 className="mt-5 text-xl font-bold text-slate-950">Không thể mở doanh nghiệp</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
              <button className="btn-primary mt-6" type="button" onClick={refresh}><RefreshCw size={18} /> Thử lại</button>
            </section>
          ) : <Outlet />}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
