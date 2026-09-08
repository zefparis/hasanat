import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'day' | 'night'
type Mode = 'auto' | 'manual'

interface ThemeCtx {
  theme: Theme
  mode: Mode
  /** Toggle manual override. Touching this disables auto (per spec). */
  toggle: () => void
  setAuto: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)

const MODE_KEY = 'hasanat.theme.mode'
const THEME_KEY = 'hasanat.theme'

/**
 * Detect the initial theme for a first-time user.
 * Priority: saved user choice > prefers-color-scheme > default day.
 */
function detectInitialTheme(): { theme: Theme; mode: Mode } {
  // 1. Saved mode (user has already chosen)
  try {
    const savedMode = localStorage.getItem(MODE_KEY)
    if (savedMode === 'manual') {
      const savedTheme = localStorage.getItem(THEME_KEY)
      if (savedTheme === 'night' || savedTheme === 'day') {
        return { theme: savedTheme, mode: 'manual' }
      }
      return { theme: 'day', mode: 'manual' }
    }
    if (savedMode === 'auto') {
      return { theme: 'day', mode: 'auto' } // auto will recompute from prayer times
    }
  } catch { /* ignore */ }

  // 2. First launch — check system preference
  try {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      return { theme: 'night', mode: 'auto' }
    }
  } catch { /* ignore */ }

  // 3. Default
  return { theme: 'day', mode: 'auto' }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = detectInitialTheme()
  const [theme, setTheme] = useState<Theme>(initial.theme)
  const [mode, setMode] = useState<Mode>(initial.mode)

  // Persist mode and manual theme to localStorage
  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode) } catch { /* ignore */ }
    if (mode === 'manual') {
      try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
    }
  }, [mode, theme])

  // Auto night mode follows real prayer times (Maghrib -> Fajr) from the
  // backend prayer service. Manual toggle disables auto.
  useEffect(() => {
    if (mode === 'manual') return
    let cancelled = false

    async function tick() {
      try {
        // Read prayer prefs from localStorage to pass method/madhab to the API
        let prayerParams = ''
        try {
          const raw = localStorage.getItem('hasanat.prefs')
          if (raw) {
            const p = JSON.parse(raw) as { calcMethod?: string; madhab?: string }
            const sp = new URLSearchParams()
            if (p.calcMethod) sp.set('method', p.calcMethod)
            if (p.madhab) sp.set('madhab', p.madhab)
            prayerParams = sp.toString() ? '?' + sp.toString() : ''
          }
        } catch { /* ignore */ }
        const res = await fetch('/api/prayer' + prayerParams)
        if (!res.ok || cancelled) return
        const schedule = await res.json()
        const nowSec = new Date().getHours() * 3600 + new Date().getMinutes() * 60
        const maghrib = schedule.times.find((t: { name: string }) => t.name === 'Maghrib')
        const fajr = schedule.times.find((t: { name: string }) => t.name === 'Fajr')
        if (!maghrib || !fajr) return
        const [mh, mm] = maghrib.time.split(':').map(Number)
        const [fh, fm] = fajr.time.split(':').map(Number)
        const maghribSec = mh * 3600 + mm * 60
        const fajrSec = fh * 3600 + fm * 60
        // Night from Maghrib to Fajr (wraps past midnight)
        const isNight = nowSec >= maghribSec || nowSec < fajrSec
        if (!cancelled) setTheme(isNight ? 'night' : 'day')
      } catch {
        // Fallback: simple sunset/sunrise heuristic if prayer API unavailable
        if (!cancelled) {
          const h = new Date().getHours()
          setTheme(h >= 18 || h < 5 ? 'night' : 'day')
        }
      }
    }

    void tick()
    const id = setInterval(tick, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [mode])

  const toggle = () => {
    setMode('manual')
    setTheme((t) => (t === 'day' ? 'night' : 'day'))
  }
  const setAuto = () => setMode('auto')

  return <Ctx.Provider value={{ theme, mode, toggle, setAuto }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTheme must be used within ThemeProvider')
  return c
}
