import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '../Toast'

type CopyReorderButtonProps = {
  /** Pipe-separated plain-text export for ordering by e-mail/phone. */
  clipboardText: string
  disabled?: boolean
}

/**
 * "Copy to clipboard" affordance of the reorder list, shared by both stock
 * pages. Reports the outcome as a toast, like the copy actions in the orders
 * header.
 */
export function CopyReorderButton({ clipboardText, disabled }: CopyReorderButtonProps) {
  const { showError, showSuccess } = useToast()

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(clipboardText)
      showSuccess('Reorder list copied to clipboard')
    } catch {
      showError('Reorder list could not be copied')
    }
  }

  return (
    <Button type="button" variant="outline" onClick={() => void copyToClipboard()} disabled={disabled}>
      <Copy />
      Copy list
    </Button>
  )
}
