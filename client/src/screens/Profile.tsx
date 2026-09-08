import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Overlay from '../components/Overlay'
import Shield from '../components/Shield'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useI18n } from '../lib/i18n'
import { usePrefs, type CalcMethod, type Madhab, type AppLockTimeout } from '../lib/prefs'
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

// ─── Small UI helpers ────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className="track"><span className="thumb" /></span>
    </label>
  )
}

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const
const METHODS: CalcMethod[] = ['MWL', 'ISNA', 'UMM_QURA', 'EGYPTIAN', 'KARACHI']
const LOCK_OPTIONS: AppLockTimeout[] = ['immediate', '1min', '5min', 'never']

export default function Profile() {
  const navigate = useNavigate()
  const { status, signOut } = useAuth()
  const { theme, toggle, mode, setAuto } = useTheme()
  const { entries } = useWallet()
  const { toast } = useToast()
  const { t, setLocale, locale } = useI18n()
  const { prefs, update } = usePrefs()
  const v = status

  const [showFaq, setShowFaq] = useState(false)
  const [showLegal, setShowLegal] = useState(false)

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

      {/* ─── Section 1: Notifications ─────────────────────────────────────────── */}
      <div className="sec">
        <h3>{t('profile.notifications')}</h3>
        <div className="card">
          {/* Prayer reminders */}
          <div className="item">
            <div className="ic">🕌</div>
            <div className="tx">
              <b>{t('profile.notifPrayerReminders')}</b>
              <span>{t('profile.notifPrayerRemindersSub')}</span>
            </div>
            <Toggle checked={prefs.prayerReminders} onChange={() => update('prayerReminders', !prefs.prayerReminders)} label={t('profile.notifPrayerReminders')} />
          </div>
          {prefs.prayerReminders && (
            <div style={{ paddingLeft: 48, paddingBottom: 8 }}>
              {PRAYERS.map((p) => (
                <div key={p} className="item" style={{ padding: '4px 0' }}>
                  <div className="tx"><span>{p}</span></div>
                  <Toggle
                    checked={prefs.prayerReminderPrayers[p] ?? true}
                    onChange={() => update('prayerReminderPrayers', { ...prefs.prayerReminderPrayers, [p]: !(prefs.prayerReminderPrayers[p] ?? true) })}
                    label={p}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Transaction alerts */}
          <div className="item">
            <div className="ic">💳</div>
            <div className="tx">
              <b>{t('profile.notifTransactionAlerts')}</b>
              <span>{t('profile.notifTransactionAlertsSub')}</span>
            </div>
            <Toggle checked={prefs.transactionAlerts} onChange={() => update('transactionAlerts', !prefs.transactionAlerts)} label={t('profile.notifTransactionAlerts')} />
          </div>

          {/* Donation alerts */}
          <div className="item">
            <div className="ic">🤲</div>
            <div className="tx">
              <b>{t('profile.notifDonationAlerts')}</b>
              <span>{t('profile.notifDonationAlertsSub')}</span>
            </div>
            <Toggle checked={prefs.donationAlerts} onChange={() => update('donationAlerts', !prefs.donationAlerts)} label={t('profile.notifDonationAlerts')} />
          </div>

          {/* Check-in reminder */}
          <div className="item">
            <div className="ic">⏰</div>
            <div className="tx">
              <b>{t('profile.notifCheckInReminder')}</b>
              <span>{t('profile.notifCheckInReminderSub')}</span>
            </div>
            <Toggle checked={prefs.checkInReminder} onChange={() => update('checkInReminder', !prefs.checkInReminder)} label={t('profile.notifCheckInReminder')} />
          </div>

          <p className="disc">{t('profile.notifPrayerRemindersPilot')}</p>
        </div>
      </div>

      {/* ─── Section 2: Security ──────────────────────────────────────────────── */}
      <div className="sec">
        <h3>{t('profile.security')}</h3>
        <div className="card">
          {/* App lock */}
          <div className="kv">
            <span>{t('profile.secAppLock')}</span>
            <b>
              <select className="sel" value={prefs.appLockTimeout} onChange={(e) => update('appLockTimeout', e.target.value as AppLockTimeout)}>
                {LOCK_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'immediate' ? t('profile.secAppLockImmediate')
                      : opt === '1min' ? t('profile.secAppLock1min')
                      : opt === '5min' ? t('profile.secAppLock5min')
                      : t('profile.secAppLockNever')}
                  </option>
                ))}
              </select>
            </b>
          </div>
          <p className="disc" style={{ marginTop: 4 }}>{t('profile.secAppLockPilot')}</p>

          {/* Linked device */}
          <div className="item">
            <div className="ic">📱</div>
            <div className="tx">
              <b>{t('profile.secLinkedDevice')}</b>
              <span>{t('profile.secLinkedDeviceSub')}</span>
            </div>
          </div>
          <div className="kv"><span> </span><b style={{ fontSize: 13, color: 'var(--muted)' }}>{t('profile.secSingleDevice')}</b></div>

          {/* Session timeout */}
          <div className="kv" style={{ marginTop: 8 }}>
            <span>{t('profile.secSessionTimeout')}</span>
            <b>
              <input
                type="number"
                min={1}
                max={15}
                value={prefs.sessionTimeoutMin}
                onChange={(e) => update('sessionTimeoutMin', Math.max(1, Math.min(15, Number(e.target.value) || 5)))}
                style={{ width: 50, background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 14, textAlign: 'center' }}
              />
              <span style={{ marginLeft: 4, color: 'var(--muted)', fontSize: 13 }}>min</span>
            </b>
          </div>
          <p className="disc" style={{ marginTop: 4 }}>{t('profile.secSessionTimeoutSub')}</p>
        </div>
      </div>

      {/* ─── Section 3: Prayer preferences ────────────────────────────────────── */}
      <div className="sec">
        <h3>{t('profile.prayerPrefs')}</h3>
        <div className="card">
          {/* Calculation method */}
          <div className="kv">
            <span>{t('profile.prayerCalcMethod')}</span>
            <b>
              <select className="sel" value={prefs.calcMethod} onChange={(e) => update('calcMethod', e.target.value as CalcMethod)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{t(`profile.method${m}`)}</option>
                ))}
              </select>
            </b>
          </div>
          <p className="disc" style={{ marginTop: 4 }}>{t('profile.prayerCalcMethodSub')}</p>

          {/* Madhab */}
          <div className="kv" style={{ marginTop: 8 }}>
            <span>{t('profile.prayerMadhab')}</span>
            <b>
              <select className="sel" value={prefs.madhab} onChange={(e) => update('madhab', e.target.value as Madhab)}>
                <option value="standard">{t('profile.madhabStandard')}</option>
                <option value="hanafi">{t('profile.madhabHanafi')}</option>
              </select>
            </b>
          </div>
          <p className="disc" style={{ marginTop: 4 }}>{t('profile.prayerMadhabSub')}</p>
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
            <div className="ic">🔒</div>
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

      {/* ─── Section 4: Help & legal ──────────────────────────────────────────── */}
      <div className="sec">
        <h3>{t('profile.helpLegal')}</h3>
        <div className="card">
          {/* FAQ */}
          <div className={`item expand${showFaq ? ' open' : ''}`} onClick={() => setShowFaq(!showFaq)}>
            <div className="ic">❓</div>
            <div className="tx"><b>{t('profile.helpFaq')}</b><span>{t('profile.helpFaqSub')}</span></div>
            <span className="chev" style={{ color: 'var(--muted)' }}>▸</span>
          </div>
          {showFaq && (
            <p className="disc" style={{ paddingLeft: 48 }}>{t('profile.helpFaqPlaceholder')}</p>
          )}

          {/* Contact */}
          <a className="item" style={{ textDecoration: 'none', color: 'inherit' }} href="mailto:support@hasanat.app">
            <div className="ic">✉️</div>
            <div className="tx"><b>{t('profile.helpContact')}</b><span>{t('profile.helpContactSub')}</span></div>
          </a>

          {/* Legal mentions */}
          <div className={`item expand${showLegal ? ' open' : ''}`} onClick={() => setShowLegal(!showLegal)}>
            <div className="ic">📜</div>
            <div className="tx"><b>{t('profile.helpLegalMentions')}</b><span>{t('profile.helpLegalSub')}</span></div>
            <span className="chev" style={{ color: 'var(--muted)' }}>▸</span>
          </div>
          {showLegal && (
            <div style={{ paddingLeft: 48, paddingBottom: 8 }}>
              <p className="disc"><b>{t('profile.helpTos')}</b><br />{t('profile.helpTosPlaceholder')}</p>
              <p className="disc"><b>{t('profile.helpPrivacy')}</b><br />{t('profile.helpPrivacyPlaceholder')}</p>
              <p className="disc"><b>{t('profile.helpAbout')}</b><br />{t('profile.helpAboutText')}</p>
              <p className="disc">{t('profile.helpHcsCredit')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div className="sec">
        <button className="btn ghost" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleSignOut}>{t('profile.signOut')}</button>
      </div>
    </Overlay>
  )
}
