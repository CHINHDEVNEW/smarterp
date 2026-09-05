import { supabase } from '../lib/supabase'
import { localDateKey } from '../lib/formatters'

function assertResult(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }
  return result.data ?? []
}

async function fetchTopProductLines(businessId) {
  const direct = await supabase
    .from('sales_order_items')
    .select(`
      product_id,
      product_name,
      quantity,
      line_total,
      sales_orders!inner (status)
    `)
    .eq('business_id', businessId)
    .not('sales_orders.status', 'in', '(cancelled,draft)')
    .limit(5000)

  if (!direct.error) return direct.data ?? []

  const related = await supabase
    .from('sales_order_items')
    .select(`
      product_id,
      product_name,
      quantity,
      line_total,
      sales_orders!inner (business_id, status)
    `)
    .eq('sales_orders.business_id', businessId)
    .neq('sales_orders.status', 'cancelled')
    .limit(5000)

  return assertResult(related, 'Không tải được sản phẩm bán chạy')
}

async function fetchReturnedProductLines(businessId) {
  const result = await supabase
    .from('sales_return_items')
    .select(`
      product_id,
      product_name,
      quantity,
      line_total,
      net_line_total,
      sales_returns!inner (status)
    `)
    .eq('business_id', businessId)
    .not('sales_returns.status', 'in', '(cancelled,canceled,draft)')
    .limit(5000)

  return assertResult(result, 'Không tải được hàng bán trả lại')
}

export async function getDashboardData(businessId) {
  const today = localDateKey()

  const [todayResult, todayReturnsResult, debtResult, productsResult, recentResult, topLines, returnedLines] = await Promise.all([
    supabase
      .from('v_app_sales_orders')
      .select('id, code, order_date, status, total, net_total, balance_due, channel')
      .eq('business_id', businessId)
      .eq('order_date', today)
      .not('status', 'in', '(cancelled,draft)'),
    supabase
      .from('sales_returns')
      .select('net_total, total')
      .eq('business_id', businessId)
      .eq('return_date', today)
      .not('status', 'in', '(cancelled,canceled,draft)'),
    supabase
      .from('v_app_sales_orders')
      .select('balance_due')
      .eq('business_id', businessId)
      .gt('balance_due', 0)
      .not('status', 'in', '(cancelled,draft)'),
    supabase
      .from('products')
      .select('id, code, sku, name, unit, product_type, stock_on_hand, min_stock, active')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('stock_on_hand', { ascending: true }),
    supabase
      .from('v_app_sales_orders')
      .select('id, code, order_date, status, total, net_total, balance_due, channel')
      .eq('business_id', businessId)
      .order('order_date', { ascending: false })
      .limit(7),
    fetchTopProductLines(businessId),
    fetchReturnedProductLines(businessId),
  ])

  const todayOrders = assertResult(todayResult, 'Không tải được doanh thu hôm nay')
  const todayReturns = assertResult(todayReturnsResult, 'Không tải được hàng trả hôm nay')
  const receivables = assertResult(debtResult, 'Không tải được công nợ phải thu')
  const products = assertResult(productsResult, 'Không tải được dữ liệu tồn kho')
  const recentOrders = assertResult(recentResult, 'Không tải được giao dịch gần đây')

  const physicalProducts = products.filter((product) => product.product_type !== 'service')
  const lowStock = physicalProducts.filter(
    (product) => Number(product.stock_on_hand) <= Number(product.min_stock),
  )

  const rankedProducts = new Map()
  topLines.forEach((line) => {
    const key = line.product_id ?? line.product_name
    const current = rankedProducts.get(key) ?? {
      id: key,
      name: line.product_name || 'Sản phẩm',
      quantity: 0,
      revenue: 0,
    }
    current.quantity += Number(line.quantity) || 0
    current.revenue += Number(line.line_total) || 0
    rankedProducts.set(key, current)
  })
  returnedLines.forEach((line) => {
    const key = line.product_id ?? line.product_name
    const current = rankedProducts.get(key)
    if (!current) return
    current.quantity -= Number(line.quantity) || 0
    current.revenue -= Number(line.net_line_total ?? line.line_total) || 0
  })

  return {
    revenueToday: todayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
      - todayReturns.reduce((sum, row) => sum + (Number(row.net_total ?? row.total) || 0), 0),
    ordersToday: todayOrders.length,
    receivable: receivables.reduce((sum, order) => sum + (Number(order.balance_due) || 0), 0),
    lowStock,
    topProducts: [...rankedProducts.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5),
    recentOrders: recentOrders.map((order) => ({ ...order, total: order.net_total ?? order.total })),
  }
}
