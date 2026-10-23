import type { FileSeedRow } from '../support/database'

/** A proof the `proofFiles` fixture writes to disk and links; the path is the temporary file's, known only at run time. */
export type ProofFileSeed = Omit<FileSeedRow, 'path'> & {
  /** What the file on disk holds — the bytes the app reads and uploads as the copy. */
  content: string
}

/**
 * Two proofs of one product, real files the desktop app can read: asking the
 * customer for an approval uploads a copy of each file shown.
 */
export const PROOF_FILES: readonly ProofFileSeed[] = [
  { display_name: 'E2E proof front.pdf', role: 'CUSTOMER_APPROVAL', content: '%PDF-1.4 E2E proof front' },
  { display_name: 'E2E proof back.pdf', role: 'CUSTOMER_APPROVAL', content: '%PDF-1.4 E2E proof back' },
]

/**
 * A file linked to an order for the customer to approve. Files are links to
 * a network share, never uploads, so the path is only ever displayed.
 */
export const APPROVAL_FILE: FileSeedRow = {
  display_name: 'E2E proof.pdf',
  path: '\\\\share\\e2e\\proof.pdf',
  role: 'CUSTOMER_APPROVAL',
}
