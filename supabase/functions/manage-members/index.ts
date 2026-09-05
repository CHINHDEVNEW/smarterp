import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2.115.0/cors'

const allowedRoles = new Set(['admin', 'manager', 'sales', 'warehouse', 'purchasing', 'accountant', 'staff', 'member'])

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({ ok: true })
  if (request.method !== 'POST') return json({ error: 'Phương thức không được hỗ trợ.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization) {
      return json({ error: 'Yêu cầu xác thực không hợp lệ.' }, 401)
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Phiên đăng nhập đã hết hạn.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const body = await request.json()
    const action = String(body.action || '')
    const businessId = String(body.businessId || '')
    if (!businessId) return json({ error: 'Thiếu thông tin doanh nghiệp.' }, 400)

    const { data: actor } = await admin
      .from('business_members')
      .select('role, active')
      .eq('business_id', businessId)
      .eq('user_id', authData.user.id)
      .eq('active', true)
      .maybeSingle()
    if (!actor || !['owner', 'admin'].includes(String(actor.role).toLowerCase())) {
      return json({ error: 'Bạn không có quyền quản lý thành viên.' }, 403)
    }

    if (action === 'list') {
      const { data: memberships, error } = await admin
        .from('business_members')
        .select('user_id, role, active')
        .eq('business_id', businessId)
        .eq('active', true)
      if (error) throw error

      const members = await Promise.all((memberships || []).map(async (membership) => {
        const { data } = await admin.auth.admin.getUserById(membership.user_id)
        return {
          ...membership,
          email: data.user?.email || null,
          name: data.user?.user_metadata?.name || data.user?.user_metadata?.full_name || null,
        }
      }))
      members.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : String(a.email).localeCompare(String(b.email))))
      return json({ members })
    }

    if (action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase()
      const role = String(body.role || '').toLowerCase()
      const redirectTo = String(body.redirectTo || '')
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Email không hợp lệ.' }, 400)
      if (!allowedRoles.has(role)) return json({ error: 'Vai trò không hợp lệ.' }, 400)
      if (redirectTo) {
        const redirectUrl = new URL(redirectTo)
        if (!['http:', 'https:'].includes(redirectUrl.protocol) || redirectUrl.pathname !== '/reset-password') {
          return json({ error: 'Đường dẫn nhận lời mời không hợp lệ.' }, 400)
        }
      }

      const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listError) throw listError
      let targetUser = usersPage.users.find((user) => user.email?.toLowerCase() === email)
      let invited = false
      if (!targetUser) {
        const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo: redirectTo || undefined,
        })
        if (inviteError || !data.user) throw inviteError || new Error('Không thể tạo lời mời.')
        targetUser = data.user
        invited = true
      }

      const { data: existing } = await admin
        .from('business_members')
        .select('user_id')
        .eq('business_id', businessId)
        .eq('user_id', targetUser.id)
        .maybeSingle()
      const memberResult = existing
        ? await admin.from('business_members').update({ role, active: true }).eq('business_id', businessId).eq('user_id', targetUser.id)
        : await admin.from('business_members').insert({ business_id: businessId, user_id: targetUser.id, role, active: true })
      if (memberResult.error) throw memberResult.error
      return json({ ok: true, invited })
    }

    if (action === 'update') {
      const userId = String(body.userId || '')
      const role = String(body.role || '').toLowerCase()
      const active = body.active !== false
      if (!userId || userId === authData.user.id) return json({ error: 'Không thể thay đổi chính tài khoản đang đăng nhập.' }, 400)

      const { data: target } = await admin
        .from('business_members')
        .select('role')
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .maybeSingle()
      if (!target) return json({ error: 'Không tìm thấy thành viên.' }, 404)
      if (String(target.role).toLowerCase() === 'owner') return json({ error: 'Không thể thay đổi chủ sở hữu.' }, 400)
      if (active && !allowedRoles.has(role)) return json({ error: 'Vai trò không hợp lệ.' }, 400)

      const values = active ? { role, active: true } : { active: false }
      const { error } = await admin.from('business_members').update(values).eq('business_id', businessId).eq('user_id', userId)
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'Thao tác không hợp lệ.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Đã xảy ra lỗi máy chủ.' }, 500)
  }
})
