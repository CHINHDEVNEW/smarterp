import { useEffect, useState } from 'react'
import { Download, RefreshCw, Share, Smartphone, X } from 'lucide-react'
import usePwaInstall from '../../hooks/usePwaInstall'
import Modal from './Modal'

export default function PwaPrompts() {
  const { canInstall, ios, install, dismiss } = usePwaInstall()
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    function showUpdate() { setUpdateReady(true) }
    window.addEventListener('smarterp:update-ready', showUpdate)
    if (window.smartErpServiceWorker?.waiting) showUpdate()
    return () => window.removeEventListener('smarterp:update-ready', showUpdate)
  }, [])

  async function installApp() {
    if (ios) {
      setIosHelpOpen(true)
      return
    }
    await install()
  }

  async function applyUpdate() {
    setUpdating(true)
    const registration = window.smartErpServiceWorker || await navigator.serviceWorker?.getRegistration()
    if (!registration?.waiting) {
      window.location.reload()
      return
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <>
      {updateReady && (
        <div className="flex flex-col items-center justify-center gap-2 bg-sky-100 px-4 py-2.5 text-center text-xs font-semibold text-sky-900 sm:flex-row">
          <span>SmartERP có phiên bản mới.</span>
          <button className="inline-flex items-center gap-1.5 font-extrabold text-sky-700 hover:text-sky-900" type="button" onClick={applyUpdate} disabled={updating}><RefreshCw className={updating ? 'animate-spin' : ''} size={14} /> {updating ? 'Đang cập nhật...' : 'Cập nhật ngay'}</button>
        </div>
      )}
      {canInstall && (
        <div className="flex items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-3 py-2.5 sm:px-6">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm"><Smartphone size={18} /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-emerald-900">Cài SmartERP trên thiết bị</p><p className="mt-0.5 hidden text-xs text-emerald-700 sm:block">Mở nhanh như ứng dụng và xem dữ liệu đã lưu khi mất mạng.</p></div>
          <button className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700" type="button" onClick={installApp}><Download size={14} /> Cài ứng dụng</button>
          <button className="grid size-8 shrink-0 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-100" type="button" onClick={dismiss} aria-label="Đóng gợi ý cài đặt"><X size={16} /></button>
        </div>
      )}
      <Modal open={iosHelpOpen} onClose={() => setIosHelpOpen(false)} title="Cài SmartERP trên iPhone/iPad" description="Thực hiện trong Safari để thêm ứng dụng vào màn hình chính." size="sm" footer={<button className="btn-primary" type="button" onClick={() => { setIosHelpOpen(false); dismiss() }}>Đã hiểu</button>}>
        <ol className="space-y-4 text-sm leading-6 text-slate-600">
          <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">1</span><span>Nhấn nút <strong className="text-slate-800">Chia sẻ</strong> <Share className="mx-1 inline text-sky-600" size={17} /> trên thanh công cụ Safari.</span></li>
          <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">2</span><span>Chọn <strong className="text-slate-800">Thêm vào Màn hình chính</strong>.</span></li>
          <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">3</span><span>Nhấn <strong className="text-slate-800">Thêm</strong> để hoàn tất.</span></li>
        </ol>
      </Modal>
    </>
  )
}
