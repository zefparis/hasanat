import { useEffect, useRef, useState } from 'react'
import { hcsApi, ApiError, type HcsVerifyRes } from '../lib/api'
import { useI18n } from '../lib/i18n'

type HoldState = 'idle' | 'holding' | 'verifying' | 'success' | 'failed'

const CHECK_KEYS = [
  'holdToVerify.check1',
  'holdToVerify.check2',
  'holdToVerify.check3',
  'holdToVerify.check4',
] as const

interface Props {
  /** Called after a successful hold-to-verify with the full verify response. */
  onSuccess: (res: HcsVerifyRes) => void
  /** Optional cancel handler (shown as a ghost button when provided). */
  onCancel?: () => void
  title?: string
  subtitle?: string
  cancelLabel?: string
}

/**
 * Reusable hold-to-verify component — the real HCS-U7 cognitive verification.
 * Creates a session on mount, captures the hold gesture, fires a real verify
 * call, and lights up the 4 checks ONLY from the backend response.
 *
 * Used by:
 *   - SignIn (step 3, inline)
 *   - Sensitive-action re-verify gate (Pay / Send / Zakat, as a modal)
 */
export default function HoldToVerify({
  onSuccess,
  onCancel,
  title,
  subtitle,
  cancelLabel,
}: Props) {
  const { t } = useI18n()
  const _title = title ?? t('holdToVerify.defaultTitle')
  const _subtitle = subtitle ?? t('holdToVerify.defaultSubtitle')
  const _cancelLabel = cancelLabel ?? t('holdToVerify.defaultCancel')
  const [hold, setHold] = useState<HoldState>('idle')
  const [progress, setProgress] = useState(0)
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(true)

  const sessionPublicIdRef = useRef<string | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const releasedEarlyRef = useRef(false)
  const verifyInFlightRef = useRef(false)

  // Create a cognitive session on mount.
  useEffect(() => {
    let cancelled = false
    setCreating(true)
    hcsApi.createSession()
      .then((s) => { if (!cancelled) { sessionPublicIdRef.current = s.sessionPublicId; setCreating(false) } })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : t('holdToVerify.errorNoSession'))
          setHold('failed')
          setCreating(false)
        }
      })
    return () => { cancelled = true }
  }, [t])

  function retry() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setHold('idle')
    setProgress(0)
    setChecks([false, false, false, false])
    setError(null)
    setCreating(true)
    hcsApi.createSession()
      .then((s) => { sessionPublicIdRef.current = s.sessionPublicId; setCreating(false) })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : t('holdToVerify.errorNoSession'))
        setHold('failed')
        setCreating(false)
      })
  }

  function onPointerDown(e: React.PointerEvent) {
    if (hold === 'success' || hold === 'verifying' || creating) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    releasedEarlyRef.current = false
    holdStartRef.current = null
    setHold('holding')
    setProgress(0)
    setChecks([false, false, false, false])
    rafRef.current = requestAnimationFrame(fillRing)
    void startVerify()
  }

  function fillRing(ts: number) {
    if (holdStartRef.current === null) holdStartRef.current = ts
    const elapsed = ts - holdStartRef.current
    const p = Math.min(1, elapsed / 2400)
    setProgress(p)
    if (p < 1) rafRef.current = requestAnimationFrame(fillRing)
  }

  async function startVerify() {
    const sessionPublicId = sessionPublicIdRef.current
    if (!sessionPublicId) {
      setError(t('holdToVerify.errorNoSessionRetry'))
      setHold('failed')
      return
    }
    verifyInFlightRef.current = true
    setHold('verifying')
    try {
      const res = await hcsApi.verify({ sessionPublicId, signals: { source: 'hasanat_mobile' } })
      verifyInFlightRef.current = false
      if (releasedEarlyRef.current) {
        setHold('failed')
        setError(t('holdToVerify.errorReleased'))
        return
      }
      const c = res.result.checks
      ;[c.deviceBound, c.liveness, c.cognitiveSignatureMatched, c.secureSession].forEach((v, i) => {
        setTimeout(() => setChecks((prev) => { const n = [...prev]; n[i] = v; return n }), i * 180)
      })
      setHold('success')
      setTimeout(() => onSuccess(res), 700)
    } catch (e) {
      verifyInFlightRef.current = false
      if (releasedEarlyRef.current) {
        setHold('failed')
        setError(t('holdToVerify.errorReleased'))
        return
      }
      setHold('failed')
      setError(e instanceof ApiError ? e.message : t('holdToVerify.errorFailed'))
    }
  }

  function onPointerUp() {
    if (hold === 'success' || hold === 'failed') return
    if (verifyInFlightRef.current) {
      releasedEarlyRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setHold('failed')
      setError(t('holdToVerify.errorReleased'))
      return
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setHold('idle')
    setProgress(0)
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return (
    <>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>{_title}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>{_subtitle}</p>

      <div
        className={`hold ${hold === 'holding' ? 'on' : ''}`}
        style={{ margin: '22px auto 0', width: 150, height: 150, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', touchAction: 'none', opacity: creating ? 0.5 : 1 }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <svg viewBox="0 0 150 150" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <circle cx="75" cy="75" r="70" stroke="var(--line)" strokeWidth="5" fill="none" />
          <circle
            cx="75" cy="75" r="70" stroke="var(--primary-2)" strokeWidth="5" fill="none" strokeLinecap="round"
            strokeDasharray="440" strokeDashoffset={440 - 440 * progress}
            transform="rotate(-90 75 75)"
          />
        </svg>
        <div className="star hs" style={{ width: 96, height: 96, background: 'var(--accent)', transition: 'transform .2s', transform: hold === 'holding' ? 'scale(.92)' : 'none' }} />
      </div>

      <div className="checks" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CHECK_KEYS.map((key, i) => (
          <div key={key} className={checks[i] ? 'ok' : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: checks[i] ? 'var(--ink)' : 'var(--muted)', opacity: checks[i] ? 1 : 0.5, transition: '.3s' }}>
            <i style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid', borderColor: checks[i] ? 'var(--ok)' : 'var(--line)', background: checks[i] ? 'var(--ok)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {checks[i] && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ width: 12, height: 12 }}><path d="M5 12l4 4L19 7" /></svg>}
            </i>
            {t(key)}
          </div>
        ))}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>{error}</p>}
      {hold === 'failed' && <button className="btn ghost" style={{ marginTop: 14 }} onClick={retry}>{t('holdToVerify.retryButton')}</button>}

      <p className="disc">
        {t('holdToVerify.disc')}
      </p>

      {onCancel && hold !== 'success' && (
        <button className="btn ghost" style={{ marginTop: 10, width: '100%' }} onClick={onCancel}>{_cancelLabel}</button>
      )}
    </>
  )
}
