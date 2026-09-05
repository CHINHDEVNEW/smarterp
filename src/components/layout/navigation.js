import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Package,
  PackageCheck,
  Factory,
  ReceiptText,
  Settings,
  ShoppingBag,
  Truck,
  Users,
} from 'lucide-react'

export const navigationGroups = [
  {
    label: 'Vận hành',
    items: [
      { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, permission: 'dashboard' },
      { to: '/sales', label: 'Bán hàng', icon: ReceiptText, permission: 'sales' },
      { to: '/pos', label: 'Bán hàng nhanh', icon: ShoppingBag, permission: 'pos' },
      { to: '/products', label: 'Sản phẩm', icon: Package, permission: 'products' },
      { to: '/inventory', label: 'Kho hàng', icon: Boxes, permission: 'inventory' },
      { to: '/production', label: 'Sản xuất', icon: Factory, permission: 'production' },
      { to: '/customers', label: 'Khách hàng', icon: Users, permission: 'customers' },
    ],
  },
  {
    label: 'Giao dịch',
    items: [
      { to: '/purchases', label: 'Mua hàng', icon: Truck, permission: 'purchases' },
      { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck, permission: 'suppliers' },
      { to: '/quotes', label: 'Báo giá', icon: FileText, permission: 'quotes' },
      { to: '/returns', label: 'Trả hàng', icon: PackageCheck, permission: 'returns' },
    ],
  },
  {
    label: 'Phân tích',
    items: [
      { to: '/finance', label: 'Tài chính', icon: CircleDollarSign, permission: 'finance' },
      { to: '/reports', label: 'Báo cáo', icon: BarChart3, permission: 'reports' },
    ],
  },
]

export const settingsItem = { to: '/settings', label: 'Cài đặt', icon: Settings, permission: 'settings' }
