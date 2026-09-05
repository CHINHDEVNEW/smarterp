import { useContext } from 'react'
import BusinessContext from '../contexts/BusinessContext'

export default function useBusiness() {
  const value = useContext(BusinessContext)
  if (!value) throw new Error('useBusiness phải được dùng bên trong BusinessProvider')
  return value
}
