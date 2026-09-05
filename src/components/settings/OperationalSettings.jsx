/* oxlint-disable react/set-state-in-effect */
import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Save, SlidersHorizontal } from 'lucide-react'
import Loading from '../common/Loading'
import useBusiness from '../../hooks/useBusiness'
import { setCurrencySettings } from '../../lib/formatters'
import { getAppSettings, listDocumentSequences, updateAppSettings, updateDocumentSequence } from '../../services/settingsService'

const defaultSettings = { currency_code: 'VND', currency_symbol: '₫', money_decimals: '0', default_vat: '0', allow_negative_stock: false }
const entityLabels = {
  customer: 'Khách hàng',
  finance_in: 'Phiếu thu',
  finance_out: 'Phiếu chi',
  product: 'Sản phẩm',
  purchase_order: 'Phiếu nhập',
  purchase_return: 'Trả hàng nhập',
  quote: 'Báo giá',
  sales_order: 'Đơn bán',
  sales_return: 'Trả hàng bán',
  stocktake: 'Kiểm kê',
  supplier: 'Nhà cung cấp',
}

export default function OperationalSettings({ businessId, showToast }) {
  const { refresh } = useBusiness()
  const [settings, setSettings] = useState(defaultSettings)
  const [sequences, setSequences] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!businessId) return
    let active = true
    setLoading(true)
    setError('')
    Promise.all([getAppSettings(businessId), listDocumentSequences(businessId)])
      .then(([settingsData, sequenceRows]) => {
        if (!active) return
        const nextSettings = { ...defaultSettings, ...(settingsData ?? {}) }
        setSettings({
          ...nextSettings,
          money_decimals: String(nextSettings.money_decimals ?? 0),
          default_vat: String(nextSettings.default_vat ?? 0),
          allow_negative_stock: Boolean(nextSettings.allow_negative_stock),
        })
        setSequences(sequenceRows.map((sequence) => ({ ...sequence, prefix: sequence.prefix ?? '', padding: sequence.padding ?? 4 })))
        setCurrencySettings(nextSettings)
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Không tải được cài đặt vận hành.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [businessId])

  function updateSetting(field, value) {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  function updateSequence(id, field, value) {
    setSequences((current) => current.map((sequence) => sequence.id === id ? { ...sequence, [field]: value } : sequence))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    const decimals = Number(settings.money_decimals)
    const vat = Number(settings.default_vat)
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 3) return setError('Số chữ số thập phân phải từ 0 đến 3.')
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) return setError('VAT mặc định phải từ 0 đến 100%.')
    if (sequences.some((sequence) => !String(sequence.prefix ?? '').trim() || !Number.isInteger(Number(sequence.padding)) || Number(sequence.padding) < 1 || Number(sequence.padding) > 8)) return setError('Tiền tố không được để trống và độ dài số phải từ 1 đến 8.')

    setSaving(true)
    try {
      const savedSettings = await updateAppSettings(businessId, {
        currency_code: String(settings.currency_code || 'VND').toUpperCase(),
        currency_symbol: String(settings.currency_symbol || '').trim() || null,
        money_decimals: decimals,
        default_vat: vat,
        allow_negative_stock: Boolean(settings.allow_negative_stock),
      })
      const savedSequences = await Promise.all(sequences.map((sequence) => updateDocumentSequence(businessId, sequence.id, { prefix: String(sequence.prefix).trim(), padding: Number(sequence.padding) })))
      setSettings((current) => ({ ...current, ...savedSettings, money_decimals: String(savedSettings.money_decimals ?? decimals), default_vat: String(savedSettings.default_vat ?? vat), allow_negative_stock: Boolean(savedSettings.allow_negative_stock) }))
      setSequences(savedSequences)
      setCurrencySettings(savedSettings)
      await refresh()
      showToast('Đã lưu cài đặt vận hành.')
    } catch (saveError) {
      setError(saveError.message || 'Không thể lưu cài đặt vận hành.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="surface p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><SlidersHorizontal size={19} /></span><div><h2 className="section-title">Cài đặt vận hành</h2><p className="section-description">Thiết lập cách SmartERP tính tiền, VAT, tồn kho và đánh số chứng từ.</p></div></div>{loading ? <div className="mt-6"><Loading rows={5} /></div> : <form className="mt-6" onSubmit={submit}><div className="form-grid"><Field label="Loại tiền"><select className="field" value={settings.currency_code} onChange={(event) => updateSetting('currency_code', event.target.value)} disabled={saving}><option value="VND">VND — Việt Nam</option><option value="USD">USD — Đô la Mỹ</option><option value="EUR">EUR — Euro</option><option value="JPY">JPY — Yên Nhật</option><option value="KRW">KRW — Won Hàn Quốc</option></select></Field><Field label="Ký hiệu tiền"><input className="field" value={settings.currency_symbol} onChange={(event) => updateSetting('currency_symbol', event.target.value)} placeholder="₫" maxLength="5" disabled={saving} /></Field><Field label="Số chữ số thập phân"><input className="field" type="number" min="0" max="3" step="1" value={settings.money_decimals} onChange={(event) => updateSetting('money_decimals', event.target.value)} disabled={saving} /></Field><Field label="VAT mặc định (%)"><input className="field" type="number" min="0" max="100" step="0.1" value={settings.default_vat} onChange={(event) => updateSetting('default_vat', event.target.value)} disabled={saving} /></Field></div><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><input className="mt-1 size-4 accent-amber-600" type="checkbox" checked={settings.allow_negative_stock} onChange={(event) => updateSetting('allow_negative_stock', event.target.checked)} disabled={saving} /><span><span className="block text-sm font-bold text-amber-900">Cho phép bán âm kho</span><span className="mt-1 block text-xs leading-5 text-amber-800/80">Khi bật, đơn bán vẫn được xác nhận dù tồn hiện tại thấp hơn số lượng bán. Chỉ nên bật khi cửa hàng có quy trình đối soát riêng.</span></span></label><div className="mt-7 border-t border-slate-100 pt-6"><div className="mb-3 flex items-start gap-3"><div><h3 className="form-section-title mb-0">Tiền tố chứng từ</h3><p className="mt-1 text-xs text-slate-400">Đổi phần đầu mã; số thứ tự hiện tại vẫn được giữ nguyên.</p></div></div>{sequences.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">Chưa có cấu hình tiền tố chứng từ.</div> : <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{sequences.map((sequence) => <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_140px_110px] sm:items-end" key={sequence.id}><Field label={entityLabels[sequence.entity] || sequence.entity}><input className="field" value={sequence.prefix ?? ''} onChange={(event) => updateSequence(sequence.id, 'prefix', event.target.value)} disabled={saving} /></Field><Field label="Độ dài số"><input className="field" type="number" min="1" max="8" step="1" value={sequence.padding ?? 4} onChange={(event) => updateSequence(sequence.id, 'padding', event.target.value)} disabled={saving} /></Field><div className="flex items-center gap-2 pb-2 text-xs text-slate-400"><Check size={15} className="text-emerald-500" /> Đang dùng</div></div>)}</div>}</div>{error && <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"><AlertTriangle className="mt-0.5 shrink-0" size={17} /> <span>{error}</span></div>}<div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><button className="btn-primary" type="submit" disabled={saving}><Save size={17} /> {saving ? 'Đang lưu...' : 'Lưu cài đặt vận hành'}</button></div></form>}</section>
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}
