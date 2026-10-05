import { useCallback, useEffect } from 'react'
import type { FileRow } from '../services/fileService'
import { useFilesByOrderId } from '../queries/fileQueries'
import { useToast } from '../components/Toast'

const NO_FILES: FileRow[] = []

/**
 * The files linked to an order, reloaded whenever the order changes and on
 * demand (`reload`) after a dialog linked or removed one. Shared by the
 * orders view and the production page, which both host `ProductDetail`.
 *
 * Backed by the order's file query, so a link made anywhere — the Files tab,
 * the approval dialog, the textile editor's artwork picker — refreshes every
 * list of the order's files at once through `useFileLinking`'s invalidation.
 */
export function useOrderFiles(orderId: string | null): {
  files: FileRow[]
  reload: () => Promise<void>
} {
  const query = useFilesByOrderId(orderId)
  const { showError } = useToast()

  useEffect(() => {
    if (query.isError) showError('Files could not be loaded')
  }, [query.isError, showError])

  const refetch = query.refetch
  const reload = useCallback(async () => {
    if (orderId) await refetch()
  }, [orderId, refetch])

  return { files: query.data ?? NO_FILES, reload }
}
