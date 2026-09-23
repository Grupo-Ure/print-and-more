import { useCallback, useEffect, useState } from 'react'
import { fileService, type FileRow } from '../services/fileService'
import { useToast } from '../components/Toast'

/**
 * The files linked to an order, reloaded whenever the order changes and on
 * demand (`reload`) after a dialog linked or removed one. Shared by the
 * orders view and the production page, which both host `JobDetail`.
 */
export function useOrderFiles(orderId: string | null): {
  files: FileRow[]
  reload: () => Promise<void>
} {
  const [files, setFiles] = useState<FileRow[]>([])
  const { showError } = useToast()

  const reload = useCallback(async () => {
    if (!orderId) return
    try {
      const data = await fileService.getFilesByOrderId(orderId)
      setFiles(data)
    } catch {
      setFiles([])
      showError('Files could not be loaded')
    }
  }, [orderId, showError])

  useEffect(() => {
    if (!orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the previous order's files
      setFiles([])
      return
    }
    void reload()
  }, [orderId, reload])

  return { files, reload }
}
