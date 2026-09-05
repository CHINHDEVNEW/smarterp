const DEFAULT_CURRENCY = 'VND'
let currencyCode = DEFAULT_CURRENCY
let moneyDecimals = 0
let currencySymbol = '₫'
let currencyFormatter = createCurrencyFormatter()

function createCurrencyFormatter() {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'code',
    minimumFractionDigits: moneyDecimals,
    maximumFractionDigits: moneyDecimals,
  })
}

export function setCurrencySettings(settings = {}) {
  const nextCode = String(settings.currency_code ?? settings.currencyCode ?? DEFAULT_CURRENCY).toUpperCase()
  const nextDecimals = Number(settings.money_decimals ?? settings.moneyDecimals ?? 0)
  currencyCode = /^[A-Z]{3}$/.test(nextCode) ? nextCode : DEFAULT_CURRENCY
  moneyDecimals = Number.isInteger(nextDecimals) ? Math.min(3, Math.max(0, nextDecimals)) : 0
  currencySymbol = String(settings.currency_symbol ?? settings.currencySymbol ?? (currencyCode === DEFAULT_CURRENCY ? '₫' : currencyCode)).trim() || currencyCode
  try {
    currencyFormatter = createCurrencyFormatter()
  } catch {
    currencyCode = DEFAULT_CURRENCY
    moneyDecimals = 0
    currencySymbol = '₫'
    currencyFormatter = createCurrencyFormatter()
  }
}

export const numberFormatter = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 3,
})

export const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0).replace(currencyCode, currencySymbol)
}

export function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateTimeFormatter.format(date)
}

export function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
