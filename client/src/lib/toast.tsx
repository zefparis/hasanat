import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Toast { id: number; msg: string }
interface ToastCtx { toast: (msg: string) => void }

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((msg: string) => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 'calc(var(--nav-h) + 16px)', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 100, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: 'var(--ink)', color: 'var(--bg)', padding: '10px 18px', borderRadius: 12, fontSize: 13.5, fontWeight: 500, boxShadow: 'var(--shadow)', maxWidth: 360, textAlign: 'center' }}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast must be used within ToastProvider')
  return c
}
