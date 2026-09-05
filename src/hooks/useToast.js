import { useContext } from 'react'
import ToastContext from '../contexts/ToastContext'

export default function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast phải được dùng bên trong ToastProvider')
  return value
}
