import { supabase } from '../lib/supabase'
import { listFinanceData } from './financeService'
import { listInventoryData } from './inventoryService'
import { listPurchaseOrders } from './purchaseService'
import { listReturns } from './returnService'
import { listSalesOrders } from './salesService'

const SALES_ITEM_FIELDS = 'id, business_id, sales_order_id, product_id, product_code, product_name, unit, quantity, unit_price, unit_cost, line_total'

function throwIfError(error, fallback) {
  if (error) throw new Error(error.message || fallback)
}

export async function getReportData(businessId) {
  const [sales, purchases, finance, inventory, returns, salesItemsResult, salesReturnItemsResult] = await Promise.all([
    listSalesOrders(businessId),
    listPurchaseOrders(businessId),
    listFinanceData(businessId),
    listInventoryData(businessId),
    listReturns(businessId),
    supabase.from('sales_order_items').select(SALES_ITEM_FIELDS).eq('business_id', businessId).limit(5000),
    supabase.from('sales_return_items').select('*').eq('business_id', businessId).limit(5000),
  ])

  throwIfError(salesItemsResult.error, 'Không tải được chi tiết đơn bán.')
  throwIfError(salesReturnItemsResult.error, 'Không tải được chi tiết hàng bán trả lại.')
  return {
    sales,
    purchases,
    finance,
    inventory,
    returns,
    salesItems: salesItemsResult.data ?? [],
    salesReturnItems: salesReturnItemsResult.data ?? [],
  }
}
