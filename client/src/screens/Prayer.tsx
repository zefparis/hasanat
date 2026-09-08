import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { useTheme } from '../lib/theme'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { prayerApi, presenceApi, type PrayerSchedule, type CheckInWindow, type CheckInResult, type CheckInHistoryEntry } from '../lib/api'

// Qibla bearing from Johannesburg to Kaaba: ~70° from North
const QIBLA_BEARING = 70

export default function Prayer() {
  const { theme, toggle, mode, setAuto } = useTheme()
  const { toast } = useToast()
  const { status } = useAuth()
  const [schedule, setSchedule] = useState<PrayerSchedule | null>(null)
  const [window_, setWindow] = useState<CheckInWindow | null>(null)
  const [history, setHistory] = useState<CheckInHistoryEntry[]>([])
  const [checkedInToday, setCheckedInToday] = useState<Record<string, boolean>>({})
  const [checkingIn, setCheckingIn] = useState(false)
  const [journal, setJournal] = useState('')
  const [journalSaved, setJournalSaved] = useState(false)
  const [heading, setHeading] = useState<number | null>(null)
  const [compassSupported, setCompassSupported] = useState(true)

  // Load prayer schedule + check-in window + history
  useEffect(() => {
    function loadAll() {
      prayerApi.schedule().then(setSchedule).catch(() => {})
      presenceApi.window().then(setWindow).catch(() => {})
      presenceApi.history().then((h) => setHistory(h.history)).catch(() => {})
      presenceApi.today().then((t) => {
        const map: Record<string, boolean> = {}
        t.checkedInToday.forEach((p) => { map[p.name] = p.checkedIn })
        setCheckedInToday(map)
      }).catch(() => {})
    }
    loadAll()
    const id = setInterval(loadAll, 30_000) // refresh window every 30s
    return () => clearInterval(id)
  }, [])

  // DeviceOrientationEvent for Qibla compass
  useEffect(() => {
    function handleOrientation(e: DeviceOrientationEvent) {
      if (e.alpha != null) {
        // alpha is degrees from north, clockwise
        setHeading(360 - e.alpha)
      }
    }
    function handleOrientationWebkit(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
      if (e.webkitCompassHeading != null) {
        setHeading(e.webkitCompassHeading)
      }
    }

    // iOS 13+ requires permission
    const anyDOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof anyDOE.requestPermission === 'function') {
      // Permission will be requested on user interaction (compass tap)
      setCompassSupported(true)
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation as EventListener)
      window.addEventListener('deviceorientation', handleOrientationWebkit as EventListener)
      setCompassSupported(true)
    } else {
      setCompassSupported(false)
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation as EventListener)
      window.removeEventListener('deviceorientation', handleOrientationWebkit as EventListener)
    }
  }, [])

  async function requestCompass() {
    const anyDOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof anyDOE.requestPermission === 'function') {
      try {
        const result = await anyDOE.requestPermission()
        if (result === 'granted') {
          window.addEventListener('deviceorientation', (e: DeviceOrientationEvent) => {
            if (e.alpha != null) setHeading(360 - e.alpha)
          })
          toast('Compass enabled')
        } else {
          toast('Compass permission denied — using static bearing')
        }
      } catch {
        toast('Compass unavailable — using static bearing')
      }
    } else {
      toast('Compass not supported — showing static Qibla bearing')
    }
  }

  async function doCheckIn() {
    if (checkingIn) return
    if (!status?.isHuman) {
      toast('HCS-U7 session not verified — re-verify to record presence')
      return
    }
    setCheckingIn(true)
    try {
      const result: CheckInResult = await presenceApi.checkIn()
      if (result.ok) {
        // "presence recorded" — NEVER "prayer verified"
        toast(`Presence recorded · +${result.pointsAwarded} Points`)
        if (navigator.vibrate) navigator.vibrate(30)
        setCheckedInToday((prev) => ({ ...prev, [result.prayerName]: true }))
        // Refresh history
        presenceApi.history().then((h) => setHistory(h.history)).catch(() => {})
      } else {
        // Anti-doublon: clear refusal with message
        toast(result.message)
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      // Handle 400 responses (window closed, already checked in, etc.)
      toast(err?.message || 'Check-in failed')
    } finally {
      setCheckingIn(false)
    }
  }

  function saveJournal() {
    if (!journal.trim()) return
    // Private journal: stored locally, NEVER on blockchain, NEVER exposed elsewhere
    const entries = JSON.parse(localStorage.getItem('hasanat.journal') || '[]')
    entries.unshift({ text: journal.trim(), ts: Date.now() })
    localStorage.setItem('hasanat.journal', JSON.stringify(entries.slice(0, 100)))
    setJournal('')
    setJournalSaved(true)
    toast('Journal saved · +10 Points')
    if (navigator.vibrate) navigator.vibrate(30)
    setTimeout(() => setJournalSaved(false), 2000)
  }

  const nextPrayer = schedule?.times[schedule.nextIndex]
  const canCheckIn = window_?.isOpen && !checkedInToday[window_.prayerName] && !checkingIn
  const alreadyCheckedIn = window_ && checkedInToday[window_.prayerName]

  // Qibla compass needle rotation
  const needleRotation = heading != null ? QIBLA_BEARING - heading : QIBLA_BEARING

  return (
    <div className="screen">
      <Header title="Prayer" right={<Shield />} />

      {/* Next prayer chip */}
      <div className="pchip">
        <div>
          <b>Next prayer — {nextPrayer?.name ?? '—'}</b>
          <span>{schedule ? `${schedule.city} · ${schedule.hijri}` : 'Loading...'}</span>
        </div>
      </div>

      {/* Prayer times */}
      <div className="pad sec">
        <h3>Today's times</h3>
        <div className="card">
          {schedule ? schedule.times.map((t) => (
            <div key={t.name} className="item" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 10 }}>
              <div className="tx">
                <b style={{ fontSize: 14 }}>{t.name}</b>
                {t.asrHanafi && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Hanafi: {t.asrHanafi}</span>}
              </div>
              <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{t.time}</b>
              {checkedInToday[t.name] && (
                <span style={{ fontSize: 11, color: 'var(--ok)', marginLeft: 8, fontWeight: 600 }}>✓ Presence recorded</span>
              )}
            </div>
          )) : <p className="muted">Loading...</p>}
        </div>
      </div>

      {/* Check-in de présence — the centerpiece */}
      <div className="pad sec">
        <h3>Presence check-in</h3>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          {window_?.isOpen ? (
            alreadyCheckedIn ? (
              <>
              <div className="star" style={{ width: 48, height: 48, background: 'var(--ok)', margin: '0 auto 12px' }} />
              <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>Presence recorded</b>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                Your presence for {window_.prayerName} has been recorded for this window.
              </p>
              </>
            ) : (
              <>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
                Check-in window is open for <b>{window_.prayerName}</b>.
                Tap below to record your presence. This confirms the authenticated session
                was present — it does not verify any prayer.
              </p>
              <button
                className="btn gold"
                onClick={doCheckIn}
                disabled={!canCheckIn}
                style={{ fontSize: 16, padding: '14px 28px' }}
              >
                {checkingIn ? 'Recording...' : 'Mark presence'}
              </button>
              <p className="disc" style={{ marginTop: 10 }}>
                HCS-U7 authenticates your identity, never a devotional act.
                This records that the verified human behind the session was present.
              </p>
              </>
            )
          ) : window_?.isPast ? (
            <>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              The check-in window for {window_.prayerName} has passed.
              No retroactive check-in is possible.
            </p>
            </>
          ) : (
            <>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Check-in opens in {Math.floor((window_?.secondsUntilOpen ?? 0) / 60)}m for {window_?.prayerName ?? 'the next prayer'}.
            </p>
            </>
          )}
        </div>
      </div>

      {/* Check-in history — factual, no piety score */}
      {history.length > 0 && (
        <div className="pad sec">
          <h3>Recent presence</h3>
          <div className="card">
            {history.slice(0, 7).map((h, i) => (
              <div key={i} className="item" style={{ borderBottom: i < 6 ? '1px solid var(--line)' : 'none' }}>
                <div className="ic">✓</div>
                <div className="tx">
                  <b style={{ fontSize: 13 }}>{h.prayerName}</b>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(h.recordedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="disc" style={{ marginTop: 6 }}>Factual record only — no piety score or judgment.</p>
        </div>
      )}

      {/* Qibla compass */}
      <div className="pad sec">
        <h3>Qibla</h3>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div onClick={requestCompass} style={{ width: 160, height: 160, margin: '0 auto 14px', position: 'relative', cursor: 'pointer', borderRadius: '50%', border: '2px solid var(--line)', background: 'var(--surface)' }}>
            {/* Cardinal points */}
            <span style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>N</span>
            <span style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>S</span>
            <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>W</span>
            <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>E</span>
            {/* Qibla needle */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', width: 4, height: 64,
              background: 'var(--accent)', borderRadius: 2, transformOrigin: 'bottom center',
              transform: `translate(-50%, -100%) rotate(${needleRotation}deg)`,
              transition: 'transform .3s',
            }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', transform: 'translate(-50%, -50%)' }} />
          </div>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{QIBLA_BEARING}° from North</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {compassSupported
              ? heading != null ? 'Following device compass' : 'Tap compass to enable'
              : 'Static bearing (compass not supported)'}
          </p>
        </div>
      </div>

      {/* Night mode toggle */}
      <div className="pad sec">
        <h3>Night mode</h3>
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

      {/* Private journal */}
      <div className="pad sec">
        <h3>Private journal</h3>
        <div className="card">
          <textarea
            placeholder="Write your reflections..."
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            style={{ width: '100%', minHeight: 80, border: '1px solid var(--line)', borderRadius: 12, padding: '12px', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }}
          />
          <button className="btn" style={{ marginTop: 10 }} onClick={saveJournal} disabled={!journal.trim() || journalSaved}>
            {journalSaved ? 'Saved' : 'Save · +10 Points'}
          </button>
          <p className="disc" style={{ marginTop: 8 }}>
            Your journal is private. It is stored locally on your device only — never on a blockchain, never exposed elsewhere in the app.
          </p>
        </div>
      </div>
    </div>
  )
}
