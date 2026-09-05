export function generateProductCode(date = new Date(), suffix) {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const randomPart = suffix || crypto.randomUUID().replaceAll('-', '').slice(0, 6)
  return `SP-${datePart}-${randomPart.toUpperCase()}`
}
