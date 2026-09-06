import { CheckCircle2, CircleAlert, Info, X, XCircle } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import ToastContext from '../../contexts/ToastContext'

const styles = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-white/95 text-emerald-800 shadow-emerald-900/5',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: XCircle,
    className: 'border-rose-200 bg-white/95 text-rose-800 shadow-rose-900/5',
    iconColor: 'text-rose-600',
  },
  warning: {
    icon: CircleAlert,
    className: 'border-amber-200 bg-white/95 text-amber-800 shadow-amber-900/5',
    iconColor: 'text-amber-600',
  },
  info: {
    icon: Info,
    className: 'border-sky-200 bg-white/95 text-sky-800 shadow-sky-900/5',
    iconColor: 'text-sky-600',
  },
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'success') => {
    const id = nextId.current++
    setItems((current) => [...current, { id, message, type }])
    window.setTimeout(() => dismiss(id), 4200)
  }, [dismiss])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-20 left-3 right-3 z-[70] space-y-2.5 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[380px]"
        aria-live="polite"
      >
        {items.map((item) => {
          const appearance = styles[item.type] ?? styles.info
          const Icon = appearance.icon
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-2xl border p-3.5 text-sm font-medium shadow-lg backdrop-blur-md transition-all ${appearance.className}`}
            >
              <Icon
                className={`mt-0.5 shrink-0 ${appearance.iconColor}`}
                size={19}
              />
              <p className="min-w-0 flex-1 leading-5 text-slate-800">{item.message}</p>
              <button
                className="rounded-lg p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
