// Shared by the functions that name a product to someone outside the app: the
// approval mails (send-email) and the customer's approval page
// (customer-approval). The app's own labels live in the renderer, out of
// reach here.

/** The product type as words: TRODAT_PRINTY → "Trodat printy". */
export function productLabel(type: string): string {
  const words = type.toLowerCase().split('_').filter(word => word !== '')
  if (words.length === 0) return 'product'
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '')
}
