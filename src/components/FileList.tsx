import { useCallback, useState, type FormEvent } from 'react'
import { fileService } from '../services/fileService'
import type { FileRow, FileRole } from '../services/fileService'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import { SectionTitle } from './ui/section-title'


const ROLES: { value: FileRole; label: string }[] = [
  { value: 'PRODUCTION_FILE', label: 'Production file' },
  { value: 'PREVIEW', label: 'Preview / Mockup' },
  { value: 'CUSTOMER_APPROVAL', label: 'Customer approval' },
  { value: 'REFERENCE', label: 'Reference / Archive' },
]

const ROLE_SHORT_LABELS: Record<FileRole, string> = {
  PRODUCTION_FILE: 'Prod.',
  PREVIEW: 'Preview',
  CUSTOMER_APPROVAL: 'Approval',
  REFERENCE: 'Reference',
}

type Props = {
  activeOrderId: string
  files: FileRow[]
  filesLoading: boolean
  onFileChanged: (neueFileRecord?: FileRow) => void | Promise<void>
}

export function FileList({ activeOrderId, files, filesLoading, onFileChanged }: Props) {
  const loading = filesLoading
  const { showSuccess } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [path, setPath] = useState('')
  const [role, setRole] = useState<FileRole>('PRODUCTION_FILE')
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
          showSuccess('Path copied to clipboard')
        } catch {
          // clipboard may be blocked by the browser
        }
      }
    },
    [showSuccess],
  )

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmedName = displayName.trim()
    const trimmedPath = path.trim()
    if (!trimmedName || !trimmedPath) {
      setError('Display name and path are required.')
      return
    }
    setSaving(true)
    let data: FileRow | null
    try {
      data = await fileService.createFile({
        order_id: activeOrderId,
        display_name: trimmedName,
        path: trimmedPath,
        role: role,
      })
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Error saving')
      return
    }
    setSaving(false)
    if (data) {
      setDisplayName('')
      setPath('')
      setRole('PRODUCTION_FILE')
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
      setError(err instanceof Error ? err.message : 'Error deleting')
      return
    }
    setRemovingId(null)
    void onFileChanged()
  }

  return (
    <div className="wa-dl">
      <div className="wa-dl-top">
        <SectionTitle>Files</SectionTitle>
        <button
          type="button"
          className="wa-dl-add"
          onClick={() => setFormOpen(open => !open)}
        >
          {formOpen ? 'Cancel' : '+ Add'}
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
              placeholder="Display name"
              required
              maxLength={500}
              aria-label="Display name"
            />
            <input
              className="ber-inp"
              value={path}
              onChange={e => setPath(e.target.value)}
              required
              placeholder="Path (UNC…)"
              maxLength={2000}
              title={path}
              aria-label="Path"
            />
            <select
              className="ber-inp wa-dl-rolle"
              value={role}
              onChange={e => setRole(e.target.value as FileRole)}
              required
              aria-label="Role"
            >
              {ROLES.map(roleOption => (
                <option key={roleOption.value} value={roleOption.value}>
                  {roleOption.label}
                </option>
              ))}
            </select>
            <button type="submit" className="wa-dl-submit" disabled={saving} title="Add">
              {saving ? '…' : '+'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="my-1 text-sm text-muted-foreground">Loading files…</p>
      ) : files.length === 0 ? (
        <div className="flex min-h-16 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No files</p>
        </div>
      ) : (
        <ul className="wa-dl-list">
          {files.map(file => (
            <li key={file.id} className="wa-dl-item">
              <button
                type="button"
                className="wa-dl-name"
                title={`${file.display_name}\n${file.path}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  padding: 0,
                  textAlign: 'left',
                }}
                onClick={() => void openParentFolder(file.path)}
              >
                <span aria-hidden>📄</span> {file.display_name}
              </button>
              <Badge variant="secondary" title={ROLES.find(roleOption => roleOption.value === file.role)?.label ?? file.role}>
                {ROLE_SHORT_LABELS[file.role]}
              </Badge>
              <span className="wa-dl-pfad" title={file.path}>
                {file.path}
              </span>
              <button
                type="button"
                className="wa-dl-rm"
                onClick={() => void handleRemove(file.id)}
                disabled={removingId === file.id}
                title="Remove"
                aria-label={`Remove: ${file.display_name}`}
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
