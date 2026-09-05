import { supabase } from '../lib/supabase'

async function invokeManageMembers(body) {
  const { data, error } = await supabase.functions.invoke('manage-members', { body })
  if (error) {
    let message = error.message
    try {
      const responseBody = await error.context?.json()
      message = responseBody?.error || message
    } catch {
      // Keep the SDK error when the response is not JSON.
    }
    throw new Error(message || 'Không thể quản lý thành viên.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export async function listBusinessMembers(businessId) {
  const data = await invokeManageMembers({ action: 'list', businessId })
  return data?.members ?? []
}

export async function inviteBusinessMember(businessId, email, role) {
  return invokeManageMembers({
    action: 'invite',
    businessId,
    email,
    role,
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

export async function updateBusinessMember(businessId, userId, values) {
  return invokeManageMembers({ action: 'update', businessId, userId, ...values })
}
