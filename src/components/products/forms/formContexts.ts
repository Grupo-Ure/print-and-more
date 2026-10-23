import { createContext, useContext } from 'react'

/**
 * True while a product dialog shows a form in read-only view mode. The dialog
 * provides it (together with a disabled `<fieldset>` around the form) so the
 * per-type forms need no view-mode awareness; `FormActions` hides itself.
 */
export const ProductViewContext = createContext(false)

/**
 * True once Save has been pressed on the surrounding form. `FormShell` provides
 * it, and the widgets read it to decide whether a required-field error is due:
 * a freshly-opened form stays quiet until the user asks to save.
 */
export const SubmitAttemptedContext = createContext(false)

export const useSubmitAttempted = () => useContext(SubmitAttemptedContext)

/**
 * Takes the user from the product's files on *Basic info* to the Files tab,
 * where the approval is asked for. `ProductBasicInfo` provides it while the
 * product can be sent for approval; null everywhere else (the draft panel).
 */
export const RequestApprovalContext = createContext<(() => void) | null>(null)
