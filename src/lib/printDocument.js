function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function printDocument({ title, subtitle, details = [], columns, rows, totals = [], note }) {
  const popup = window.open('', '_blank', 'width=900,height=700')
  if (!popup) throw new Error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép popup rồi thử lại.')
  popup.opener = null
  const detailsHtml = details.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')
  const headers = columns.map((column) => `<th class="${column.align === 'right' ? 'right' : ''}">${escapeHtml(column.label)}</th>`).join('')
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td class="${column.align === 'right' ? 'right' : ''}">${escapeHtml(row[column.key])}</td>`).join('')}</tr>`).join('')
  const totalsHtml = totals.map(([label, value, strong]) => `<div class="total ${strong ? 'strong' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('')
  popup.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#0f172a;margin:0}h1{font-size:24px;margin:0 0 6px}p{color:#64748b;margin:0}.details{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.details div{border:1px solid #e2e8f0;border-radius:8px;padding:10px}.details span{display:block;color:#64748b;font-size:11px;margin-bottom:5px}.details strong{font-size:13px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border-bottom:1px solid #e2e8f0;padding:10px 8px;text-align:left}th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}.right{text-align:right}.summary{width:340px;margin:22px 0 0 auto}.total{display:flex;justify-content:space-between;padding:5px 0}.total.strong{border-top:1px solid #cbd5e1;margin-top:5px;padding-top:10px;font-size:16px;font-weight:700}.note{margin-top:20px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap}.footer{margin-top:32px;text-align:center;color:#94a3b8;font-size:11px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><section class="details">${detailsHtml}</section><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><section class="summary">${totalsHtml}</section>${note ? `<div class="note"><strong>Ghi chú:</strong> ${escapeHtml(note)}</div>` : ''}<div class="footer">In từ SmartERP</div><script>window.addEventListener('load',()=>{window.print()})</script></body></html>`)
  popup.document.close()
}
