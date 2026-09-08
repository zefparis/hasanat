import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import HoldToVerify from '../components/HoldToVerify'

type Step = 1 | 2 | 3

export default function SignIn() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpFilled, setOtpFilled] = useState(false)

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

  function toStep3() {
    setStep(3)
  }

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
          <HoldToVerify
            onSuccess={(res) => { signIn(res); navigate('/') }}
            title="HCS-U7 verification"
          />
        )}
      </div>
    </div>
  )
}
