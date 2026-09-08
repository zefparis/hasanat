import { useNavigate } from 'react-router-dom'
import Overlay from '../components/Overlay'
import Shield from '../components/Shield'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useI18n } from '../lib/i18n'
import type { LedgerEntry } from '../lib/api'

type TFunc = (key: string, vars?: Record<string, string | number>) => string

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

function toCSV(entries: LedgerEntry[], t: TFunc): string {
  const rows = [[t('wallet.csvDate'), t('wallet.csvDesc'), t('wallet.csvLabel'), t('wallet.csvAmount'), t('wallet.csvUnit'), t('wallet.csvReceipt')].join(',')]
  for (const e of entries) {
    rows.push([fmtDate(e.ts), `"${e.description}"`, e.label, e.amount, e.unit, e.receiptNo ?? ''].join(','))
  }
  return rows.join('\n')
}

function toPDF(entries: LedgerEntry[], t: TFunc): string {
  const lines = entries.map((e) => `${fmtDate(e.ts)}  ${e.description}  ${e.label}  ${e.amount > 0 ? '+' : ''}${e.amount} ${e.unit}`)
  const text = [t('wallet.pdfTitle'), t('wallet.pdfGenerated', { date: new Date().toLocaleString('en-GB') }), '', ...lines].join('\n')
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
  const { t, setLocale, locale } = useI18n()
  const v = status

  async function handleSignOut() {
    await signOut()
    navigate('/signin', { replace: true })
  }

  function exportCSV() {
    downloadFile('hasanat-activity.csv', toCSV(entries, t), 'text/csv')
    toast(t('profile.toastCsvExported'))
  }
  function exportPDF() {
    downloadFile('hasanat-activity.pdf', toPDF(entries, t), 'application/pdf')
    toast(t('profile.toastPdfExported'))
  }

  return (
    <Overlay title={t('profile.title')} subtitle={t('profile.subtitle')}>
      <div className="card">
        <div className="row">
          <div className="av-btn" style={{ width: 56, height: 56, fontSize: 22 }}>B</div>
          <div style={{ flex: 1 }}><b style={{ fontSize: 16 }}>{t('profile.name')}</b><div className="muted">{t('profile.phone')}</div></div>
          <Shield />
        </div>
      </div>

      {/* HCS-U7 session — real data from the last verification */}
      <div className="sec">
        <h3>{t('profile.hcsSession')}</h3>
        <div className="card">
          <div className="kv"><span>{t('profile.identityAssurance')}</span><b>{v ? (v.riskLevel === 'low' ? t('profile.assuranceHigh') : v.riskLevel === 'medium' ? t('profile.assuranceMedium') : t('profile.assuranceLow')) : '—'}</b></div>
          <div className="kv"><span>{t('profile.lastVerification')}</span><b>{v?.verifiedAt ? new Date(v.verifiedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</b></div>
          <div className="kv"><span>{t('profile.deviceBound')}</span><b style={{ color: 'var(--ok)' }}>{t('common.yes')}</b></div>
          <div className="kv"><span>{t('profile.sessionStatus')}</span><b style={{ color: v?.isHuman ? 'var(--ok)' : 'var(--danger)' }}>{v?.isHuman ? t('profile.verifiedHuman') : t('profile.notVerified')}</b></div>
          <p className="disc">{t('profile.hcsDisc')}</p>
        </div>
      </div>

      {/* Jurisdiction & limits */}
      <div className="sec">
        <h3>{t('profile.jurisdiction')}</h3>
        <div className="card">
          <div className="kv"><span>{t('profile.city')}</span><b>{t('profile.cityValue')}</b></div>
          <div className="kv"><span>{t('profile.tier')}</span><b>{t('profile.tierValue')}</b></div>
          <div className="kv"><span>{t('profile.monthlyCap')}</span><b>{t('profile.monthlyCapValue')}</b></div>
          <div className="kv"><span>{t('profile.crossBorder')}</span><b style={{ color: 'var(--danger)' }}>{t('profile.crossBorderValue')}</b></div>
          <div className="kv"><span>{t('profile.language')}</span><b>
            <button onClick={() => setLocale('en')} style={{ background: locale === 'en' ? 'var(--primary)' : 'var(--surface)', color: locale === 'en' ? '#fff' : 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer', marginRight: 4 }}>EN</button>
            <button onClick={() => setLocale('ar')} style={{ background: locale === 'ar' ? 'var(--primary)' : 'var(--surface)', color: locale === 'ar' ? '#fff' : 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>ع</button>
          </b></div>
        </div>
      </div>

      {/* Day/night toggle */}
      <div className="sec">
        <h3>{t('profile.appearance')}</h3>
        <div className="card">
          <div className="item">
            <div className="ic">{theme === 'night' ? '☾' : '☀'}</div>
            <div className="tx">
              <b>{theme === 'night' ? t('profile.nightPalette') : t('profile.dayPalette')}</b>
              <span>{mode === 'auto' ? t('profile.autoFollows') : t('profile.manualOverride')}</span>
            </div>
            <button className="ibtn" onClick={toggle} aria-label={t('profile.toggle')}>{theme === 'day' ? '☾' : '☀'}</button>
          </div>
          {mode === 'manual' && (
            <button className="btn ghost" style={{ marginTop: 10, fontSize: 13 }} onClick={() => { setAuto(); toast(t('profile.toastAutoMode')) }}>
              {t('profile.reEnableAuto')}
            </button>
          )}
        </div>
      </div>

      {/* Export & privacy */}
      <div className="sec">
        <h3>{t('profile.exportPrivacy')}</h3>
        <div className="card">
          <div className="item" style={{ cursor: 'pointer' }} onClick={exportCSV}>
            <div className="ic">📋</div>
            <div className="tx"><b>{t('profile.exportCsv')}</b><span>{t('profile.exportCsvSub')}</span></div>
          </div>
          <div className="item" style={{ cursor: 'pointer' }} onClick={exportPDF}>
            <div className="ic">📄</div>
            <div className="tx"><b>{t('profile.exportPdf')}</b><span>{t('profile.exportPdfSub')}</span></div>
          </div>
          <div className="item">
            <div className="ic">�</div>
            <div className="tx"><b>{t('profile.privacy')}</b><span>{t('profile.privacyDisc')}</span></div>
          </div>
        </div>
      </div>

      {/* Family */}
      <div className="sec">
        <h3>{t('profile.family')}</h3>
        <div className="card">
          <div className="item" style={{ cursor: 'pointer' }} onClick={() => navigate('/chats')}>
            <div className="ic">👪</div>
            <div className="tx"><b>{t('profile.manageMembers')}</b><span>{t('profile.familyMembers')}</span></div>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="sec">
        <button className="btn ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleSignOut}>{t('profile.signOut')}</button>
      </div>
    </Overlay>
  )
}
