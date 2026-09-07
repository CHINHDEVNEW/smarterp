/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, BadgeDollarSign, Boxes, Check, CircleAlert, Factory, Hammer, PackageCheck, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import Modal from '../common/Modal'
import Loading from '../common/Loading'
import { formatCurrency, formatDateTime, formatNumber } from '../../lib/formatters'

const costLabels = {
  labor: 'Nhân công',
  machine: 'Máy móc / điện / thiết bị',
  outsourcing: 'Gia công ngoài',
  other: 'Chi phí khác',
}
const statusLabels = {
  planned: { label: 'Đang chờ', className: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'Đang sản xuất', className: 'bg-sky-50 text-sky-700' },
  completed: { label: 'Đã hoàn tất', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700' },
}
const wasteLabels = { scrap: 'Phế phẩm', rework: 'Làm lại' }

function statusOf(value) {
  return statusLabels[value] ?? { label: value || 'Không rõ', className: 'bg-slate-100 text-slate-600' }
}

export default function ProductionOrderDetail({
  open,
  order,
  details,
  products,
  canManage,
  canManageCosts,
  onClose,
  onStatus,
  onIssue,
  onReturn,
  onReceive,
  onWaste,
  onAddCost,
}) {
  const [issueValues, setIssueValues] = useState({})
  const [returnValues, setReturnValues] = useState({})
  const [receiveQuantity, setReceiveQuantity] = useState('')
  const [receiveUnitCost, setReceiveUnitCost] = useState('')
  const [receiveNote, setReceiveNote] = useState('')
  const [wasteQuantity, setWasteQuantity] = useState('')
  const [wasteType, setWasteType] = useState('scrap')
  const [wasteProductId, setWasteProductId] = useState('')
  const [wasteUnitCost, setWasteUnitCost] = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [costType, setCostType] = useState('labor')
  const [costDescription, setCostDescription] = useState('')
  const [plannedAmount, setPlannedAmount] = useState('')
  const [actualAmount, setActualAmount] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setIssueValues({})
    setReturnValues({})
    setReceiveQuantity('')
    setReceiveUnitCost('')
    setReceiveNote('')
    setWasteQuantity('')
    setWasteType('scrap')
    setWasteProductId(order?.output_product_id ?? '')
    setWasteUnitCost('')
    setWasteReason('')
    setCostType('labor')
    setCostDescription('')
    setPlannedAmount('')
    setActualAmount('')
    setBusy('')
    setError('')
  }, [open, order])

  const materialRows = details?.materials ?? []
  const canAct = canManage && order && !['completed', 'cancelled'].includes(order.status)
  const consumedCost = materialRows.reduce((sum, row) => sum + (Number(row.issued_value) || 0) - (Number(row.returned_value) || 0), 0)
  const status = statusOf(order?.status)

  function updateMap(setter, id, value) {
    setter((current) => ({ ...current, [id]: value }))
  }

  async function run(action, callback, payload) {
    setError('')
    setBusy(action)
    try {
      await callback(payload)
      if (action === 'issue') setIssueValues({})
      if (action === 'return') setReturnValues({})
      if (action === 'receive') {
        setReceiveQuantity('')
        setReceiveUnitCost('')
        setReceiveNote('')
      }
      if (action === 'waste') {
        setWasteQuantity('')
        setWasteUnitCost('')
        setWasteReason('')
      }
      if (action === 'cost') {
        setCostDescription('')
        setPlannedAmount('')
        setActualAmount('')
      }
    } catch (actionError) {
      setError(actionError.message || 'Không thể thực hiện thao tác.')
    } finally {
      setBusy('')
    }
  }

  function submitIssue() {
    const items = materialRows.map((row) => ({ material_id: row.id, quantity: Number(issueValues[row.id]) || 0 })).filter((row) => row.quantity > 0)
    if (!items.length) return setError('Nhập số lượng cần xuất cho ít nhất một nguyên liệu.')
    run('issue', onIssue, items)
  }

  function submitReturn() {
    const items = materialRows.map((row) => ({ material_id: row.id, quantity: Number(returnValues[row.id]) || 0 })).filter((row) => row.quantity > 0)
    if (!items.length) return setError('Nhập số lượng cần trả cho ít nhất một nguyên liệu.')
    run('return', onReturn, items)
  }

  function submitReceive(event) {
    event.preventDefault()
    const quantity = Number(receiveQuantity) || 0
    if (quantity <= 0) return setError('Số lượng thành phẩm phải lớn hơn 0.')
    run('receive', onReceive, { quantity, unitCost: receiveUnitCost === '' ? null : Number(receiveUnitCost), note: receiveNote.trim() })
  }

  function submitWaste(event) {
    event.preventDefault()
    const quantity = Number(wasteQuantity) || 0
    if (quantity <= 0) return setError('Số lượng phế phẩm phải lớn hơn 0.')
    run('waste', onWaste, { quantity, wasteType, productId: wasteProductId || order.output_product_id, unitCost: wasteUnitCost === '' ? null : Number(wasteUnitCost), reason: wasteReason.trim() })
  }

  function submitCost(event) {
    event.preventDefault()
    if (!costDescription.trim()) return setError('Vui lòng nhập nội dung chi phí.')
    run('cost', onAddCost, { cost_type: costType, description: costDescription.trim(), planned_amount: Number(plannedAmount) || 0, actual_amount: Number(actualAmount) || 0 })
  }

  if (!order) return null

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={order.code}
      description={order.output_product_name + ' · Lệnh sản xuất'}
      size="lg"
      icon={Factory}
      tone="sky"
      badge="Chi tiết lệnh SX"
      footer={
        <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose} disabled={Boolean(busy)}>
          <X size={17} /> Đóng
        </button>
      }
    >
      {!details ? <div className="py-5"><Loading rows={6} /></div> : <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-start sm:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><span className={'rounded-full px-2.5 py-1 text-xs font-bold ' + status.className}>{status.label}</span>{order.bom_code && <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/75">{order.bom_code}</span>}</div><p className="mt-3 text-sm text-white/70">Thành phẩm</p><p className="mt-1 text-lg font-extrabold">{order.output_product_name} <span className="text-sm font-semibold text-white/60">· {order.output_unit}</span></p></div>
          {canManage && <div className="flex flex-wrap gap-2">{order.status === 'planned' && <button className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20" type="button" onClick={() => run('status', onStatus, 'in_progress')} disabled={Boolean(busy)}><Factory size={16} /> Bắt đầu</button>}{['planned', 'in_progress'].includes(order.status) && <button className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20" type="button" onClick={() => run('status', onStatus, 'completed')} disabled={Boolean(busy) || Number(order.actual_quantity) <= 0}><Check size={16} /> Hoàn tất</button>}{['planned', 'in_progress'].includes(order.status) && <button className="btn-secondary border-rose-300/30 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20" type="button" onClick={() => run('status', onStatus, 'cancelled')} disabled={Boolean(busy)}><Trash2 size={16} /> Hủy lệnh</button>}</div>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Kế hoạch" value={formatNumber(order.planned_quantity) + ' ' + order.output_unit} />
          <Metric label="Đã nhập" value={formatNumber(order.actual_quantity) + ' ' + order.output_unit} tone="emerald" />
          <Metric label="Phế phẩm" value={formatNumber(order.scrapped_quantity) + ' ' + order.output_unit} tone={Number(order.scrapped_quantity) > 0 ? 'rose' : 'slate'} />
          <Metric label="Giá thành thực tế" value={formatCurrency(order.actual_unit_cost)} tone="sky" />
        </div>

        <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 className="form-section-title"><Boxes size={18} /> Nguyên vật liệu dự kiến và thực tế</h3><p className="section-description">Xuất kho làm tăng tiêu hao; trả lại sẽ giảm tiêu hao thực tế.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{formatCurrency(consumedCost)}</span></div>
          {!materialRows.length ? <p className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Lệnh này chưa có nguyên vật liệu dự kiến.</p> : <div className="mt-4 space-y-3">{materialRows.map((row) => { const remaining = Number(row.issued_quantity) - Number(row.returned_quantity); return <div className="rounded-xl bg-slate-50 p-3" key={row.id}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{row.product_name}</p><p className="mt-1 text-xs text-slate-400">{row.product_code || 'Chưa có mã'} · {row.unit}</p></div><p className="shrink-0 text-xs font-bold text-slate-600">Dùng {formatNumber(remaining)} / {formatNumber(row.planned_quantity)}</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><SmallStat label="Dự kiến" value={formatNumber(row.planned_quantity)} /><SmallStat label="Đã xuất" value={formatNumber(row.issued_quantity)} /><SmallStat label="Đã trả" value={formatNumber(row.returned_quantity)} /></div>{canAct && <div className="mt-3 grid gap-2 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold text-slate-500">Xuất thêm</span><input className="field text-right" type="number" min="0" step="0.001" value={issueValues[row.id] ?? ''} onChange={(event) => updateMap(setIssueValues, row.id, event.target.value)} placeholder="0" disabled={Boolean(busy)} /></label><label><span className="mb-1 block text-xs font-semibold text-slate-500">Trả lại</span><input className="field text-right" type="number" min="0" max={remaining} step="0.001" value={returnValues[row.id] ?? ''} onChange={(event) => updateMap(setReturnValues, row.id, event.target.value)} placeholder="0" disabled={Boolean(busy) || remaining <= 0} /></label></div>}</div> })}</div>}
          {canAct && materialRows.length > 0 && <div className="mt-4 flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={submitIssue} disabled={Boolean(busy)}><ArrowUpFromLine size={16} /> {busy === 'issue' ? 'Đang xuất...' : 'Xuất nguyên liệu'}</button><button className="btn-secondary" type="button" onClick={submitReturn} disabled={Boolean(busy)}><ArrowDownToLine size={16} /> {busy === 'return' ? 'Đang trả...' : 'Trả nguyên liệu thừa'}</button></div>}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="form-section-title"><PackageCheck size={18} /> Nhập thành phẩm</h3><p className="section-description">Có thể nhập nhiều đợt. Hệ thống tự cập nhật giá thành bình quân theo chi phí thực tế của lệnh.</p>{canAct ? <form className="mt-4 space-y-3" onSubmit={submitReceive}><Field label={'Số lượng (' + order.output_unit + ')'}><input className="field" type="number" min="0.001" step="0.001" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} placeholder="0" disabled={Boolean(busy)} /></Field><Field label="Giá thành bình quân (tùy chọn)"><input className="field" type="number" min="0" step="1" value={receiveUnitCost} onChange={(event) => setReceiveUnitCost(event.target.value)} placeholder="Để trống để hệ thống tự tính" disabled={Boolean(busy)} /><span className="mt-1 block text-[11px] leading-4 text-slate-400">Nếu nhập, mức này áp dụng cho toàn bộ thành phẩm đã nhập của lệnh tại thời điểm hiện tại.</span></Field><Field label="Ghi chú"><input className="field" value={receiveNote} onChange={(event) => setReceiveNote(event.target.value)} placeholder="Ví dụ: Nhập đợt 1" disabled={Boolean(busy)} /></Field><button className="btn-primary w-full" type="submit" disabled={Boolean(busy)}><Save size={16} /> {busy === 'receive' ? 'Đang nhập...' : 'Ghi nhận nhập thành phẩm'}</button></form> : <p className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Lệnh đã kết thúc, không thể nhập thêm.</p>}</article>
          <article className="rounded-2xl border border-slate-200 p-4 sm:p-5"><h3 className="form-section-title"><CircleAlert size={18} /> Phế phẩm / làm lại</h3><p className="section-description">Ghi nhận để theo dõi tỷ lệ hao hụt và nguyên nhân, không tự cộng lại tồn kho.</p>{canAct ? <form className="mt-4 space-y-3" onSubmit={submitWaste}><div className="grid grid-cols-2 gap-2"><Field label="Loại"><select className="field" value={wasteType} onChange={(event) => setWasteType(event.target.value)} disabled={Boolean(busy)}><option value="scrap">Phế phẩm</option><option value="rework">Làm lại</option></select></Field><Field label={'Số lượng (' + order.output_unit + ')'}><input className="field" type="number" min="0.001" step="0.001" value={wasteQuantity} onChange={(event) => setWasteQuantity(event.target.value)} placeholder="0" disabled={Boolean(busy)} /></Field></div><Field label="Sản phẩm ghi nhận"><select className="field" value={wasteProductId} onChange={(event) => setWasteProductId(event.target.value)} disabled={Boolean(busy)}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.unit}</option>)}</select></Field><Field label="Giá vốn đơn vị (tùy chọn)"><input className="field" type="number" min="0" step="1" value={wasteUnitCost} onChange={(event) => setWasteUnitCost(event.target.value)} placeholder="Lấy giá vốn sản phẩm" disabled={Boolean(busy)} /></Field><Field label="Nguyên nhân"><input className="field" value={wasteReason} onChange={(event) => setWasteReason(event.target.value)} placeholder="Ví dụ: Sai kích thước" disabled={Boolean(busy)} /></Field><button className="btn-secondary w-full" type="submit" disabled={Boolean(busy)}><CircleAlert size={16} /> {busy === 'waste' ? 'Đang lưu...' : 'Ghi nhận phế phẩm'}</button></form> : <p className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Lệnh đã kết thúc, không thể ghi thêm.</p>}</article>
        </section>

        <section className="rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="form-section-title"><BadgeDollarSign size={18} /> Chi phí sản xuất</h3><p className="section-description">Theo dõi nhân công, máy móc/điện/thiết bị, gia công ngoài và khoản khác.</p></div><span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">{formatCurrency(order.actual_total_cost)}</span></div>{canManageCosts && order.status !== 'cancelled' && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitCost}><Field label="Loại chi phí"><select className="field" value={costType} onChange={(event) => setCostType(event.target.value)} disabled={Boolean(busy)}>{Object.entries(costLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></Field><Field label="Nội dung" required><input className="field" value={costDescription} onChange={(event) => setCostDescription(event.target.value)} placeholder="Ví dụ: Ca sản xuất tháng này" disabled={Boolean(busy)} /></Field><Field label="Dự kiến"><input className="field" type="number" min="0" step="1" value={plannedAmount} onChange={(event) => setPlannedAmount(event.target.value)} placeholder="0" disabled={Boolean(busy)} /></Field><Field label="Thực tế"><input className="field" type="number" min="0" step="1" value={actualAmount} onChange={(event) => setActualAmount(event.target.value)} placeholder="0" disabled={Boolean(busy)} /></Field><button className="btn-secondary sm:col-span-2" type="submit" disabled={Boolean(busy)}><Plus size={16} /> {busy === 'cost' ? 'Đang lưu...' : 'Thêm khoản chi phí'}</button></form>}{(details?.costs ?? []).length > 0 && <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">{details.costs.map((cost) => <div className="flex items-center gap-3 p-3" key={cost.id}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600"><Hammer size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{cost.description}</p><p className="mt-1 text-xs text-slate-400">{costLabels[cost.cost_type] || cost.cost_type} · {formatDateTime(cost.created_at)}</p></div><div className="text-right text-xs"><p className="text-slate-400">KH {formatCurrency(cost.planned_amount)}</p><p className="mt-1 font-extrabold text-slate-800">TT {formatCurrency(cost.actual_amount)}</p></div></div>)}</div>}</section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ComparisonCard order={order} />
          <HistoryCard details={details} order={order} />
        </section>

        {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"><CircleAlert className="mt-0.5 shrink-0" size={17} /> {error}</div>}
      </div>}
    </Modal>
  )
}

function ComparisonCard({ order }) {
  const rows = [
    ['Nguyên vật liệu', order.planned_material_cost, order.actual_material_cost],
    ['Nhân công', order.planned_labor_cost, order.actual_labor_cost],
    ['Máy móc / thiết bị', order.planned_machine_cost, order.actual_machine_cost],
    ['Gia công ngoài', order.planned_outsourcing_cost, order.actual_outsourcing_cost],
    ['Chi phí khác', order.planned_other_cost, order.actual_other_cost],
  ]
  return <article className="rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><RotateCcw size={17} /></span><div><h3 className="form-section-title mb-0">So sánh dự kiến / thực tế</h3><p className="section-description">Chênh lệch dương là vượt dự toán.</p></div></div><div className="mt-4 divide-y divide-slate-100">{rows.map(([label, planned, actual]) => <div className="flex items-center justify-between gap-3 py-2.5 text-xs" key={label}><span className="text-slate-500">{label}</span><span className="text-right"><span className="font-semibold text-slate-400">{formatCurrency(planned)}</span><span className="mx-1 text-slate-300">→</span><span className="font-extrabold text-slate-800">{formatCurrency(actual)}</span></span></div>)}<div className="flex items-center justify-between gap-3 pt-3 text-sm"><span className="font-bold text-slate-700">Tổng giá thành</span><span className={(Number(order.cost_variance) > 0 ? 'text-rose-600' : Number(order.cost_variance) < 0 ? 'text-emerald-600' : 'text-slate-800') + ' font-extrabold'}>{formatCurrency(order.actual_total_cost)} <span className="text-xs font-semibold text-slate-400">({Number(order.cost_variance) > 0 ? '+' : ''}{formatCurrency(order.cost_variance)})</span></span></div></div></article>
}

function HistoryCard({ details, order }) {
  return <article className="rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-600"><Factory size={17} /></span><div><h3 className="form-section-title mb-0">Nhật ký sản xuất</h3><p className="section-description">Các lần nhập thành phẩm và ghi nhận phế phẩm.</p></div></div><div className="mt-4 space-y-2">{(details?.outputs ?? []).slice(0, 4).map((row) => <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs" key={row.id}><span className="font-semibold text-emerald-800">Nhập {formatNumber(row.quantity)} {order.output_unit}</span><span className="text-emerald-700">{formatDateTime(row.created_at)}</span></div>)}{(details?.wastes ?? []).slice(0, 4).map((row) => <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs" key={row.id}><span className="font-semibold text-rose-800">{wasteLabels[row.waste_type] || 'Ghi nhận'} {formatNumber(row.quantity)} {row.unit || order.output_unit}</span><span className="text-rose-700">{formatDateTime(row.created_at)}</span></div>)}{!(details?.outputs?.length || details?.wastes?.length) && <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">Chưa có nhật ký phát sinh.</p>}</div></article>
}

function Metric({ label, value, tone = 'slate' }) {
  const classes = { slate: 'bg-slate-50 text-slate-800', sky: 'bg-sky-50 text-sky-700', emerald: 'bg-emerald-50 text-emerald-700', rose: 'bg-rose-50 text-rose-700' }
  return <div className={'rounded-xl px-3 py-3 ' + classes[tone]}><p className="truncate text-[11px] font-semibold opacity-70">{label}</p><p className="mt-1 truncate text-sm font-extrabold">{value}</p></div>
}

function SmallStat({ label, value }) {
  return <div className="rounded-lg bg-white px-2 py-2"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-xs font-extrabold text-slate-700">{value}</p></div>
}

function Field({ label, required = false, children }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}{required && <span className="text-rose-500"> *</span>}</span>{children}</label>
}
