/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { Ban, ClipboardCheck, Package } from 'lucide-react'
import Modal from '../common/Modal'
import Loading from '../common/Loading'
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/formatters'
import { listStocktakeItems } from '../../services/inventoryService'
import CancelDocumentModal from '../common/CancelDocumentModal'

function itemValue(item, names, fallback = null) {
  for (const name of names) {
    if (item?.[name] !== undefined && item?.[name] !== null && item?.[name] !== '') return item[name]
  }
  return fallback
}

function stocktakeValue(stocktake, names, fallback = null) {
  return itemValue(stocktake, names, fallback)
}

export default function StocktakeDetail({ open, stocktake, businessId, onClose, onCancel }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    if (!open || !stocktake?.id || !businessId) return undefined
    let active = true
    setLoading(true)
    setError('')
    listStocktakeItems(businessId, stocktake.id)
      .then((rows) => { if (active) setItems(rows) })
      .catch((loadError) => { if (active) setError(loadError.message || 'Không tải được chi tiết phiếu kiểm kê.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [businessId, open, stocktake])

  if (!stocktake) return null
  const code = stocktakeValue(stocktake, ['code', 'stocktake_code', 'stocktake_number'], 'Phiếu kiểm kê')
  const date = stocktakeValue(stocktake, ['stocktake_date', 'date', 'document_date', 'created_at'])
  const totalItems = stocktakeValue(stocktake, ['total_items', 'item_count', 'total_products'], items.length)
  const difference = stocktakeValue(stocktake, ['total_difference_quantity', 'difference_quantity', 'total_difference'], 0)
  const differenceValue = stocktakeValue(stocktake, ['total_difference_value', 'difference_value', 'total_adjustment_value'], 0)

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={String(code)}
      description="Chi tiết tồn hệ thống, tồn thực tế và chênh lệch của phiếu."
      size="lg"
      icon={ClipboardCheck}
      tone="sky"
      badge="Chi tiết kiểm kê"
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          {!stocktake.cancelled_at && (
            <button className="btn-danger flex-1 sm:flex-initial" type="button" onClick={() => setCancelOpen(true)}>
              <Ban size={17} />
              <span>Hủy phiếu</span>
            </button>
          )}
          <button className="btn-primary flex-1 sm:flex-initial" type="button" onClick={onClose}>
            Đóng
          </button>
        </div>
      }
    >
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary label="Ngày kiểm kê" value={date ? formatDateTime(date) : '—'} /><Summary label="Mặt hàng" value={formatNumber(totalItems)} /><Summary label="Chênh lệch SL" value={(Number(difference) > 0 ? '+' : '') + formatNumber(difference)} tone={Number(difference) < 0 ? 'rose' : Number(difference) > 0 ? 'emerald' : 'slate'} /><Summary label="Giá trị chênh lệch" value={(Number(differenceValue) > 0 ? '+' : '') + formatCurrency(differenceValue)} tone={Number(differenceValue) < 0 ? 'rose' : Number(differenceValue) > 0 ? 'emerald' : 'slate'} /></div>
    {stocktake.note && <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><span className="font-semibold text-slate-800">Ghi chú:</span> {stocktake.note}</div>}
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : loading ? <Loading rows={4} /> : !items.length ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">Phiếu chưa có chi tiết sản phẩm.</div> : <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{items.map((item) => { const systemQuantity = Number(itemValue(item, ['system_quantity', 'book_quantity', 'expected_quantity', 'quantity_before'], 0)) || 0; const actualQuantity = Number(itemValue(item, ['actual_quantity', 'counted_quantity', 'counted_stock'], 0)) || 0; const itemDifference = Number(itemValue(item, ['difference', 'difference_quantity', 'quantity_difference'], actualQuantity - systemQuantity)) || 0; const unit = itemValue(item, ['unit'], ''); const unitCost = Number(itemValue(item, ['unit_cost', 'cost_price'], 0)) || 0; const name = itemValue(item, ['product_name', 'name'], 'Sản phẩm'); const codeValue = itemValue(item, ['product_code', 'code', 'sku'], ''); return <div className="p-4" key={item.id || item.product_id}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600"><Package size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{name}</p><p className="mt-1 truncate text-xs text-slate-400">{codeValue || 'Chưa có mã'} · {unit}</p></div><span className={(itemDifference === 0 ? 'bg-slate-100 text-slate-500' : itemDifference > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') + ' shrink-0 rounded-full px-2 py-1 text-xs font-bold'}>{itemDifference === 0 ? 'Khớp' : (itemDifference > 0 ? '+' : '−') + ' ' + formatNumber(Math.abs(itemDifference))}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-[10px] text-slate-400">Hệ thống</p><p className="mt-1 text-sm font-extrabold text-slate-700">{formatNumber(systemQuantity)}</p></div><div className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-[10px] text-slate-400">Thực tế</p><p className="mt-1 text-sm font-extrabold text-slate-900">{formatNumber(actualQuantity)}</p></div><div className="rounded-xl bg-slate-50 px-2 py-2"><p className="text-[10px] text-slate-400">Giá trị lệch</p><p className={(itemDifference < 0 ? 'text-rose-600' : itemDifference > 0 ? 'text-emerald-600' : 'text-slate-500') + ' mt-1 text-sm font-extrabold'}>{formatCurrency(itemDifference * unitCost)}</p></div></div></div> })}</div>}
    </Modal>
    <CancelDocumentModal
      open={cancelOpen}
      title={`Hủy ${String(code)}?`}
      description="Chênh lệch tồn kho của phiếu này sẽ được đảo tự động."
      onClose={() => setCancelOpen(false)}
      onConfirm={async (reason) => {
        await onCancel(reason)
        setCancelOpen(false)
      }}
    />
    </>
  )
}

function Summary({ label, value, tone = 'slate' }) {
  const tones = { slate: 'bg-slate-50 text-slate-900', emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-700' }
  return <div className={'rounded-xl px-3 py-3 ' + tones[tone]}><p className="truncate text-[11px] font-semibold opacity-70">{label}</p><p className="mt-1 truncate text-sm font-extrabold">{value}</p></div>
}
