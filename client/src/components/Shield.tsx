import { useEffect, useState } from 'react'
import { useAuth, DEFAULT_REVERIFY_THRESHOLD_MS } from '../lib/auth'
import { useI18n } from '../lib/i18n'

/** Read the configurable threshold from localStorage (same logic as auth.tsx). */
function getThreshold(): number {
  try {
    const raw = localStorage.getItem('hasanat.prefs')
    if (!raw) return DEFAULT_REVERIFY_THRESHOLD_MS
    const prefs = JSON.parse(raw) as { sessionTimeoutMin?: number }
    if (typeof prefs.sessionTimeoutMin === 'number') {
      return Math.max(1, Math.min(15, prefs.sessionTimeoutMin)) * 60_000
    }
  } catch { /* ignore */ }
  return DEFAULT_REVERIFY_THRESHOLD_MS
}

/** HCS-U7 session badge — shows the age of the last real verification, not a server rotation counter. */
export default function Shield() {
  const { status, verifiedAt } = useAuth()
  const { t } = useI18n()
  const live = status?.isHuman ?? false
  const [now, setNow] = useState(Date.now())

  // Tick every second so the age display stays live (client-side only, no server poll).
  useEffect(() => {
    if (!live || !verifiedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [live, verifiedAt])

  if (!live || !verifiedAt) {
    return (
      <span
        className="shield"
        title={t('shield.notVerified')}
      >
        <i style={{ background: 'var(--muted)', animation: 'none' }} />
        {t('shield.badge')}
      </span>
    )
  }

  const ageMs = now - verifiedAt
  const ageSec = Math.floor(ageMs / 1000)
  const stale = ageMs > getThreshold()

  const label = stale
    ? t('shield.reverifyNeeded')
    : ageSec < 60
      ? t('shield.secondsAgo', { n: ageSec })
      : t('shield.minutesAgo', { n: Math.floor(ageSec / 60) })

  const titleStale = t('shield.staleTitle')
  const titleFresh = ageSec < 60
    ? t('shield.verifiedSecondsAgo', { n: ageSec })
    : t('shield.verifiedMinutesAgo', { n: Math.floor(ageSec / 60) })

  return (
    <span
      className="shield"
      title={stale ? titleStale : titleFresh}
      style={{
        transform: 'scale(1.06)',
        transition: 'transform .3s',
        ...(stale ? { color: 'var(--warn)' } : undefined),
      }}
    >
      <i style={stale ? { background: 'var(--warn)' } : undefined} />
      {label}
    </span>
  )
}
