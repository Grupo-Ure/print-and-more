import {
  TEILAUFTRAG_BEREICHE,
  TEILAUFTRAG_BEREICH_ANZEIGE,
  type Bereich,
} from '../types/database'
import './WorkArea.css'

type Props = {
  open: boolean
  saving: boolean
  onBereichSelected: (b: Bereich) => void
  onClose: () => void
}

export function AddSubOrderOverlay({ open, saving, onBereichSelected, onClose }: Props) {
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
        <p className="wa-hint">Bereich wählen:</p>
        <div className="wa-bereich-grid">
          {TEILAUFTRAG_BEREICHE.map(b => (
            <button
              key={b}
              type="button"
              className="wa-bereich-btn"
              disabled={saving}
              onClick={() => onBereichSelected(b)}
            >
              {TEILAUFTRAG_BEREICH_ANZEIGE[b]}
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
