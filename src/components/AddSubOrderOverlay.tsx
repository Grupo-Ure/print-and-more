import {
  SUB_ORDER_DEPARTMENTS,
  SUB_ORDER_DEPARTMENT_LABELS,
  type Department,
} from '../types/database'
import './WorkArea.css'

type Props = {
  open: boolean
  saving: boolean
  onDepartmentSelected: (b: Department) => void
  onClose: () => void
}

export function AddSubOrderOverlay({ open, saving, onDepartmentSelected, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="wa-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-dialog-title"
      onClick={e => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="wa-dialog" onClick={e => e.stopPropagation()}>
        <h2 id="wa-dialog-title">Neuer Teilauftrag</h2>
        <p className="wa-hint">Department wählen:</p>
        <div className="wa-bereich-grid">
          {SUB_ORDER_DEPARTMENTS.map(department => (
            <button
              key={department}
              type="button"
              className="wa-bereich-btn"
              disabled={saving}
              onClick={() => onDepartmentSelected(department)}
            >
              {SUB_ORDER_DEPARTMENT_LABELS[department]}
            </button>
          ))}
        </div>
        <div className="wa-dialog-foot">
          <button type="button" className="wa-ghost-btn" disabled={saving} onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
