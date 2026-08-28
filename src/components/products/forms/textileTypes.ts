/** Textile product types for the type dropdown + table labels. One type only. */

import type { TextileMotifRow } from '../../../types/textile'

export const TEXTILE_ALL_TYPES = ['TEXTILE_GARMENT'] as const

export const TEXTILE_ALL_LABELS: Record<string, string> = {
  TEXTILE_GARMENT: 'Garment',
}

/** A design's display label (text content, or a graphic marker). */
export function motifLabel(motif: TextileMotifRow): string {
  if (motif.type === 'TEXT') return motif.content?.trim() ? `“${motif.content}”` : 'Text design'
  return 'Graphic design'
}
