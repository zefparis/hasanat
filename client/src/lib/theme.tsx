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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('day')
  const [mode, setMode] = useState<Mode>('auto')

  // Auto night mode follows real prayer times (Maghrib -> Fajr) from the
  // backend prayer service. Manual toggle disables auto.
  useEffect(() => {
    if (mode === 'manual') return
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch('/api/prayer')
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
