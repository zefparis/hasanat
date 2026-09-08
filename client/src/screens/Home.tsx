import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { Scan, Send, Book, Compass, User, Give } from '../components/icons'
import { useTheme } from '../lib/theme'
import { useWallet } from '../lib/wallet'
import { useToast } from '../lib/toast'
import { prayerApi, type PrayerSchedule } from '../lib/api'

interface DailyAction {
  id: string
  label: string
  sub: string
  points: number
  done: boolean
  /** "pending" = awaiting Hasanat AI approval (prompt 4); "approved" = auto */
  status: 'pending' | 'approved' | 'done'
}

const initialActions: DailyAction[] = [
  { id: 'fajr', label: 'Fajr presence', sub: 'Check-in window open', points: 10, done: false, status: 'approved' },
  { id: 'quran', label: "Read 1 page of Qur'an", sub: 'Daily habit', points: 5, done: false, status: 'approved' },
  { id: 'log', label: 'Voluntary log', sub: 'Pending Hasanat AI approval', points: 40, done: false, status: 'pending' },
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
  const [schedule, setSchedule] = useState<PrayerSchedule | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [actions, setActions] = useState<DailyAction[]>(initialActions)

  // Load prayer schedule from backend (real solar calc).
  useEffect(() => {
    let cancelled = false
    prayerApi.schedule().then((s) => { if (!cancelled) { setSchedule(s); setCountdown(s.secondsUntilNext) } }).catch(() => {})
    // Refresh schedule every 5 min in case of day rollover.
    const refreshId = setInterval(() => {
      prayerApi.schedule().then((s) => { if (!cancelled) setSchedule(s) }).catch(() => {})
    }, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(refreshId) }
  }, [])

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
    toast('Auto mode: night follows Maghrib → Fajr')
  }

  function doAction(a: DailyAction) {
    if (a.done) return
    if (navigator.vibrate) navigator.vibrate(30)
    setActions((prev) => prev.map((x) => x.id === a.id ? { ...x, done: true, status: x.status === 'pending' ? 'pending' : 'done' } : x))
    toast(`+${a.points} Points${a.status === 'pending' ? ' · pending approval' : ''}`)
  }

  const nextPrayer = schedule?.times[schedule.nextIndex]
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5) return 'Good night'
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="screen">
      <Header
        title="Hasanat"
        right={
          <>
            <Shield />
            <button className="ibtn" onClick={toggleTheme} aria-label="Toggle day/night">
              {theme === 'day' ? '☾' : '☀'}
            </button>
            <button className="av-btn" aria-label="Profile" onClick={() => navigate('/profile')}>B</button>
          </>
        }
      />

      <div className="greet">
        <div style={{ fontFamily: 'var(--ar)', fontSize: 22, color: 'var(--accent)' }}>السلام عليكم</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, lineHeight: 1.15, marginTop: 2 }}>
          {greeting}, Ben
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
          {schedule ? `${schedule.hijri} · ${new Date(schedule.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}` : 'Loading…'}
        </div>
      </div>

      {/* Prayer chip — live countdown */}
      <div className="pchip" onClick={() => navigate('/prayer')} style={{ cursor: 'pointer' }}>
        <div>
          <b>Next prayer — {nextPrayer?.name ?? '—'}</b>
          <span>{schedule ? `in ${Math.floor(countdown / 3600)}h ${Math.floor((countdown % 3600) / 60)}m · ${schedule.city}` : 'Loading…'}</span>
        </div>
        <div className="cnt">{schedule ? fmtCountdown(countdown) : '--:--:--'}</div>
      </div>

      {/* Balance card — tap opens Wallet */}
      <div className="balance" onClick={() => navigate('/wallet')} style={{ cursor: 'pointer' }}>
        <div className="star bgstar" style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, background: 'rgba(255,255,255,0.07)' }} />
        <div className="lbl">Hasanat balance</div>
        <div className="num">{wallet ? wallet.balance.toLocaleString() : '—'}<small>HAS</small></div>
        <div className="sub">≈ {wallet ? wallet.balance.toLocaleString() : '—'}.00 SAR{wallet?.mockLedger ? ' · pilot mock ledger' : ' · backed 1:1 by reserve'}</div>
        <div className="split">
          <div><b>{wallet ? wallet.points : '—'}</b><span>Points</span></div>
          <div><b>{wallet ? wallet.givenThisMonth : '—'}</b><span>Given this month</span></div>
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
        <h3>Today's actions</h3>
        <div className="card">
          {actions.map((a) => (
            <div key={a.id} className={`act ${a.done ? 'done' : ''}`} onClick={() => doAction(a)} style={{ cursor: a.done ? 'default' : 'pointer' }}>
              <span className="cb">{a.done && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M5 12l4 4L19 7" /></svg>}</span>
              <div className="tx"><b>{a.label}</b><span>{a.sub}{a.status === 'pending' && !a.done ? ' · pending' : ''}</span></div>
              <div className="pts">+{a.points}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Explore */}
      <div className="pad sec">
        <h3>Explore</h3>
        <div className="explore">
          <button onClick={() => navigate('/chats')}><User /><b>Hasanat AI</b><span>Ask about prayer, Zakat, giving</span></button>
          <button onClick={() => navigate('/give')}><Give /><b>Give</b><span>Zakat, Sadaqah, Waqf</span></button>
          <button onClick={() => navigate('/mosques')}><Scan /><b>Mosques</b><span>Nearby, donate, institution wallet</span></button>
          <button onClick={() => navigate('/businesses')}><Book /><b>Businesses</b><span>Directory, pay, merchant POS</span></button>
        </div>
      </div>

      {mode === 'manual' && (
        <div className="pad" style={{ marginTop: 16 }}>
          <button className="btn ghost" style={{ fontSize: 13, padding: '10px 16px' }} onClick={reEnableAuto}>Re-enable auto night mode</button>
        </div>
      )}
    </div>
  )
}
