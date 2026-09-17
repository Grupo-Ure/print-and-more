import type { FileSeedRow } from '../support/database'

/**
 * A file linked to an order for the customer to approve. Files are links to
 * a network share, never uploads, so the path is only ever displayed.
 */
export const APPROVAL_FILE: FileSeedRow = {
  display_name: 'E2E proof.pdf',
  path: '\\\\share\\e2e\\proof.pdf',
  role: 'CUSTOMER_APPROVAL',
}
