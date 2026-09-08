import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { Scan, Send, Book, Compass, User, Give } from '../components/icons'
import { useTheme } from '../lib/theme'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { useI18n } from '../lib/i18n'
import { prayerApi, type PrayerSchedule } from '../lib/api'
import { usePrefs } from '../lib/prefs'

interface DailyAction {
  id: string
  points: number
  done: boolean
  /** "pending" = awaiting Hasanat AI approval (prompt 4); "approved" = auto */
  status: 'pending' | 'approved' | 'done'
}

const initialActions: DailyAction[] = [
  { id: 'fajr', points: 10, done: false, status: 'approved' },
  { id: 'quran', points: 5, done: false, status: 'approved' },
  { id: 'log', points: 40, done: false, status: 'pending' },
]

function fmtCountdown(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Home() {
  const navigate = useNavigate()
  const { theme, toggle, mode, setAuto } = useTheme()
  const { state: wallet } = useWallet()
  const { toast } = useToast()
  const { t } = useI18n()
  const { prefs } = usePrefs()
  const [schedule, setSchedule] = useState<PrayerSchedule | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [actions, setActions] = useState<DailyAction[]>(initialActions)

  const actionLabel: Record<string, string> = {
    fajr: t('home.actionFajrLabel'),
    quran: t('home.actionQuranLabel'),
    log: t('home.actionLogLabel'),
  }
  const actionSub: Record<string, string> = {
    fajr: t('home.actionFajrSub'),
    quran: t('home.actionQuranSub'),
    log: t('home.actionLogSub'),
  }

  // Load prayer schedule from backend (real solar calc, user prefs for method/madhab).
  useEffect(() => {
    let cancelled = false
    const params = { method: prefs.calcMethod, madhab: prefs.madhab }
    prayerApi.schedule(params).then((s) => { if (!cancelled) { setSchedule(s); setCountdown(s.secondsUntilNext) } }).catch(() => {})
    // Refresh schedule every 5 min in case of day rollover.
    const refreshId = setInterval(() => {
      prayerApi.schedule(params).then((s) => { if (!cancelled) setSchedule(s) }).catch(() => {})
    }, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(refreshId) }
  }, [prefs.calcMethod, prefs.madhab])

  // Live countdown to the second.
  useEffect(() => {
    const id = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])

  function toggleTheme() {
    toggle() // manual toggle disables auto per spec
  }
  function reEnableAuto() {
    setAuto()
    toast(t('home.autoModeToast'))
  }

  function doAction(a: DailyAction) {
    if (a.done) return
    if (navigator.vibrate) navigator.vibrate(30)
    setActions((prev) => prev.map((x) => x.id === a.id ? { ...x, done: true, status: x.status === 'pending' ? 'pending' : 'done' } : x))
    toast(a.status === 'pending' ? t('home.pointsToastPending', { n: a.points }) : t('home.pointsToast', { n: a.points }))
  }

  const nextPrayer = schedule?.times[schedule.nextIndex]
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5) return t('home.greetingNight')
    if (h < 12) return t('home.greetingMorning')
    if (h < 17) return t('home.greetingAfternoon')
    return t('home.greetingEvening')
  })()

  return (
    <div className="screen">
      <Header
        title="Hasanat"
        right={
          <>
            <Shield />
            <button className="ibtn" onClick={toggleTheme} aria-label={t('header.toggleDayNight')}>
              {theme === 'day' ? '☾' : '☀'}
            </button>
            <button className="av-btn" aria-label="Profile" onClick={() => navigate('/profile')}>B</button>
          </>
        }
      />

      <div className="greet">
        <div style={{ fontFamily: 'var(--ar)', fontSize: 22, color: 'var(--accent)' }}>السلام عليكم</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, lineHeight: 1.15, marginTop: 2 }}>
          {t('home.greetingName', { greeting })}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          {schedule ? `${schedule.hijri} · ${new Date(schedule.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}` : t('common.loading')}
        </div>
      </div>

      {/* Prayer chip — live countdown */}
      <div className="pchip" onClick={() => navigate('/prayer')} style={{ cursor: 'pointer' }}>
        <div>
          <b>{t('home.nextPrayer', { name: nextPrayer?.name ?? '—' })}</b>
          <span>{schedule ? t('home.inTime', { h: Math.floor(countdown / 3600), m: Math.floor((countdown % 3600) / 60), city: schedule.city }) : t('common.loading')}</span>
        </div>
        <div className="cnt">{schedule ? fmtCountdown(countdown) : '--:--:--'}</div>
      </div>

      {/* Balance card — tap opens Wallet */}
      <div className="balance" onClick={() => navigate('/wallet')} style={{ cursor: 'pointer' }}>
        <div className="star bgstar" style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, background: 'rgba(255,255,255,0.07)' }} />
        <div className="lbl">{t('home.balance')}</div>
        <div className="num">{wallet ? wallet.balance.toLocaleString() : '—'}<small>HAS</small></div>
        <div className="sub">≈ {wallet ? wallet.balance.toLocaleString() : '—'}.00 SAR{wallet?.mockLedger ? ` · ${t('home.mockLedger')}` : ` · ${t('home.backedReserve')}`}</div>
        <div className="split">
          <div><b>{wallet ? wallet.points : '—'}</b><span>{t('home.points')}</span></div>
          <div><b>{wallet ? wallet.givenThisMonth : '—'}</b><span>{t('home.givenThisMonth')}</span></div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="qa">
        <button onClick={() => navigate('/pay')}><Scan /><span>Pay</span></button>
        <button onClick={() => navigate('/wallet')}><Send /><span>Send</span></button>
        <button onClick={() => navigate('/learn')}><Book /><span>Learn</span></button>
        <button onClick={() => navigate('/prayer')}><Compass /><span>Prayer</span></button>
      </div>

      {/* Today's actions */}
      <div className="pad sec">
        <h3>{t('home.todaysActions')}</h3>
        <div className="card">
          {actions.map((a) => (
            <div key={a.id} className={`act ${a.done ? 'done' : ''}`} onClick={() => doAction(a)} style={{ cursor: a.done ? 'default' : 'pointer' }}>
              <span className="cb">{a.done && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M5 12l4 4L19 7" /></svg>}</span>
              <div className="tx"><b>{actionLabel[a.id]}</b><span>{actionSub[a.id]}{a.status === 'pending' && !a.done ? ` · ${t('home.pending')}` : ''}</span></div>
              <div className="pts">+{a.points}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Explore */}
      <div className="pad sec">
        <h3>{t('home.explore')}</h3>
        <div className="explore">
          <button onClick={() => navigate('/chats')}><User /><b>{t('home.hasanatAI')}</b><span>{t('home.hasanatAISub')}</span></button>
          <button onClick={() => navigate('/give')}><Give /><b>{t('home.giveLabel')}</b><span>{t('home.giveSub')}</span></button>
          <button onClick={() => navigate('/mosques')}><Scan /><b>{t('home.mosquesLabel')}</b><span>{t('home.mosquesSub')}</span></button>
          <button onClick={() => navigate('/businesses')}><Book /><b>{t('home.businessesLabel')}</b><span>{t('home.businessesSub')}</span></button>
        </div>
      </div>

      {mode === 'manual' && (
        <div className="pad" style={{ marginTop: 16 }}>
          <button className="btn ghost" style={{ fontSize: 13, padding: '10px 16px' }} onClick={reEnableAuto}>{t('home.reEnableAuto')}</button>
        </div>
      )}
    </div>
  )
}
