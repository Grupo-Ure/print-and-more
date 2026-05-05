import {
  TEILAUFTRAG_BEREICHE,
  TEILAUFTRAG_BEREICH_ANZEIGE,
  type Bereich,
} from '../types/database'
import './WorkArea.css'

type Props = {
  offen: boolean
  speichert: boolean
  onBereich: (b: Bereich) => void
  onSchliessen: () => void
}

export function AddSubOrderOverlay({ offen, speichert, onBereich, onSchliessen }: Props) {
  if (!offen) return null

  return (
    <div
      className="wa-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-dialog-title"
      onClick={e => e.target === e.currentTarget && !speichert && onSchliessen()}
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
              disabled={speichert}
              onClick={() => onBereich(b)}
            >
              {TEILAUFTRAG_BEREICH_ANZEIGE[b]}
            </button>
          ))}
        </div>
        <div className="wa-dialog-foot">
          <button type="button" className="wa-ghost-btn" disabled={speichert} onClick={onSchliessen}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
