import { createContext } from 'react'

/**
 * True while a product dialog shows a form in read-only view mode. The dialog
 * provides it (together with a disabled `<fieldset>` around the form) so the
 * per-type forms need no view-mode awareness; `FormActions` hides itself.
 */
export const ProductViewContext = createContext(false)
