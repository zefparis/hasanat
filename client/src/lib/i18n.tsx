import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import en from './translations/en.json'
import ar from './translations/ar.json'

export type Locale = 'en' | 'ar'

const STORAGE_KEY = 'hasanat.locale'
const DICTS: Record<Locale, Record<string, unknown>> = { en, ar }

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ar') return stored
  } catch { /* ignore */ }
  const nav = navigator.language?.toLowerCase() ?? ''
  return nav.startsWith('ar') ? 'ar' : 'en'
}

function resolveKey(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return typeof cur === 'string' ? cur : undefined
}

interface I18nCtx {
  locale: Locale
  t: (key: string, vars?: Record<string, string | number>) => string
  setLocale: (l: Locale) => void
  toggleLocale: () => void
  dir: 'ltr' | 'rtl'
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try { return detectLocale() } catch { return 'en' }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, locale) } catch { /* ignore */ }
  }, [locale])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTS[locale]
      let str = resolveKey(dict as Record<string, unknown>, key) ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return str
    },
    [locale],
  )

  const setLocale = useCallback((l: Locale) => setLocaleState(l), [])
  const toggleLocale = useCallback(() => setLocaleState((p) => (p === 'en' ? 'ar' : 'en')), [])
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return <Ctx.Provider value={{ locale, t, setLocale, toggleLocale, dir }}>{children}</Ctx.Provider>
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n must be used within I18nProvider')
  return c
}
