import { useEffect, useState } from 'react'
import { useAuth, REVERIFY_THRESHOLD_MS } from '../lib/auth'

/** HCS-U7 session badge — shows the age of the last real verification, not a server rotation counter. */
export default function Shield() {
  const { status, verifiedAt } = useAuth()
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
        title="HCS-U7 not verified"
      >
        <i style={{ background: 'var(--muted)', animation: 'none' }} />
        HCS-U7
      </span>
    )
  }

  const ageMs = now - verifiedAt
  const ageSec = Math.floor(ageMs / 1000)
  const stale = ageMs > REVERIFY_THRESHOLD_MS

  const label = stale
    ? 'HCS-U7 · reverify needed'
    : ageSec < 60
      ? `HCS-U7 · ${ageSec}s ago`
      : `HCS-U7 · ${Math.floor(ageSec / 60)}m ago`

  return (
    <span
      className="shield"
      title={stale ? 'Last verification is stale — re-verify before sensitive actions' : `Verified ${ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m`} ago`}
      style={{
        transform: 'scale(1.06)',
        transition: 'transform .3s',
        ...(stale ? { color: 'var(--warn, #c80)' } : undefined),
      }}
    >
      <i style={stale ? { background: 'var(--warn, #c80)' } : undefined} />
      {label}
    </span>
  )
}
