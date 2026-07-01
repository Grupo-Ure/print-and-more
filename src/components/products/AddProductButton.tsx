/** Shared "add product" action — used both in the section header and the empty state. */

import { Button } from '../ui/button'

export function AddProductButton({
  onClick,
  label = '+ Add product',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <Button type="button" onClick={onClick}>
      {label}
    </Button>
  )
}
