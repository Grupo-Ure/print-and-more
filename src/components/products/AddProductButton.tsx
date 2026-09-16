/** Shared "add product" action — used both in the section header and the empty state. */

import { Button } from '../ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

export function AddProductButton({
  onClick,
  label = '+ Add product',
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <Button type="button" data-testid={TEST_IDS.orders.jobDetail.products.add} onClick={onClick}>
      {label}
    </Button>
  )
}
