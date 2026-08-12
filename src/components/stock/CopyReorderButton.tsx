import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '../Toast'

type CopyReorderButtonProps = {
  /** Pipe-separated plain-text export for ordering by e-mail/phone. */
  clipboardText: string
  disabled?: boolean
}

/** "Copy to clipboard" affordance of the reorder mode, shared by both stock pages. */
export function CopyReorderButton({ clipboardText, disabled }: CopyReorderButtonProps) {
  const { showError } = useToast()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(clipboardText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      showError('Copy failed')
    }
  }

  return (
    <span className="flex items-center gap-2">
      <Button type="button" onClick={() => void copyToClipboard()} disabled={disabled}>
        Copy to clipboard
      </Button>
      {copied && <span className="text-sm text-green-700">Copied</span>}
    </span>
  )
}
