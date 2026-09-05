/* oxlint-disable react/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import useAuth from '../hooks/useAuth'
import BusinessContext from './BusinessContext'
import { getAppSettings } from '../services/settingsService'
import { setCurrencySettings } from '../lib/formatters'

export function BusinessProvider({ children }) {
  const { user } = useAuth()
  const [business, setBusiness] = useState(null)
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBusiness = useCallback(async () => {
    if (!user) {
      setBusiness(null)
      setSettings(null)
      setCurrencySettings()
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: queryError } = await supabase
      .from('business_members')
      .select(`
        business_id,
        role,
        active,
        businesses (
          id,
          name,
          phone,
          email,
          address
        )
      `)
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (queryError) {
      setError('Không tải được thông tin doanh nghiệp. Vui lòng thử lại.')
      setLoading(false)
      return
    }

    if (!data) {
      setError('Tài khoản chưa được gán vào doanh nghiệp nào.')
      setLoading(false)
      return
    }

    const linkedBusiness = Array.isArray(data.businesses)
      ? data.businesses[0]
      : data.businesses

    setBusiness({
      ...linkedBusiness,
      id: linkedBusiness?.id ?? data.business_id,
      role: data.role,
    })
    const appSettings = await getAppSettings(data.business_id).catch(() => null)
    setSettings(appSettings)
    setCurrencySettings(appSettings ?? {})
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadBusiness()
  }, [loadBusiness])

  const value = useMemo(
    () => ({ business, businessId: business?.id ?? null, settings, loading, error, refresh: loadBusiness }),
    [business, error, loading, loadBusiness, settings],
  )

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}
