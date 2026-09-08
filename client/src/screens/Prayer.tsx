import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { useTheme } from '../lib/theme'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { prayerApi, presenceApi, type PrayerSchedule, type CheckInWindow, type CheckInResult, type CheckInHistoryEntry } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'

// Qibla bearing from Johannesburg to Kaaba: ~70° from North
const QIBLA_BEARING = 70

export default function Prayer() {
  const { theme, toggle, mode, setAuto } = useTheme()
  const { toast } = useToast()
  const { status } = useAuth()
  const { t } = useI18n()
  const { prefs } = usePrefs()
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
      prayerApi.schedule({ method: prefs.calcMethod, madhab: prefs.madhab }).then(setSchedule).catch(() => {})
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
  }, [prefs.calcMethod, prefs.madhab])

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
          toast(t('prayer.toastCompassEnabled'))
        } else {
          toast(t('prayer.toastCompassDenied'))
        }
      } catch {
        toast(t('prayer.toastCompassUnavailable'))
      }
    } else {
      toast(t('prayer.toastCompassNotSupported'))
    }
  }

  async function doCheckIn() {
    if (checkingIn) return
    if (!status?.isHuman) {
      toast(t('prayer.toastNotVerified'))
      return
    }
    setCheckingIn(true)
    try {
      const result: CheckInResult = await presenceApi.checkIn()
      if (result.ok) {
        // "presence recorded" — NEVER "prayer verified"
        toast(t('prayer.toastPresenceRecorded', { n: result.pointsAwarded }))
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
      toast(err?.message || t('prayer.toastCheckInFailed'))
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
    toast(t('prayer.toastJournalSaved'))
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
      <Header title={t('prayer.title')} right={<Shield />} />

      {/* Next prayer chip */}
      <div className="pchip">
        <div>
          <b>{t('prayer.nextPrayer', { name: nextPrayer?.name ?? '—' })}</b>
          <span>{schedule ? t('prayer.cityHijri', { city: schedule.city, hijri: schedule.hijri }) : t('common.loading')}</span>
        </div>
      </div>

      {/* Prayer times */}
      <div className="pad sec">
        <h3>{t('prayer.todaysTimes')}</h3>
        <div className="card">
          {schedule ? schedule.times.map((pt) => (
            <div key={pt.name} className="item" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10, marginBottom: 10 }}>
              <div className="tx">
                <b style={{ fontSize: 14 }}>{pt.name}</b>
                {pt.asrHanafi && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('prayer.hanafi', { time: pt.asrHanafi })}</span>}
              </div>
              <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{pt.time}</b>
              {checkedInToday[pt.name] && (
                <span style={{ fontSize: 11, color: 'var(--ok)', marginLeft: 8, fontWeight: 600 }}>{t('prayer.presenceRecorded')}</span>
              )}
            </div>
          )) : <p className="muted">{t('common.loading')}</p>}
        </div>
      </div>

      {/* Check-in de présence — the centerpiece */}
      <div className="pad sec">
        <h3>{t('prayer.presenceCheckIn')}</h3>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          {window_?.isOpen ? (
            alreadyCheckedIn ? (
              <>
              <div className="star" style={{ width: 48, height: 48, background: 'var(--ok)', margin: '0 auto 12px' }} />
              <b style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{t('prayer.presenceRecordedTitle')}</b>
              <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {t('prayer.presenceRecordedMsg', { prayer: window_.prayerName })}
              </p>
              </>
            ) : (
              <>
              <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
                {t('prayer.checkInOpen', { prayer: window_.prayerName })}
              </p>
              <button
                className="btn gold"
                onClick={doCheckIn}
                disabled={!canCheckIn}
                style={{ fontSize: 16, padding: '14px 28px' }}
              >
                {checkingIn ? t('prayer.recording') : t('prayer.markPresence')}
              </button>
              <p className="disc" style={{ marginTop: 10 }}>
                {t('prayer.hcsDisc')}
              </p>
              </>
            )
          ) : window_?.isPast ? (
            <>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {t('prayer.windowPassed', { prayer: window_.prayerName })}
            </p>
            </>
          ) : (
            <>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {t('prayer.windowOpensIn', { min: Math.floor((window_?.secondsUntilOpen ?? 0) / 60), prayer: window_?.prayerName ?? '—' })}
            </p>
            </>
          )}
        </div>
      </div>

      {/* Check-in history — factual, no piety score */}
      {history.length > 0 && (
        <div className="pad sec">
          <h3>{t('prayer.recentPresence')}</h3>
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
          <p className="disc" style={{ marginTop: 6 }}>{t('prayer.factualRecord')}</p>
        </div>
      )}

      {/* Qibla compass */}
      <div className="pad sec">
        <h3>{t('prayer.qibla')}</h3>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div onClick={requestCompass} style={{ width: 160, height: 160, margin: '0 auto 14px', position: 'relative', cursor: 'pointer', borderRadius: '50%', border: '2px solid var(--line)', background: 'var(--surface)' }}>
            {/* Cardinal points */}
            <span style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('prayer.north')}</span>
            <span style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('prayer.south')}</span>
            <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('prayer.west')}</span>
            <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{t('prayer.east')}</span>
            {/* Qibla needle */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', width: 4, height: 64,
              background: 'var(--accent)', borderRadius: 2, transformOrigin: 'bottom center',
              transform: `translate(-50%, -100%) rotate(${needleRotation}deg)`,
              transition: 'transform .3s',
            }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', transform: 'translate(-50%, -50%)' }} />
          </div>
          <b style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{t('prayer.qiblaBearing', { deg: QIBLA_BEARING })}</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {compassSupported
              ? heading != null ? t('prayer.compassFollowing') : t('prayer.compassTapEnable')
              : t('prayer.compassStatic')}
          </p>
        </div>
      </div>

      {/* Night mode toggle */}
      <div className="pad sec">
        <h3>{t('prayer.nightMode')}</h3>
        <div className="card">
          <div className="item">
            <div className="ic">{theme === 'night' ? '☾' : '☀'}</div>
            <div className="tx">
              <b>{theme === 'night' ? t('prayer.nightPalette') : t('prayer.dayPalette')}</b>
              <span>{mode === 'auto' ? t('prayer.autoFollows') : t('prayer.manualOverride')}</span>
            </div>
            <button className="ibtn" onClick={toggle} aria-label={t('prayer.toggle')}>{theme === 'day' ? '☾' : '☀'}</button>
          </div>
          {mode === 'manual' && (
            <button className="btn ghost" style={{ marginTop: 10, fontSize: 13 }} onClick={() => { setAuto(); toast(t('prayer.toastAutoMode')) }}>
              {t('prayer.reEnableAuto')}
            </button>
          )}
        </div>
      </div>

      {/* Private journal */}
      <div className="pad sec">
        <h3>{t('prayer.journal')}</h3>
        <div className="card">
          <textarea
            placeholder={t('prayer.journalPlaceholder')}
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            style={{ width: '100%', minHeight: 80, border: '1px solid var(--line)', borderRadius: 12, padding: '12px', fontSize: 14, background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }}
          />
          <button className="btn" style={{ marginTop: 10 }} onClick={saveJournal} disabled={!journal.trim() || journalSaved}>
            {journalSaved ? t('prayer.saved') : t('prayer.savePoints')}
          </button>
          <p className="disc" style={{ marginTop: 8 }}>
            {t('prayer.journalDisc')}
          </p>
        </div>
      </div>
    </div>
  )
}
