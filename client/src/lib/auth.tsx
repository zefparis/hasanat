import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { hcsApi, type HcsSessionStatusRes } from './api'

const SID_KEY = 'hasanat.sid'

interface AuthCtx {
  sid: string | null
  status: HcsSessionStatusRes | null
  loading: boolean
  /** Set after a successful hold-to-verify; persists the session id. */
  signIn: (sid: string) => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sid, setSid] = useState<string | null>(() => localStorage.getItem(SID_KEY))
  const [status, setStatus] = useState<HcsSessionStatusRes | null>(null)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll the session badge every 30s — real HCS-U7 QSIG rotation, not a JS counter.
  useEffect(() => {
    if (!sid) {
      setLoading(false)
      setStatus(null)
      return
    }
    let cancelled = false

    const poll = async () => {
      try {
        const s = await hcsApi.sessionStatus(sid)
        if (!cancelled) {
          setStatus(s)
          setLoading(false)
        }
      } catch {
        // Session expired or revoked — sign out locally.
        if (!cancelled) {
          localStorage.removeItem(SID_KEY)
          setSid(null)
          setStatus(null)
          setLoading(false)
        }
      }
    }

    void poll()
    pollRef.current = setInterval(poll, 30_000)
    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [sid])

  const signIn = (newSid: string) => {
    localStorage.setItem(SID_KEY, newSid)
    setSid(newSid)
  }

  const signOut = async () => {
    if (sid) {
      try {
        await hcsApi.signout(sid)
      } catch {
        // ignore — clear locally regardless
      }
    }
    localStorage.removeItem(SID_KEY)
    setSid(null)
    setStatus(null)
  }

  return <Ctx.Provider value={{ sid, status, loading, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
