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

  // Auto night mode follows prayer times (Maghrib -> Fajr).
  // Real prayer engine is wired in prompt 5; for now a simple sunset/sunrise-ish heuristic
  // is replaced once the prayer module exists. Manual toggle disables auto.
  useEffect(() => {
    if (mode === 'manual') return
    const tick = () => {
      const h = new Date().getHours()
      setTheme(h >= 18 || h < 5 ? 'night' : 'day')
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
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
