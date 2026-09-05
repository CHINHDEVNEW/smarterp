/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { inviteBusinessMember, listBusinessMembers, updateBusinessMember } from '../../services/memberService'
import Loading from '../common/Loading'

const roles = [
  ['admin', 'Quản trị viên'],
  ['manager', 'Quản lý'],
  ['sales', 'Bán hàng'],
  ['warehouse', 'Kho hàng'],
  ['purchasing', 'Mua hàng'],
  ['accountant', 'Kế toán'],
  ['staff', 'Nhân viên'],
]

const roleLabels = Object.fromEntries([['owner', 'Chủ sở hữu'], ...roles])

export default function TeamManagement({ businessId, currentUserId, showToast }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [saving, setSaving] = useState(false)
  const [changingId, setChangingId] = useState('')
  const [error, setError] = useState('')

  const loadMembers = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    setError('')
    try {
      setMembers(await listBusinessMembers(businessId))
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách thành viên.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { loadMembers() }, [loadMembers])

  async function invite(event) {
    event.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    setError('')
    try {
      const result = await inviteBusinessMember(businessId, email.trim().toLowerCase(), role)
      setEmail('')
      showToast(result?.invited ? 'Đã gửi lời mời cho thành viên.' : 'Đã thêm tài khoản hiện có vào doanh nghiệp.')
      await loadMembers()
    } catch (inviteError) {
      setError(inviteError.message || 'Không thể mời thành viên.')
    } finally {
      setSaving(false)
    }
  }

  async function changeMember(member, values) {
    setChangingId(member.user_id)
    setError('')
    try {
      await updateBusinessMember(businessId, member.user_id, values)
      showToast(values.active === false ? 'Đã ngừng quyền truy cập của thành viên.' : 'Đã cập nhật vai trò thành viên.')
      await loadMembers()
    } catch (changeError) {
      setError(changeError.message || 'Không thể cập nhật thành viên.')
    } finally {
      setChangingId('')
    }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="form-section-title"><Users className="text-indigo-600" size={18} /> Thành viên và phân quyền</div>
        <p className="text-sm leading-6 text-slate-500">Mời nhân viên và giới hạn chức năng theo đúng công việc của họ.</p>
        <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]" onSubmit={invite}>
          <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@doanhnghiep.vn" required />
          <select className="field" value={role} onChange={(event) => setRole(event.target.value)}>{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button className="btn-primary" type="submit" disabled={saving}><UserPlus size={17} /> {saving ? 'Đang mời...' : 'Mời thành viên'}</button>
        </form>
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
      </div>

      {loading ? <div className="p-5"><Loading rows={3} /></div> : members.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Chưa có thành viên.</p> : (
        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const immutable = member.role === 'owner' || member.user_id === currentUserId
            const changing = changingId === member.user_id
            return (
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-6" key={member.user_id}>
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 font-extrabold text-indigo-700">{(member.email || '?').slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{member.email || 'Chưa có email'}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck size={13} /> {roleLabels[member.role] || member.role}</p></div>
                <div className="flex gap-2">
                  <select className="field min-w-40" value={member.role} onChange={(event) => changeMember(member, { role: event.target.value, active: true })} disabled={immutable || changing}>
                    {member.role === 'owner' && <option value="owner">Chủ sở hữu</option>}
                    {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {!immutable && <button className="btn-secondary text-rose-600" type="button" onClick={() => changeMember(member, { active: false })} disabled={changing}>Ngừng truy cập</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <button className="mx-auto mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-sky-700" type="button" onClick={loadMembers} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} size={14} /> Làm mới danh sách</button>
    </section>
  )
}
