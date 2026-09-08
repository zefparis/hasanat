import { useNavigate } from 'react-router-dom'
import Overlay from '../components/Overlay'
import Shield from '../components/Shield'
import { useAuth } from '../lib/auth'

export default function Profile() {
  const { status, signOut } = useAuth()
  const navigate = useNavigate()
  const v = status

  async function handleSignOut() {
    await signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <Overlay title="Profile" subtitle="Session · limits · settings">
      <div className="card">
        <div className="row">
          <div className="av-btn" style={{ width: 56, height: 56, fontSize: 22 }}>B</div>
          <div style={{ flex: 1 }}><b style={{ fontSize: 16 }}>Ben</b><div className="muted">+27 71 234 5678</div></div>
          <Shield />
        </div>
      </div>
      <div className="sec">
        <h3>HCS-U7 session</h3>
        <div className="card">
          <div className="kv"><span>Identity assurance</span><b>{v ? (v.riskLevel === 'low' ? 'High' : v.riskLevel === 'medium' ? 'Medium' : 'Low') : '—'}</b></div>
          <div className="kv"><span>Last re-verification</span><b>{v ? 'just now' : '—'}</b></div>
          <div className="kv"><span>Device bound</span><b style={{ color: 'var(--ok)' }}>Yes</b></div>
          <div className="kv"><span>Verifications this session</span><b>{v?.verificationCount ?? '—'}</b></div>
          <div className="kv"><span>Rotation</span><b>{v ? `${v.rotation.rotationPeriodSeconds}s · ${v.rotation.secondsUntilRotation}s left` : '—'}</b></div>
          <p className="disc">HCS-U7 continuously verifies that the person using the session is the enrolled account holder. If the signature no longer matches, financial functions lock instantly.</p>
        </div>
      </div>
      <div className="sec">
        <h3>Jurisdiction & limits</h3>
        <div className="card">
          <div className="kv"><span>City</span><b>Johannesburg, ZA</b></div>
          <div className="kv"><span>Tier</span><b>Standard</b></div>
          <div className="kv"><span>Monthly cap</span><b>10,000 HAS</b></div>
          <div className="kv"><span>Cross-border</span><b style={{ color: 'var(--danger)' }}>Disabled</b></div>
          <div className="kv"><span>Language</span><b>English</b></div>
        </div>
      </div>
      <div className="sec">
        <h3>Settings</h3>
        <div className="card">
          <div className="item"><div className="ic">☾</div><div className="tx"><b>Day / night</b><span>Auto Maghrib → Fajr</span></div></div>
          <div className="item"><div className="ic">⬇</div><div className="tx"><b>Export & privacy</b><span>PDF / CSV</span></div></div>
          <div className="item"><div className="ic">👪</div><div className="tx"><b>Family</b><span>Manage members</span></div></div>
        </div>
        <button className="btn ghost" style={{ marginTop: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleSignOut}>Sign out</button>
      </div>
    </Overlay>
  )
}
