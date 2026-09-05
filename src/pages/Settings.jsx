/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Building2, Check, KeyRound, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import useAuth from '../hooks/useAuth'
import useBusiness from '../hooks/useBusiness'
import useToast from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import { updateBusiness } from '../services/settingsService'
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
      showToast(message.includes('rate limit') ? 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.' : 'Chưa thể gửi email đặt lại mật khẩu.', 'error')
      return
    }
    showToast('Đã gửi email đặt lại mật khẩu. Hãy kiểm tra cả thư rác.')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="page-heading">
        <div>
          <p className="page-eyebrow">SmartERP</p>
          <h1 className="page-title">Cài đặt</h1>
          <p className="page-description">Quản lý thông tin doanh nghiệp và bảo mật tài khoản.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <form className="surface p-5 sm:p-6" onSubmit={handleSave}>
          <div className="form-section-title"><Building2 className="text-sky-600" size={18} /> Thông tin doanh nghiệp</div>
          <p className="mb-5 text-sm leading-6 text-slate-500">Thông tin này được dùng trên các màn hình bán hàng và báo cáo.</p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tên doanh nghiệp <span className="text-rose-500">*</span></span>
              <input className="field" name="name" value={form.name} onChange={updateField} placeholder="Tên cửa hàng hoặc doanh nghiệp" required />
            </label>
            <div className="form-grid">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Số điện thoại</span>
                <input className="field" name="phone" value={form.phone} onChange={updateField} type="tel" autoComplete="tel" placeholder="0901 234 567" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email doanh nghiệp</span>
                <input className="field" name="email" value={form.email} onChange={updateField} type="email" autoComplete="email" placeholder="lienhe@doanhnghiep.vn" />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Địa chỉ</span>
              <textarea className="field min-h-24 resize-y" name="address" value={form.address} onChange={updateField} placeholder="Địa chỉ cửa hàng hoặc văn phòng" />
            </label>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button className="btn-secondary" type="button" onClick={() => setForm({ name: business?.name ?? '', phone: business?.phone ?? '', email: business?.email ?? '', address: business?.address ?? '' })} disabled={saving}>Khôi phục</button>
            <button className="btn-primary" type="submit" disabled={saving || !form.name.trim()}><Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
          </div>
        </form>

        <div className="space-y-5">
          <section className="surface p-5 sm:p-6">
            <div className="form-section-title"><ShieldCheck className="text-emerald-600" size={18} /> Bảo mật tài khoản</div>
            <p className="mb-5 text-sm leading-6 text-slate-500">Giữ tài khoản an toàn bằng cách cập nhật mật khẩu định kỳ.</p>
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-sky-600 shadow-sm"><UserRound size={19} /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400">Tài khoản đang đăng nhập</p>
                <p className="mt-1 truncate text-sm font-bold text-slate-800">{user?.email ?? '—'}</p>
              </div>
            </div>
            <button className="btn-secondary mt-4 w-full" type="button" onClick={sendPasswordReset} disabled={sendingReset || !user?.email}>
              {sendingReset ? <Mail className="animate-pulse" size={17} /> : <KeyRound size={17} />}
              {sendingReset ? 'Đang gửi email...' : 'Đặt lại mật khẩu'}
            </button>
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="form-section-title"><Check className="text-sky-600" size={18} /> Không gian làm việc</div>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Vai trò</dt><dd className="font-bold capitalize text-slate-800">{business?.role ?? 'Thành viên'}</dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-slate-500">Trạng thái</dt><dd className="inline-flex items-center gap-1.5 font-bold text-emerald-600"><span className="size-2 rounded-full bg-emerald-500" /> Đang hoạt động</dd></div>
            </dl>
          </section>
        </div>
      </div>
      <div className="mt-5">
        <OperationalSettings businessId={businessId} showToast={showToast} />
      </div>
      <div className="mt-5">
        <TeamManagement businessId={businessId} currentUserId={user?.id} showToast={showToast} />
      </div>
    </div>
  )
}
