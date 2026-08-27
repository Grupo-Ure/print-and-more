import type { DragEvent } from 'react'
import { fileService } from '../services/fileService'
import { historyService } from '../services/historyService'
import type { FileRow, FileRole } from '../services/fileService'
import { useToast } from '../components/Toast'

const DEFAULT_ROLE: FileRole = 'PRODUCTION_FILE'

/**
 * Links files to an order by their real disk path (via the Electron bridge):
 * shared by OrderFilesDialog and GrantApprovalDialog. Every link writes a
 * FILE_ADDED history event; failures surface as error toasts.
 */
export function useFileLinking(orderId: string) {
  const { showError, showSuccess } = useToast()

  const linkPaths = async (items: { name: string; path: string }[]): Promise<FileRow[]> => {
    const added: FileRow[] = []
    for (const item of items) {
      try {
        const data = await fileService.createFile({
          order_id: orderId,
          display_name: item.name,
          path: item.path,
          role: DEFAULT_ROLE,
        })
        void historyService.tryWriteHistory({
          order_id: orderId,
          event_type: 'FILE_ADDED',
          meta: { display_name: data.display_name, role: data.role },
        })
        added.push(data)
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Error saving')
        break
      }
    }
    if (added.length > 0) {
      showSuccess(added.length === 1 ? '1 file linked' : `${added.length} files linked`)
    }
    return added
  }

  /** Native multi-file picker → link everything picked. */
  const pickAndLink = async (): Promise<FileRow[]> => {
    if (!window.auftrag) {
      showError('Linking files requires the desktop app.')
      return []
    }
    const picked = await window.auftrag.pickFiles()
    return linkPaths(
      picked.map(filePath => ({
        name: filePath.replace(/\\/g, '/').split('/').pop() ?? filePath,
        path: filePath,
      })),
    )
  }

  /** Dropped File objects → real paths → link them. */
  const linkDropped = async (e: DragEvent): Promise<FileRow[]> => {
    if (!window.auftrag) {
      showError('Linking dropped files requires the desktop app.')
      return []
    }
    const native = window.auftrag
    return linkPaths(
      Array.from(e.dataTransfer.files)
        .map(item => ({ name: item.name, path: native.getPathForFile(item) }))
        .filter(item => item.path),
    )
  }

  return { pickAndLink, linkDropped }
}
