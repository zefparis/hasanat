import { useAuth } from '../lib/auth'

/** HCS-U7 session badge — reflects the REAL 30s rotation poll, not a cosmetic timer. */
export default function Shield() {
  const { status } = useAuth()
  const live = status?.isHuman ?? false
  const secs = status?.rotation?.secondsUntilRotation
  return (
    <span
      className="shield"
      title={live ? `HCS-U7 verified · re-verifies every ${status?.rotation.rotationPeriodSeconds ?? 30}s` : 'HCS-U7 not verified'}
      style={live ? { transform: 'scale(1.06)', transition: 'transform .3s' } : undefined}
    >
      <i style={live ? undefined : { background: 'var(--muted)', animation: 'none' }} />
      HCS-U7{live && secs != null ? ` · ${secs}s` : ''}
    </span>
  )
}
