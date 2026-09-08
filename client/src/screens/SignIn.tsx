import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hcsApi, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'

type Step = 1 | 2 | 3
type HoldState = 'idle' | 'holding' | 'verifying' | 'success' | 'failed'

const CHECKS = [
  'Device bound to account',
  'Liveness confirmed',
  'Cognitive signature matched',
  'Session secured, continuous verification on',
] as const

export default function SignIn() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpFilled, setOtpFilled] = useState(false)

  const [hold, setHold] = useState<HoldState>('idle')
  const [progress, setProgress] = useState(0)
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false])
  const [error, setError] = useState<string | null>(null)

  const sessionPublicIdRef = useRef<string | null>(null)
  const holdStartRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const releasedEarlyRef = useRef(false)
  const verifyInFlightRef = useRef(false)

  function toStep2() {
    if (!phone.trim()) return
    setStep(2)
  }

  useEffect(() => {
    if (step !== 2) return
    let i = 0
    const id = setInterval(() => {
      if (i >= 6) {
        clearInterval(id)
        setOtpFilled(true)
        return
      }
      setOtp((prev) => {
        const next = [...prev]
        next[i] = String((i + 1) % 10)
        return next
      })
      i++
    }, 180)
    return () => clearInterval(id)
  }, [step])

  async function toStep3() {
    setStep(3)
    setError(null)
    setChecks([false, false, false, false])
    setHold('idle')
    setProgress(0)
    try {
      const s = await hcsApi.createSession()
      sessionPublicIdRef.current = s.sessionPublicId
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start HCS-U7 session.')
      setHold('failed')
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (hold === 'success' || hold === 'verifying') return
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
      setError('No HCS-U7 session. Go back and retry.')
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
        setError('Released before confirmation. Press and hold again.')
        return
      }
      const c = res.result.checks
      ;[c.deviceBound, c.liveness, c.cognitiveSignatureMatched, c.secureSession].forEach((v, i) => {
        setTimeout(() => setChecks((prev) => { const n = [...prev]; n[i] = v; return n }), i * 180)
      })
      setHold('success')
      setTimeout(() => { signIn(res.sid); navigate('/') }, 700)
    } catch (e) {
      verifyInFlightRef.current = false
      if (releasedEarlyRef.current) {
        setHold('failed')
        setError('Released before confirmation. Press and hold again.')
        return
      }
      setHold('failed')
      setError(e instanceof ApiError ? e.message : 'HCS-U7 verification failed. Retry.')
    }
  }

  function onPointerUp() {
    if (hold === 'success' || hold === 'failed') return
    if (verifyInFlightRef.current) {
      releasedEarlyRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setHold('failed')
      setError('Released before confirmation. Press and hold again.')
      return
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setHold('idle')
    setProgress(0)
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return (
    <div className="screen overlay" style={{ padding: 0, background: 'var(--primary)', color: '#fff', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 20px', textAlign: 'center' }}>
        <div className="star bigstar" style={{ width: 110, height: 110, background: 'var(--accent)', marginBottom: 26 }} />
        <div style={{ fontFamily: 'var(--ar)', fontSize: 44, lineHeight: 1, marginBottom: 6 }}>حسنات</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 500 }}>Hasanat</div>
        <p style={{ opacity: 0.75, fontSize: 13.5, marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>
          Presence, wallet, and giving — secured by HCS-U7 cognitive identity.
        </p>
      </div>

      <div style={{ background: 'var(--bg)', color: 'var(--ink)', borderRadius: '28px 28px 0 0', padding: '22px 20px calc(env(safe-area-inset-bottom) + 28px)' }}>
        {step === 1 && (
          <>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>Sign in</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
              Enter your phone number. We'll send a one-time code, then hold the gold star for HCS-U7 verification.
            </p>
            <div className="field">
              <label>Phone number</label>
              <input inputMode="tel" placeholder="+27 71 234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <button className="btn" style={{ marginTop: 18 }} onClick={toStep2} disabled={!phone.trim()}>Continue</button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>Enter the code</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
              Sent to {phone}. Reading it automatically for the pilot.
            </p>
            <div className="otp" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {otp.map((d, i) => (
                <div key={i} style={{
                  flex: 1, aspectRatio: '1 / 1.15', borderRadius: 12,
                  background: d ? 'var(--ok-soft)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--serif)', fontSize: 24, border: '1.5px solid', borderColor: d ? 'var(--primary-2)' : 'var(--line)',
                }}>{d}</div>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 18 }} disabled={!otpFilled} onClick={toStep3}>Verify</button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>HCS-U7 verification</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, lineHeight: 1.5 }}>
              Press and hold the star. Your cognitive signature is captured on this device and compared to your enrolled profile.
            </p>

            <div
              className={`hold ${hold === 'holding' ? 'on' : ''}`}
              style={{ margin: '22px auto 0', width: 150, height: 150, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', touchAction: 'none' }}
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
              {CHECKS.map((label, i) => (
                <div key={label} className={checks[i] ? 'ok' : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: checks[i] ? 'var(--ink)' : 'var(--muted)', opacity: checks[i] ? 1 : 0.5, transition: '.3s' }}>
                  <i style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid', borderColor: checks[i] ? 'var(--ok)' : 'var(--line)', background: checks[i] ? 'var(--ok)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {checks[i] && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ width: 12, height: 12 }}><path d="M5 12l4 4L19 7" /></svg>}
                  </i>
                  {label}
                </div>
              ))}
            </div>

            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14, lineHeight: 1.5 }}>{error}</p>}
            {hold === 'failed' && <button className="btn ghost" style={{ marginTop: 14 }} onClick={toStep3}>Retry verification</button>}

            <p className="disc">
              HCS-U7 authenticates an identity, never a devotional act. This confirms you are the verified human
              behind the session — nothing more. Releasing before confirmation fails the check.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
