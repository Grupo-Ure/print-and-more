/** Shared "add product" action — used both in the section header and the empty state. */

import { Button } from '../ui/button'
import { TEST_IDS } from '@e2e/support/testIds'

export function AddProductButton({
  onClick,
  label = '+ Add product',
  testId = TEST_IDS.orders.jobDetail.products.add,
}: {
  onClick: () => void
  label?: string
  /** The header and the empty state can be on screen together, so each site has its own ID. */
  testId?: string
}) {
  return (
    <Button type="button" data-testid={testId} onClick={onClick}>
      {label}
    </Button>
  )
}
