import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type CalcMethod = 'MWL' | 'ISNA' | 'UMM_QURA' | 'EGYPTIAN' | 'KARACHI'
export type Madhab = 'standard' | 'hanafi'
export type AppLockTimeout = 'immediate' | '1min' | '5min' | 'never'

export interface Prefs {
  // Notifications (local preferences — no push system at pilot stage)
  prayerReminders: boolean
  prayerReminderPrayers: Record<string, boolean> // Fajr/Dhuhr/Asr/Maghrib/Isha
  transactionAlerts: boolean
  donationAlerts: boolean
  checkInReminder: boolean

  // Security
  appLockTimeout: AppLockTimeout
  sessionTimeoutMin: number // 1–15, default 5

  // Prayer
  calcMethod: CalcMethod
  madhab: Madhab
}

const DEFAULTS: Prefs = {
  prayerReminders: true,
  prayerReminderPrayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
  transactionAlerts: true,
  donationAlerts: false, // off by default — donations are private
  checkInReminder: true,

  appLockTimeout: '5min',
  sessionTimeoutMin: 5,

  calcMethod: 'MWL',
  madhab: 'standard',
}

const STORAGE_KEY = 'hasanat.prefs'

// ─── Context ─────────────────────────────────────────────────────────────────

interface PrefsCtx {
  prefs: Prefs
  update: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  reset: () => void
}

const Ctx = createContext<PrefsCtx | null>(null)

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    // Merge with defaults to handle new fields added after first save
    return { ...DEFAULTS, ...parsed,
      prayerReminderPrayers: { ...DEFAULTS.prayerReminderPrayers, ...(parsed.prayerReminderPrayers ?? {}) },
    }
  } catch { return DEFAULTS }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return loadPrefs() } catch { return DEFAULTS }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
  }, [prefs])

  const update = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  const reset = useCallback(() => setPrefs(DEFAULTS), [])

  return <Ctx.Provider value={{ prefs, update, reset }}>{children}</Ctx.Provider>
}

export function usePrefs(): PrefsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrefs must be used within PrefsProvider')
  return c
}
