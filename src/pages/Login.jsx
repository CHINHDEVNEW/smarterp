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
      setError(
        message.includes('rate limit')
          ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
          : 'Chưa thể gửi email khôi phục. Vui lòng thử lại.'
      )
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
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.22),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,.16),transparent_32%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-sky-600 via-cyan-600 to-emerald-600 p-12 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
              <ShieldCheck size={25} />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">SmartERP</p>
              <p className="text-xs text-white/75">Quản trị doanh nghiệp thông minh</p>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
              Hiện đại · Tối ưu · Đa nền tảng
            </p>
            <h1 className="max-w-lg text-3xl font-extrabold leading-tight xl:text-4xl">
              Mọi hoạt động quản trị bán hàng trong một không gian làm việc.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/80">
              Theo dõi doanh thu, kho hàng, tài chính và công nợ tức thời trên máy tính và điện thoại.
            </p>
          </div>
          <p className="text-xs text-white/60">
            Dữ liệu được mã hóa và bảo vệ bằng Supabase Auth & RLS.
          </p>
        </section>

        <section className="flex min-h-[540px] items-center px-6 py-10 sm:px-12 lg:min-h-[620px]">
          <form
            className="mx-auto w-full max-w-sm"
            onSubmit={mode === 'forgot' ? handleForgotPassword : handleSubmit}
          >
            <div className="mb-8 lg:hidden">
              <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-200">
                <ShieldCheck size={26} />
              </div>
              <p className="text-xl font-extrabold text-slate-900">SmartERP</p>
            </div>

            {mode === 'forgot' && (
              <button
                className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-700 transition"
                type="button"
                onClick={showLogin}
              >
                <ArrowLeft size={16} />
                <span>Quay lại đăng nhập</span>
              </button>
            )}

            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {mode === 'forgot' ? 'Quên mật khẩu?' : 'Chào mừng trở lại'}
            </h2>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm leading-relaxed">
              {mode === 'forgot'
                ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu.'
                : 'Đăng nhập để tiếp tục điều hành công việc của bạn.'}
            </p>

            {sent ? (
              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
                <h3 className="mt-3 font-bold text-emerald-900">Hãy kiểm tra hộp thư</h3>
                <p className="mt-2 text-xs leading-relaxed text-emerald-700">
                  Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi. Hãy kiểm tra cả thư rác (Spam).
                </p>
                <button
                  className="mt-4 text-xs font-bold text-sky-700 hover:text-sky-800"
                  type="button"
                  onClick={showLogin}
                >
                  Trở về đăng nhập
                </button>
              </div>
            ) : (
              <>
                <div className="mt-7 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Email <span className="text-rose-500">*</span>
                    </span>
                    <span className="relative block">
                      <Mail
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        className="field pl-11 text-base sm:text-sm"
                        type="email"
                        autoComplete="email"
                        placeholder="ban@doanhnghiep.vn"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </span>
                  </label>

                  {mode === 'login' && (
                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                        <span>Mật khẩu <span className="text-rose-500">*</span></span>
                        <button
                          className="text-xs font-semibold normal-case text-sky-600 hover:text-sky-700"
                          type="button"
                          onClick={showForgotPassword}
                        >
                          Quên mật khẩu?
                        </button>
                      </span>
                      <span className="relative block">
                        <LockKeyhole
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                          size={18}
                        />
                        <input
                          className="field px-11 text-base sm:text-sm"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Nhập mật khẩu"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                        />
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </span>
                    </label>
                  )}
                </div>

                {error && (
                  <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-sky-100 transition duration-200 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={loading}
                >
                  {mode === 'forgot' ? <Send size={16} /> : null}
                  <span>
                    {loading
                      ? mode === 'forgot'
                        ? 'Đang gửi...'
                        : 'Đang đăng nhập...'
                      : mode === 'forgot'
                      ? 'Gửi liên kết khôi phục'
                      : 'Đăng nhập'}
                  </span>
                </button>
              </>
            )}
          </form>
        </section>
      </div>
    </main>
  )
}
