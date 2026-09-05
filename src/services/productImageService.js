import { supabase } from '../lib/supabase'

const BUCKET = 'product-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function validateProductImage(file) {
  if (!file) return
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG, WebP hoặc GIF.')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ảnh không được lớn hơn 5 MB.')
  }
}

export async function uploadProductImage(businessId, file) {
  if (!businessId) throw new Error('Không xác định được doanh nghiệp.')
  validateProductImage(file)

  const extension = EXTENSIONS[file.type]
  const path = `${businessId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })

  if (error) throw new Error(error.message || 'Không thể tải ảnh sản phẩm lên.')

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export async function removeProductImage(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('Không thể dọn ảnh sản phẩm vừa tải lên.', error)
}

export async function removeProductImageByUrl(businessId, imageUrl) {
  if (!businessId || !imageUrl) return
  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const pathname = new URL(imageUrl).pathname
    const markerIndex = pathname.indexOf(marker)
    if (markerIndex < 0) return
    const path = decodeURIComponent(pathname.slice(markerIndex + marker.length))
    if (!path.startsWith(`${businessId}/`)) return
    await removeProductImage(path)
  } catch {
    // External or malformed image URLs are not managed by this bucket.
  }
}
