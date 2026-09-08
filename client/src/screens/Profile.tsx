import { useNavigate } from 'react-router-dom'
import Overlay from '../components/Overlay'
import Shield from '../components/Shield'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import type { LedgerEntry } from '../lib/api'

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function toCSV(entries: LedgerEntry[]): string {
  const rows = [['Date', 'Description', 'Label', 'Amount', 'Unit', 'Receipt'].join(',')]
  for (const e of entries) {
    rows.push([fmtDate(e.ts), `"${e.description}"`, e.label, e.amount, e.unit, e.receiptNo ?? ''].join(','))
  }
  return rows.join('\n')
}

function toPDF(entries: LedgerEntry[]): string {
  const lines = entries.map((e) => `${fmtDate(e.ts)}  ${e.description}  ${e.label}  ${e.amount > 0 ? '+' : ''}${e.amount} ${e.unit}`)
  const text = ['Hasanat - Activity Statement', `Generated ${new Date().toLocaleString('en-GB')}`, '', ...lines].join('\n')
  const esc = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = `BT /F1 9 Tf 1 0 0 1 50 760 Tm 14 TL (${esc.split('\n').join(') Tj T* (')}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  ]
  let body = ''
  objs.forEach((o, i) => { body += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  const offset = xref.length + body.length
  return `%PDF-1.4\n${body}${xref}${offset} 00000 n \ntrailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`
}

export default function Profile() {
  const navigate = useNavigate()
  const { status, signOut } = useAuth()
  const { theme, toggle, mode, setAuto } = useTheme()
  const { entries } = useWallet()
  const { toast } = useToast()
  const v = status

  async function handleSignOut() {
    await signOut()
    navigate('/signin', { replace: true })
  }

  function exportCSV() {
    downloadFile('hasanat-activity.csv', toCSV(entries), 'text/csv')
    toast('CSV exported — your activity statement has been downloaded')
  }
  function exportPDF() {
    downloadFile('hasanat-activity.pdf', toPDF(entries), 'application/pdf')
    toast('PDF exported — your activity statement has been downloaded')
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

      {/* HCS-U7 session — real data from the 30s poll */}
      <div className="sec">
        <h3>HCS-U7 session</h3>
        <div className="card">
          <div className="kv"><span>Identity assurance</span><b>{v ? (v.riskLevel === 'low' ? 'High' : v.riskLevel === 'medium' ? 'Medium' : 'Low') : '—'}</b></div>
          <div className="kv"><span>Last re-verification</span><b>{v ? 'just now' : '—'}</b></div>
          <div className="kv"><span>Device bound</span><b style={{ color: 'var(--ok)' }}>Yes</b></div>
          <div className="kv"><span>Verifications this session</span><b>{v?.verificationCount ?? '—'}</b></div>
          <div className="kv"><span>Rotation</span><b>{v ? `${v.rotation.rotationPeriodSeconds}s · ${v.rotation.secondsUntilRotation}s left` : '—'}</b></div>
          <div className="kv"><span>Session status</span><b style={{ color: v?.isHuman ? 'var(--ok)' : 'var(--danger)' }}>{v?.isHuman ? 'Verified human' : 'Not verified'}</b></div>
          <p className="disc">HCS-U7 continuously verifies that the person using the session is the enrolled account holder. If the signature no longer matches, financial functions lock instantly.</p>
        </div>
      </div>

      {/* Jurisdiction & limits */}
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

      {/* Day/night toggle */}
      <div className="sec">
        <h3>Appearance</h3>
        <div className="card">
          <div className="item">
            <div className="ic">{theme === 'night' ? '☾' : '☀'}</div>
            <div className="tx">
              <b>{theme === 'night' ? 'Night palette' : 'Day palette'}</b>
              <span>{mode === 'auto' ? 'Auto: follows Maghrib → Fajr' : 'Manual override'}</span>
            </div>
            <button className="ibtn" onClick={toggle} aria-label="Toggle">{theme === 'day' ? '☾' : '☀'}</button>
          </div>
          {mode === 'manual' && (
            <button className="btn ghost" style={{ marginTop: 10, fontSize: 13 }} onClick={() => { setAuto(); toast('Auto mode: night follows Maghrib → Fajr') }}>
              Re-enable auto
            </button>
          )}
        </div>
      </div>

      {/* Export & privacy */}
      <div className="sec">
        <h3>Export & privacy</h3>
        <div className="card">
          <div className="item" style={{ cursor: 'pointer' }} onClick={exportCSV}>
            <div className="ic">📋</div>
            <div className="tx"><b>Export activity (CSV)</b><span>Download your full ledger as CSV</span></div>
          </div>
          <div className="item" style={{ cursor: 'pointer' }} onClick={exportPDF}>
            <div className="ic">📄</div>
            <div className="tx"><b>Export activity (PDF)</b><span>Download your full ledger as PDF</span></div>
          </div>
          <div className="item">
            <div className="ic">�</div>
            <div className="tx"><b>Privacy</b><span>Your journal is local-only. No blockchain exposure.</span></div>
          </div>
        </div>
      </div>

      {/* Family */}
      <div className="sec">
        <h3>Family</h3>
        <div className="card">
          <div className="item" style={{ cursor: 'pointer' }} onClick={() => navigate('/chats')}>
            <div className="ic">👪</div>
            <div className="tx"><b>Manage members</b><span>Ben, Fatima, Omar</span></div>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="sec">
        <button className="btn ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleSignOut}>Sign out</button>
      </div>
    </Overlay>
  )
}
