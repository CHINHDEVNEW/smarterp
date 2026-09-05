import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

function authMessage(error) {
  const message = error?.message?.toLowerCase() ?? ''
  if (message.includes('invalid login credentials')) return 'Email hoặc mật khẩu không đúng.'
  if (message.includes('email not confirmed')) return 'Email chưa được xác nhận.'
  if (message.includes('rate limit')) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
  return 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.'
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (loginError) setError(authMessage(loginError))
    setLoading(false)
  }

  async function handleForgotPassword(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) {
      const message = resetError.message?.toLowerCase() ?? ''
      setError(message.includes('rate limit')
        ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
        : 'Chưa thể gửi email khôi phục. Vui lòng thử lại.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  function showForgotPassword() {
    setMode('forgot')
    setError('')
    setSent(false)
  }

  function showLogin() {
    setMode('login')
    setError('')
    setSent(false)
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.24),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,.18),transparent_32%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden min-h-[650px] flex-col justify-between bg-gradient-to-br from-sky-600 via-cyan-600 to-emerald-600 p-12 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <ShieldCheck size={25} />
            </div>
            <div>
              <p className="text-xl font-bold">SmartERP</p>
              <p className="text-sm text-white/75">Quản trị doanh nghiệp</p>
            </div>
          </div>
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">Gọn hơn mỗi ngày</p>
            <h1 className="max-w-lg text-4xl font-bold leading-tight">Mọi hoạt động bán hàng trong một không gian làm việc.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/80">Theo dõi doanh thu, hàng hóa và công nợ đồng bộ trên máy tính lẫn điện thoại.</p>
          </div>
          <p className="text-sm text-white/65">Dữ liệu được bảo vệ bằng Supabase Auth và Row Level Security.</p>
        </section>

        <section className="flex min-h-[580px] items-center px-6 py-12 sm:px-12 lg:min-h-[650px]">
          <form className="mx-auto w-full max-w-sm" onSubmit={mode === 'forgot' ? handleForgotPassword : handleSubmit}>
            <div className="mb-9 lg:hidden">
              <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200">
                <ShieldCheck size={27} />
              </div>
              <p className="text-xl font-bold text-slate-950">SmartERP</p>
            </div>
            {mode === 'forgot' && (
              <button className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-sky-700" type="button" onClick={showLogin}>
                <ArrowLeft size={17} /> Quay lại đăng nhập
              </button>
            )}
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">{mode === 'forgot' ? 'Quên mật khẩu?' : 'Chào mừng trở lại'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === 'forgot' ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.' : 'Đăng nhập để tiếp tục công việc của bạn.'}
            </p>

            {sent ? (
              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <CheckCircle2 className="mx-auto text-emerald-600" size={34} />
                <h3 className="mt-3 font-bold text-emerald-900">Hãy kiểm tra hộp thư</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-700">Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả thư rác.</p>
                <button className="mt-4 text-sm font-bold text-sky-700 hover:text-sky-800" type="button" onClick={showLogin}>Trở về đăng nhập</button>
              </div>
            ) : <>
            <div className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email</span>
                <span className="relative block">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input className="field pl-11" type="email" autoComplete="email" placeholder="ban@doanhnghiep.vn" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </span>
              </label>
              {mode === 'login' && <label className="block">
                <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                  <span>Mật khẩu</span>
                  <button className="text-xs font-bold text-sky-600 hover:text-sky-700" type="button" onClick={showForgotPassword}>Quên mật khẩu?</button>
                </span>
                <span className="relative block">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input className="field px-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Nhập mật khẩu" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>}
            </div>

            {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

            <button className="mt-7 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-sky-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={loading}>
              {mode === 'forgot' ? <Send size={17} /> : null}
              {loading ? (mode === 'forgot' ? 'Đang gửi...' : 'Đang đăng nhập...') : (mode === 'forgot' ? 'Gửi liên kết khôi phục' : 'Đăng nhập')}
            </button>
            </>}
          </form>
        </section>
      </div>
    </main>
  )
}
