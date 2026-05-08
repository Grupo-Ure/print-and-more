import { useCallback, useState, type FormEvent } from 'react'
import { fileService } from '../services/fileService'
import type { FileRow, FileRole } from '../services/fileService'
import { useToast } from './Toast'


const ROLES: { value: FileRole; label: string }[] = [
  { value: 'PRODUKTIONSDATEI', label: 'Produktionsdatei' },
  { value: 'VORSCHAU', label: 'Vorschau / Mockup' },
  { value: 'KUNDENFREIGABE', label: 'Kundenfreigabe' },
  { value: 'REFERENZ', label: 'Referenz / Altstand' },
]

const ROLE_SHORT_LABELS: Record<FileRole, string> = {
  PRODUKTIONSDATEI: 'Produkt.',
  VORSCHAU: 'Vorschau',
  KUNDENFREIGABE: 'Freigabe',
  REFERENZ: 'Referenz',
}

type Props = {
  activeOrderId: string
  files: FileRow[]
  filesLoading: boolean
  onFileChanged: (neueFileRecord?: FileRow) => void | Promise<void>
}

export function FileList({ activeOrderId, files, filesLoading, onFileChanged }: Props) {
  const loading = filesLoading
  const { erfolg } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [path, setPath] = useState('')
  const [role, setRole] = useState<FileRole>('PRODUKTIONSDATEI')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const openParentFolder = useCallback(
    async (rawPath: string) => {
      const trimmedPath = (rawPath ?? '').trim()
      if (!trimmedPath) return
      const normalizedPath = trimmedPath.replace(/\\/g, '/').replace(/\/+$/g, '')
      const lastSlashIndex = normalizedPath.lastIndexOf('/')
      const parentPath = lastSlashIndex > 0 ? normalizedPath.slice(0, lastSlashIndex) : normalizedPath
      try {
        window.location.href = 'file://' + parentPath
      } catch {
        try {
          await navigator.clipboard.writeText(trimmedPath)
          erfolg('Pfad in Zwischenablage kopiert')
        } catch {
          // clipboard may be blocked by the browser
        }
      }
    },
    [erfolg],
  )

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmedName = displayName.trim()
    const trimmedPath = path.trim()
    if (!trimmedName || !trimmedPath) {
      setError('Anzeigename und Pfad sind erforderlich.')
      return
    }
    setSaving(true)
    let data: FileRow | null = null
    try {
      data = await fileService.createFile({
        auftrag_id: activeOrderId,
        anzeigename: trimmedName,
        pfad: trimmedPath,
        rolle: role,
      })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
      return
    }
    setSaving(false)
    if (data) {
      setDisplayName('')
      setPath('')
      setRole('PRODUKTIONSDATEI')
      setFormOpen(false)
      void onFileChanged(data as FileRow)
    }
  }

  const handleRemove = async (id: string) => {
    setError(null)
    setRemovingId(id)
    try {
      await fileService.deleteFile(id)
    } catch (err) {
      setRemovingId(null)
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
      return
    }
    setRemovingId(null)
    void onFileChanged()
  }

  return (
    <div className="wa-dl">
      <div className="wa-dl-top">
        <h3 className="wa-dl-titel">Dateien</h3>
        <button
          type="button"
          className="wa-dl-add"
          onClick={() => setFormOpen(open => !open)}
        >
          {formOpen ? 'Abbrechen' : '+ Hinzufügen'}
        </button>
      </div>
      {error && <p className="wa-dl-err">{error}</p>}

      {formOpen && (
        <form onSubmit={e => void handleAdd(e)} className="wa-dl-form">
          <div className="wa-dl-formzeile">
            <input
              className="ber-inp"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Anzeigename"
              required
              maxLength={500}
              aria-label="Anzeigename"
            />
            <input
              className="ber-inp"
              value={path}
              onChange={e => setPath(e.target.value)}
              required
              placeholder="Pfad (UNC …)"
              maxLength={2000}
              title={path}
              aria-label="Pfad"
            />
            <select
              className="ber-inp wa-dl-rolle"
              value={role}
              onChange={e => setRole(e.target.value as FileRole)}
              required
              aria-label="Rolle"
            >
              {ROLES.map(roleOption => (
                <option key={roleOption.value} value={roleOption.value}>
                  {roleOption.label}
                </option>
              ))}
            </select>
            <button type="submit" className="wa-dl-submit" disabled={saving} title="Hinzufügen">
              {saving ? '…' : '+'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="ber-hinweis" style={{ fontStyle: 'normal', fontSize: 12, margin: '4px 0' }}>
          Lädt Dateien …
        </p>
      ) : files.length === 0 ? (
        <p className="ber-hinweis" style={{ fontSize: 12, margin: '4px 0' }}>
          Noch keine Dateien.
        </p>
      ) : (
        <ul className="wa-dl-list">
          {files.map(file => (
            <li key={file.id} className="wa-dl-item">
              <button
                type="button"
                className="wa-dl-name"
                title={`${file.anzeigename}\n${file.pfad}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  padding: 0,
                  textAlign: 'left',
                }}
                onClick={() => void openParentFolder(file.pfad)}
              >
                <span aria-hidden>📄</span> {file.anzeigename}
              </button>
              <span className="badge badge-grau" title={ROLES.find(roleOption => roleOption.value === file.rolle)?.label ?? file.rolle}>
                {ROLE_SHORT_LABELS[file.rolle]}
              </span>
              <span className="wa-dl-pfad" title={file.pfad}>
                {file.pfad}
              </span>
              <button
                type="button"
                className="wa-dl-rm"
                onClick={() => void handleRemove(file.id)}
                disabled={removingId === file.id}
                title="Entfernen"
                aria-label={`Entfernen: ${file.anzeigename}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
