import { Component } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('SmartERP Uncaught Error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  render() {
    if (this.state.hasError) {
      const isDev = !import.meta.env.PROD
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-slate-800">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
              <AlertTriangle size={32} />
            </div>

            <h1 className="mt-5 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Đã xảy ra sự cố hiển thị
            </h1>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm leading-relaxed">
              Hệ thống đã tự động bảo vệ dữ liệu của bạn. Bạn có thể tải lại trang hoặc quay về trang Tổng quan để tiếp tục làm việc.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary inline-flex items-center gap-2"
              >
                <RefreshCw size={16} />
                <span>Tải lại trang (F5)</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Home size={16} />
                <span>Về Tổng quan</span>
              </button>
            </div>

            {isDev && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-xs font-bold text-rose-600 hover:text-rose-700">
                  Chi tiết lỗi kỹ thuật (dành cho lập trình viên)
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-rose-300 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
