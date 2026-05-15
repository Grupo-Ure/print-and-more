import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ToastType = 'error' | 'success' | 'info'

type ToastEntry = { id: string; typ: ToastType; text: string }

const MAX = 3
const AUTO_MS = 4000

const BORDER: Record<ToastType, string> = {
  error: '#dc2626',
  success: '#16a34a',
  info: '#2563eb',
}

type ToastApiContextValue = {
  fehler: (text: string) => void
  erfolg: (text: string) => void
  info: (text: string) => void
}

type ToastListContextValue = {
  toasts: ToastEntry[]
  dismiss: (id: string) => void
}

const ToastApiContext = createContext<ToastApiContextValue | null>(null)
const ToastListContext = createContext<ToastListContextValue | null>(null)

function pushToastCapped(
  prev: ToastEntry[],
  entry: ToastEntry
): ToastEntry[] {
  const next = [...prev, entry]
  if (next.length <= MAX) return next
  return next.slice(next.length - MAX)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(p => p.filter(x => x.id !== id))
  }, [])

  const add = useCallback(
    (typ: ToastType, text: string) => {
      const id = crypto.randomUUID()
      setToasts(previous => pushToastCapped(previous, { id, typ, text: text.trim() || '—' }))
      window.setTimeout(() => {
        setToasts(previous => previous.filter(toast => toast.id !== id))
      }, AUTO_MS)
    },
    []
  )

  const fehler = useCallback((text: string) => add('error', text), [add])
  const erfolg = useCallback((text: string) => add('success', text), [add])
  const info = useCallback((text: string) => add('info', text), [add])

  const apiValue = useMemo(
    () => ({ fehler, erfolg, info }) satisfies ToastApiContextValue,
    [fehler, erfolg, info]
  )
  const listValue = useMemo(
    () => ({ toasts, dismiss }) satisfies ToastListContextValue,
    [toasts, dismiss]
  )

  return (
    <ToastApiContext.Provider value={apiValue}>
      <ToastListContext.Provider value={listValue}>{children}</ToastListContext.Provider>
    </ToastApiContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastApiContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return { fehler: context.fehler, erfolg: context.erfolg, info: context.info }
}

export function ToastContainer() {
  const context = useContext(ToastListContext)
  if (!context) return null
  const { toasts, dismiss } = context

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
      {toasts.map(toast => (
        <div
          key={toast.id}
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
            borderLeft: `4px solid ${BORDER[toast.typ]}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            color: '#111',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{toast.text}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Close"
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
