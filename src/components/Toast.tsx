import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ToastType = 'error' | 'success' | 'info'

type ToastEintrag = { id: string; typ: ToastType; text: string }

const MAX = 3
const AUTO_MS = 4000

const BORDER: Record<ToastType, string> = {
  error: '#dc2626',
  success: '#16a34a',
  info: '#2563eb',
}

type ToastApiKontextWert = {
  fehler: (text: string) => void
  erfolg: (text: string) => void
  info: (text: string) => void
}

type ToastListKontextWert = {
  toasts: ToastEintrag[]
  dismiss: (id: string) => void
}

const ToastApiKontext = createContext<ToastApiKontextWert | null>(null)
const ToastListKontext = createContext<ToastListKontextWert | null>(null)

function pushToastGekappt(
  prev: ToastEintrag[],
  t: ToastEintrag
): ToastEintrag[] {
  const n = [...prev, t]
  if (n.length <= MAX) return n
  return n.slice(n.length - MAX)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEintrag[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.filter(x => x.id !== id))
  }, [])

  const add = useCallback(
    (typ: ToastType, text: string) => {
      const id = crypto.randomUUID()
      setToasts(p => pushToastGekappt(p, { id, typ, text: text.trim() || '—' }))
      window.setTimeout(() => {
        setToasts(p => p.filter(t => t.id !== id))
      }, AUTO_MS)
    },
    []
  )

  const fehler = useCallback((t: string) => add('error', t), [add])
  const erfolg = useCallback((t: string) => add('success', t), [add])
  const info = useCallback((t: string) => add('info', t), [add])

  const apiWert = useMemo(
    () => ({ fehler, erfolg, info }) satisfies ToastApiKontextWert,
    [fehler, erfolg, info]
  )
  const listWert = useMemo(
    () => ({ toasts, dismiss }) satisfies ToastListKontextWert,
    [toasts, dismiss]
  )

  return (
    <ToastApiKontext.Provider value={apiWert}>
      <ToastListKontext.Provider value={listWert}>{children}</ToastListKontext.Provider>
    </ToastApiKontext.Provider>
  )
}

export function useToast() {
  const c = useContext(ToastApiKontext)
  if (!c) throw new Error('useToast muss innerhalb von ToastProvider verwendet werden')
  return { fehler: c.fehler, erfolg: c.erfolg, info: c.info }
}

export function ToastContainer() {
  const c = useContext(ToastListKontext)
  if (!c) return null
  const { toasts, dismiss } = c

  return (
    <div
      className="toast-container"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        maxWidth: 400,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div
          key={t.id}
          role="status"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            maxWidth: '100%',
            fontSize: 13,
            padding: '12px 16px',
            borderRadius: 8,
            background: '#fff',
            borderLeft: `4px solid ${BORDER[t.typ]}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            color: '#111',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{t.text}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Schließen"
            style={{
              flexShrink: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              color: '#555',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
