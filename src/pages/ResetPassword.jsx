import { useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

function passwordMessage(error) {
  const message = error?.message?.toLowerCase() ?? ''
  if (message.includes('same password')) return 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  if (message.includes('weak') || message.includes('characters'))
    return 'Mật khẩu chưa đáp ứng yêu cầu bảo mật.'
  return 'Chưa thể cập nhật mật khẩu. Vui lòng mở lại liên kết trong email và thử lại.'
}

export default function ResetPassword({ canReset }) {
  const navigate = useNavigate()
  const { finishRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const rules = useMemo(
    () => [
      { label: 'Ít nhất 8 ký tự', passed: password.length >= 8 },
      {
        label: 'Có chữ hoa và chữ thường',
        passed: /[a-z]/.test(password) && /[A-Z]/.test(password),
      },
      { label: 'Có ít nhất một chữ số', passed: /\d/.test(password) },
    ],
    [password]
  )
  const passwordValid = rules.every((rule) => rule.passed)
  const confirmationValid = confirmation.length > 0 && password === confirmation

  async function handleSubmit(event) {
    event.preventDefault()
    if (!passwordValid || !confirmationValid) return
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(passwordMessage(updateError))
      setLoading(false)
      return
    }

    setSuccess(true)
    finishRecovery()
    await supabase.auth.signOut()
    setLoading(false)
  }

  async function returnToLogin() {
    finishRecovery()
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,.22),transparent_32%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,.16),transparent_32%)]" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-lg shadow-sky-100">
          {success ? (
            <CheckCircle2 size={30} />
          ) : canReset ? (
            <KeyRound size={28} />
          ) : (
            <ShieldAlert size={28} />
          )}
        </div>

        {success ? (
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Đã đổi mật khẩu
            </h1>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm leading-relaxed">
              Mật khẩu mới đã được lưu an toàn. Hãy đăng nhập lại để tiếp tục sử dụng SmartERP.
            </p>
            <button
              className="btn-primary mt-6 w-full justify-center"
              type="button"
              onClick={returnToLogin}
            >
              Đăng nhập bằng mật khẩu mới
            </button>
          </div>
        ) : !canReset ? (
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Liên kết không còn hiệu lực
            </h1>
            <p className="mt-2 text-xs text-slate-500 sm:text-sm leading-relaxed">
              Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng gửi một yêu cầu khôi phục mới.
            </p>
            <button
              className="btn-primary mt-6 w-full justify-center"
              type="button"
              onClick={returnToLogin}
            >
              Về trang đăng nhập
            </button>
          </div>
        ) : (
          <form className="mt-6" onSubmit={handleSubmit}>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Tạo mật khẩu mới
              </h1>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                Chọn mật khẩu an toàn và không trùng lặp với các dịch vụ khác.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </span>
                <span className="relative block">
                  <LockKeyhole
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    className="field px-11 text-base sm:text-sm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Nhập lại mật khẩu <span className="text-rose-500">*</span>
                </span>
                <span className="relative block">
                  <ShieldCheck
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    className="field pl-11 text-base sm:text-sm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                  />
                </span>
                {confirmation && !confirmationValid && (
                  <span className="mt-1.5 block text-xs font-semibold text-rose-600">
                    Mật khẩu nhập lại chưa khớp.
                  </span>
                )}
              </label>
            </div>

            <div className="mt-5 grid gap-2 rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
              {rules.map((rule) => (
                <div
                  className={`flex items-center gap-2 text-xs font-semibold ${
                    rule.passed ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                  key={rule.label}
                >
                  <span
                    className={`grid size-4 place-items-center rounded-full ${
                      rule.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 leading-relaxed">
                {error}
              </div>
            )}

            <button
              className="btn-primary mt-6 w-full justify-center"
              type="submit"
              disabled={loading || !passwordValid || !confirmationValid}
            >
              {loading ? 'Đang lưu...' : 'Đặt mật khẩu mới'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
