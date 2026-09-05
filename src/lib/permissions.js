const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: ['*'],
  manager: ['dashboard', 'products', 'products_manage', 'customers', 'sales', 'pos', 'purchases', 'suppliers', 'inventory', 'quotes', 'returns', 'finance', 'reports'],
  sales: ['dashboard', 'products', 'customers', 'sales', 'pos', 'quotes', 'returns', 'reports'],
  staff: ['dashboard', 'products', 'customers', 'sales', 'pos', 'quotes', 'reports'],
  member: ['dashboard', 'products', 'customers', 'sales', 'pos', 'quotes', 'reports'],
  warehouse: ['dashboard', 'products', 'products_manage', 'purchases', 'suppliers', 'inventory', 'returns', 'reports'],
  purchasing: ['dashboard', 'products', 'products_manage', 'purchases', 'suppliers', 'returns', 'reports'],
  accountant: ['dashboard', 'products', 'finance', 'reports'],
}

export function canAccess(role, permission) {
  if (!permission) return true
  const permissions = ROLE_PERMISSIONS[String(role || '').toLowerCase()] ?? []
  return permissions.includes('*') || permissions.includes(permission)
}
