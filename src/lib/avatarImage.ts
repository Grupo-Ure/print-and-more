/** Edge length (px) of the square avatar stored in the `avatars` bucket. */
const AVATAR_SIZE = 256
const JPEG_QUALITY = 0.9

/**
 * Centre-crops an image file to a square and scales it to the stored avatar
 * size, returning a JPEG blob. Resizing client-side keeps uploads tiny and
 * avoids Supabase's paid image-transformation API entirely.
 */
export async function resizeAvatarImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file')
  }

  let bitmap: ImageBitmap
  try {
    // 'from-image' applies the EXIF orientation, so phone photos land upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This image could not be read')
  }

  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This image could not be processed')
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    )
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob) throw new Error('This image could not be processed')
    return blob
  } finally {
    bitmap.close()
  }
}
