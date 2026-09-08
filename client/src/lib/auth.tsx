import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { hcsApi, type HcsSessionStatusRes, type HcsVerifyRes } from './api'

const SID_KEY = 'hasanat.sid'
const PREFS_KEY = 'hasanat.prefs'

/** Default re-verify threshold (5 min). Can be overridden by user preference. */
export const DEFAULT_REVERIFY_THRESHOLD_MS = 5 * 60 * 1000

/** Read the configurable session timeout from localStorage prefs. */
function getReverifyThreshold(): number {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_REVERIFY_THRESHOLD_MS
    const prefs = JSON.parse(raw) as { sessionTimeoutMin?: number }
    if (typeof prefs.sessionTimeoutMin === 'number') {
      return Math.max(1, Math.min(15, prefs.sessionTimeoutMin)) * 60_000
    }
  } catch { /* ignore */ }
  return DEFAULT_REVERIFY_THRESHOLD_MS
}

interface AuthCtx {
  sid: string | null
  status: HcsSessionStatusRes | null
  loading: boolean
  /** Timestamp (ms) of the last successful hold-to-verify. Null if not verified. */
  verifiedAt: number | null
  /** True if the last verification is older than REVERIFY_THRESHOLD_MS (or never verified). */
  isStale: () => boolean
  /** Set after a successful hold-to-verify; persists the session id + status. */
  signIn: (res: HcsVerifyRes) => void
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sid, setSid] = useState<string | null>(() => localStorage.getItem(SID_KEY))
  const [status, setStatus] = useState<HcsSessionStatusRes | null>(null)
  const [loading, setLoading] = useState(true)
  const statusRef = useRef<HcsSessionStatusRes | null>(null)
  statusRef.current = status

  // Fetch session status ONCE on mount (page reload restores verifiedAt from the server).
  // No 30s polling — the badge computes age locally from verifiedAt.
  useEffect(() => {
    if (!sid) {
      setLoading(false)
      setStatus(null)
      return
    }
    // If signIn already set the status (same page navigation), skip the fetch.
    if (statusRef.current) {
      setLoading(false)
      return
    }
    let cancelled = false
    hcsApi.sessionStatus(sid)
      .then((s) => { if (!cancelled) { setStatus(s); setLoading(false) } })
      .catch(() => {
        // Session expired or revoked — sign out locally.
        if (!cancelled) {
          localStorage.removeItem(SID_KEY)
          setSid(null)
          setStatus(null)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [sid])

  const signIn = (res: HcsVerifyRes) => {
    localStorage.setItem(SID_KEY, res.sid)
    setSid(res.sid)
    setStatus({
      sid: res.sid,
      sessionPublicId: res.result.sessionPublicId,
      isHuman: res.result.isHuman,
      score: res.result.score,
      riskLevel: res.result.riskLevel,
      verifiedAt: res.verifiedAt,
    })
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

  const verifiedAt = status?.verifiedAt ?? null
  const isStale = () => {
    if (!verifiedAt) return true
    return Date.now() - verifiedAt > getReverifyThreshold()
  }

  return <Ctx.Provider value={{ sid, status, loading, verifiedAt, isStale, signIn, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
