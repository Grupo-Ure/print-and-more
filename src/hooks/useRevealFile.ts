import { useCallback } from 'react'
import { useToast } from '../components/Toast'

/**
 * Reveals a linked file in the OS file manager through the desktop bridge.
 * Files are linked by path, never uploaded, so "open" means showing the file
 * where it lives on the share. In a plain browser tab it degrades to a toast.
 */
export function useRevealFile(): (rawPath: string) => Promise<void> {
  const { showError } = useToast()

  return useCallback(
    async (rawPath: string) => {
      if (!window.pam) {
        showError('Opening files requires the desktop app.')
        return
      }
      const result = await window.pam.revealPath(rawPath)
      if (!result.ok) showError(result.error)
    },
    [showError],
  )
}
