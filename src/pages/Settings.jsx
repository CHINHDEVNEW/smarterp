/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Building2, Check, KeyRound, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import { updateBusiness } from '../services/settingsService'
import PageHeader from '../components/common/PageHeader'
import OperationalSettings from '../components/settings/OperationalSettings'
import TeamManagement from '../components/settings/TeamManagement'

const emptyForm = { name: '', phone: '', email: '', address: '' }

export default function Settings() {
  const { user } = useAuth()
  const { business, businessId, refresh } = useBusiness()
  const { showToast } = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  useEffect(() => {
    setForm({
      name: business?.name ?? '',
      phone: business?.phone ?? '',
      email: business?.email ?? '',
      address: business?.address ?? '',
    })
  }, [business])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSave(event) {
    event.preventDefault()
    if (!businessId || !form.name.trim()) return
    setSaving(true)
    try {
      await updateBusiness(businessId, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      })
      await refresh()
      showToast('Đã lưu thông tin doanh nghiệp.')
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Không thể lưu thông tin doanh nghiệp.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return
    setSendingReset(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSendingReset(false)
    if (error) {
      const message = error.message?.toLowerCase() ?? ''
      showToast(
        message.includes('rate limit')
          ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
          : 'Chưa thể gửi email đặt lại mật khẩu.',
        'error'
      )
      return
    }
    showToast('Đã gửi email đặt lại mật khẩu. Hãy kiểm tra cả thư rác.')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Quản trị hệ thống"
        title="Cài đặt"
        description="Quản lý thông tin doanh nghiệp, cấu hình vận hành và bảo mật tài khoản."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <form className="surface rounded-2xl p-5 sm:p-6" onSubmit={handleSave}>
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <Building2 size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thông tin doanh nghiệp</h2>
              <p className="text-xs text-slate-400">
                Hiển thị trên hóa đơn, phiếu bán hàng và báo cáo
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Tên doanh nghiệp <span className="text-rose-500">*</span>
              </span>
              <input
                className="field font-semibold"
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Tên cửa hàng hoặc doanh nghiệp"
                required
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Số điện thoại
                </span>
                <input
                  className="field tabular-nums"
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  type="tel"
                  autoComplete="tel"
                  placeholder="0901 234 567"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email liên hệ
                </span>
                <input
                  className="field"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  type="email"
                  autoComplete="email"
                  placeholder="lienhe@doanhnghiep.vn"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Địa chỉ
              </span>
              <textarea
                className="field min-h-24 resize-y leading-relaxed"
                name="address"
                value={form.address}
                onChange={updateField}
                placeholder="Địa chỉ cửa hàng hoặc văn phòng"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              className="btn-secondary"
              type="button"
              onClick={() =>
                setForm({
                  name: business?.name ?? '',
                  phone: business?.phone ?? '',
                  email: business?.email ?? '',
                  address: business?.address ?? '',
                })
              }
              disabled={saving}
            >
              Khôi phục
            </button>
            <button
              className="btn-primary"
              type="submit"
              disabled={saving || !form.name.trim()}
            >
              <Save size={17} />
              <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <section className="surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <ShieldCheck size={18} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Bảo mật tài khoản</h2>
                <p className="text-xs text-slate-400">Quản lý mật khẩu và quyền đăng nhập</p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50/80 border border-slate-100 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sky-600 shadow-sm ring-1 ring-slate-100">
                <UserRound size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">Tài khoản đang đăng nhập</p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
                  {user?.email ?? '—'}
                </p>
              </div>
            </div>

            <button
              className="btn-secondary mt-4 w-full justify-center"
              type="button"
              onClick={sendPasswordReset}
              disabled={sendingReset || !user?.email}
            >
              {sendingReset ? (
                <Mail className="animate-pulse" size={17} />
              ) : (
                <KeyRound size={17} />
              )}
              <span>{sendingReset ? 'Đang gửi email...' : 'Đặt lại mật khẩu qua email'}</span>
            </button>
          </section>

          <section className="surface rounded-2xl p-5 sm:p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Check size={18} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Không gian làm việc</h2>
                <p className="text-xs text-slate-400">Trạng thái và vai trò của bạn</p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Vai trò</dt>
                <dd className="font-bold capitalize text-slate-800">
                  {business?.role ?? 'Thành viên'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Đang hoạt động</span>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <div className="space-y-6">
        <OperationalSettings businessId={businessId} showToast={showToast} />
        <TeamManagement
          businessId={businessId}
          currentUserId={user?.id}
          showToast={showToast}
        />
      </div>
    </div>
  )
}
