import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { BusinessProvider } from './contexts/BusinessProvider'
import useAuth from './hooks/useAuth'
import { ToastProvider } from './components/common/Toast'
import AppLayout from './components/layout/AppLayout'
import AppLoading from './components/common/AppLoading'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import useBusiness from './hooks/useBusiness'
import { canAccess } from './lib/permissions'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Products = lazy(() => import('./pages/Products'))
const Customers = lazy(() => import('./pages/Customers'))
const Sales = lazy(() => import('./pages/Sales'))
const POS = lazy(() => import('./pages/POS'))
const Finance = lazy(() => import('./pages/Finance'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Quotes = lazy(() => import('./pages/Quotes'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Returns = lazy(() => import('./pages/Returns'))
const Production = lazy(() => import('./pages/Production'))

function PermissionRoute({ permission, children }) {
  const { business, loading } = useBusiness()
  if (loading) return <AppLoading label="Đang kiểm tra quyền truy cập..." />
  return canAccess(business?.role, permission) ? children : <Navigate to="/dashboard" replace />
}

function ProtectedApp() {
  const { session, loading, recoveryMode } = useAuth()
  const location = useLocation()

  if (loading) return <AppLoading label="Đang khởi động SmartERP..." />
  if (location.pathname === '/reset-password') {
    return <ResetPassword canReset={Boolean(session && recoveryMode)} />
  }
  if (!session) return <Login />

  return (
    <BusinessProvider>
      <Suspense fallback={<AppLoading label="Đang mở chức năng..." />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<PermissionRoute permission="products"><Products /></PermissionRoute>} />
            <Route path="customers" element={<PermissionRoute permission="customers"><Customers /></PermissionRoute>} />
            <Route path="sales" element={<PermissionRoute permission="sales"><Sales /></PermissionRoute>} />
            <Route path="pos" element={<PermissionRoute permission="pos"><POS /></PermissionRoute>} />
            <Route path="purchases" element={<PermissionRoute permission="purchases"><Purchases /></PermissionRoute>} />
            <Route path="suppliers" element={<PermissionRoute permission="suppliers"><Suppliers /></PermissionRoute>} />
            <Route path="inventory" element={<PermissionRoute permission="inventory"><Inventory /></PermissionRoute>} />
            <Route path="finance" element={<PermissionRoute permission="finance"><Finance /></PermissionRoute>} />
            <Route path="reports" element={<PermissionRoute permission="reports"><Reports /></PermissionRoute>} />
            <Route path="quotes" element={<PermissionRoute permission="quotes"><Quotes /></PermissionRoute>} />
            <Route path="returns" element={<PermissionRoute permission="returns"><Returns /></PermissionRoute>} />
            <Route path="production" element={<PermissionRoute permission="production"><Production /></PermissionRoute>} />
            <Route path="settings" element={<PermissionRoute permission="settings"><Settings /></PermissionRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BusinessProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ProtectedApp />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
