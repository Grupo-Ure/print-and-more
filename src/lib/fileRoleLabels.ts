import type { FileRole } from '../services/fileService'

/** A file's role as the Files tab and the history name it. */
export const FILE_ROLE_LABELS: Record<FileRole, string> = {
  PRODUCTION_FILE: 'Production file',
  PREVIEW: 'Preview / Mockup',
  CUSTOMER_APPROVAL: 'Customer approval',
  REFERENCE: 'Reference / Archive',
}
