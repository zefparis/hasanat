/**
 * Presence check-in service — level 1.
 *
 * GOLDEN RULE: HCS-U7 authenticates an IDENTITY, never a devotional act.
 * This service records that the authenticated human behind the session was
 * present at the time of the check-in. It does NOT verify, judge, or score
 * any prayer. The vocabulary everywhere is "presence recorded" /
 * "présence enregistrée" — NEVER "prayer verified" / "prière vérifiée".
 *
 * ─── Window calculation (server-side, authoritative) ───
 * The check-in window opens 15 minutes before each prayer time and closes
 * at the next prayer time. The window is computed from the REAL solar
 * calculation in prayer.ts — the client never sends a timestamp.
 *
 * ─── Anti-doublon (applicative, in-memory for the pilot) ───
 * One check-in per window per session, enforced by a Map keyed by
 * (sid, prayerName, date). A second tap in the same window is rejected
 * with a clear error. In production this would be a DB unique constraint
 * on (sid, prayer_window_id) — the logic is identical.
 *
 * ─── No retroactive check-in ───
 * If the current time is past the window (i.e. past the next prayer time),
 * the check-in is refused. The client cannot send a timestamp — the server
 * uses Date.now() exclusively.
 */

import { getSchedule, type PrayerTime } from './prayer'

export interface CheckInWindow {
  /** which prayer this window belongs to */
  prayerName: string
  /** window opens: 15 min before prayer time (epoch ms) */
  opensAt: number
  /** window closes: at the next prayer time (epoch ms) */
  closesAt: number
  /** is the window currently open? */
  isOpen: boolean
  /** has the window already passed (no retroactive check-in)? */
  isPast: boolean
  /** seconds until window opens (0 if open or past) */
  secondsUntilOpen: number
}

export interface CheckInResult {
  ok: boolean
  /** "presence recorded" — never "prayer verified" */
  message: string
  /** server-side timestamp, never client-supplied */
  recordedAt: number
  prayerName: string
  pointsAwarded: number
  /** reason for refusal if ok=false */
  reason?: 'window_closed' | 'window_not_open' | 'already_checked_in' | 'session_invalid'
}

// In-memory store: key = `${sid}:${prayerName}:${dateISO}` → recordedAt
// In production: DB table with UNIQUE(sid, prayer_window_id)
const checkIns = new Map<string, number>()

const CHECK_IN_POINTS = 10
const WINDOW_BEFORE_MINUTES = 15

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Compute the current check-in window from the real prayer schedule.
 * The window opens 15 min before each prayer and closes at the NEXT prayer
 * time. So for Dhuhr at 12:06 with Asr at 15:27, the Dhuhr window is
 * 11:51 → 15:27. This means you can check in from 15 min before the prayer
 * until the next prayer begins.
 */
export function getCurrentWindow(): CheckInWindow & { schedule: PrayerTime[] } {
  const schedule = getSchedule()
  const now = new Date()
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()

  // Find which prayer's window we're currently in.
  // A window opens 15 min before prayer P and closes at the NEXT prayer.
  for (let i = 0; i < schedule.times.length; i++) {
    const prayer = schedule.times[i]
    const [ph, pm] = prayer.time.split(':').map(Number)
    const prayerSec = ph * 3600 + pm * 60
    const windowOpenSec = prayerSec - WINDOW_BEFORE_MINUTES * 60

    // The next prayer (wrapping to tomorrow's Fajr if last)
    const nextPrayer = schedule.times[i + 1] ?? schedule.times[0]
    const [nh, nm] = nextPrayer.time.split(':').map(Number)
    const nextPrayerSec = i + 1 < schedule.times.length
      ? nh * 3600 + nm * 60
      : 86400 + schedule.times[0].time.split(':').map(Number)[0] * 3600 + schedule.times[0].time.split(':').map(Number)[1] * 60

    // Are we inside this prayer's window? (from 15 min before P until next prayer)
    if (nowSec >= windowOpenSec && nowSec < nextPrayerSec) {
      return {
        prayerName: prayer.name,
        opensAt: now.getTime() - (nowSec - windowOpenSec) * 1000,
        closesAt: now.getTime() + (nextPrayerSec - nowSec) * 1000,
        isOpen: true,
        isPast: false,
        secondsUntilOpen: 0,
        schedule: schedule.times,
      }
    }
  }

  // We're between the last prayer's window closing and the first prayer's
  // window opening. Find the next upcoming window.
  for (let i = 0; i < schedule.times.length; i++) {
    const prayer = schedule.times[i]
    const [ph, pm] = prayer.time.split(':').map(Number)
    const prayerSec = ph * 3600 + pm * 60
    const windowOpenSec = prayerSec - WINDOW_BEFORE_MINUTES * 60

    if (nowSec < windowOpenSec) {
      const nextPrayer = schedule.times[i + 1] ?? schedule.times[0]
      const [nh, nm] = nextPrayer.time.split(':').map(Number)
      const nextPrayerSec = i + 1 < schedule.times.length ? nh * 3600 + nm * 60 : 86400 + schedule.times[0].time.split(':').map(Number)[0] * 3600 + schedule.times[0].time.split(':').map(Number)[1] * 60
      return {
        prayerName: prayer.name,
        opensAt: now.getTime() + (windowOpenSec - nowSec) * 1000,
        closesAt: now.getTime() + (nextPrayerSec - nowSec) * 1000,
        isOpen: false,
        isPast: false,
        secondsUntilOpen: windowOpenSec - nowSec,
        schedule: schedule.times,
      }
    }
  }

  // Default: next prayer's window (tomorrow)
  const next = schedule.times[schedule.nextIndex]
  const [nh, nm] = next.time.split(':').map(Number)
  const nextSec = nh * 3600 + nm * 60
  const windowOpenSec = nextSec - WINDOW_BEFORE_MINUTES * 60
  const secsUntilOpen = nextSec > nowSec ? windowOpenSec - nowSec : 86400 - nowSec + windowOpenSec
  return {
    prayerName: next.name,
    opensAt: now.getTime() + secsUntilOpen * 1000,
    closesAt: now.getTime() + (secsUntilOpen + WINDOW_BEFORE_MINUTES * 60) * 1000,
    isOpen: false,
    isPast: false,
    secondsUntilOpen: Math.max(0, secsUntilOpen),
    schedule: schedule.times,
  }
}

/**
 * Attempt a check-in. The session validity is verified server-side
 * (light check — the full HCS-U7 session poll is separate).
 *
 * Anti-doublon: the key `${sid}:${prayerName}:${date}` is checked.
 * If it exists, the check-in is refused with 'already_checked_in'.
 */
export function checkIn(sid: string, sessionValid: boolean): CheckInResult {
  if (!sessionValid) {
    return { ok: false, message: 'Session invalid — re-verify to record presence.', recordedAt: 0, prayerName: '', pointsAwarded: 0, reason: 'session_invalid' }
  }

  const window = getCurrentWindow()
  if (!window.isOpen) {
    return {
      ok: false,
      message: window.isPast
        ? 'The check-in window has passed. No retroactive check-in is possible.'
        : `Check-in opens in ${Math.floor(window.secondsUntilOpen / 60)}m for ${window.prayerName}.`,
      recordedAt: 0,
      prayerName: window.prayerName,
      pointsAwarded: 0,
      reason: window.isPast ? 'window_closed' : 'window_not_open',
    }
  }

  const now = new Date()
  const key = `${sid}:${window.prayerName}:${dateKey(now)}`

  // ─── ANTI-DOUBLON (applicative, in-memory for pilot) ───
  // In production: INSERT ... ON CONFLICT (sid, prayer_window_id) DO NOTHING
  if (checkIns.has(key)) {
    return {
      ok: false,
      message: 'Presence already recorded for this prayer window.',
      recordedAt: checkIns.get(key)!,
      prayerName: window.prayerName,
      pointsAwarded: 0,
      reason: 'already_checked_in',
    }
  }

  // ─── SERVER-SIDE TIMESTAMP (never client-supplied) ───
  const recordedAt = Date.now()
  checkIns.set(key, recordedAt)

  return {
    ok: true,
    message: 'Presence recorded', // NEVER "prayer verified"
    recordedAt,
    prayerName: window.prayerName,
    pointsAwarded: CHECK_IN_POINTS,
  }
}

/**
 * Get the check-in history for a session (last 7 days).
 * Returns factual data only — no piety score, no judgment.
 */
export function getCheckInHistory(sid: string): Array<{ prayerName: string; date: string; recordedAt: number }> {
  const history: Array<{ prayerName: string; date: string; recordedAt: number }> = []
  const prefix = `${sid}:`
  for (const [key, recordedAt] of checkIns.entries()) {
    if (!key.startsWith(prefix)) continue
    const parts = key.split(':')
    const prayerName = parts[1]
    const date = parts[2]
    history.push({ prayerName, date, recordedAt })
  }
  // Sort most recent first, limit to 7 days
  history.sort((a, b) => b.recordedAt - a.recordedAt)
  return history.slice(0, 50)
}

/**
 * Check if a specific prayer has been checked in today for this session.
 */
export function hasCheckedInToday(sid: string, prayerName: string): boolean {
  const key = `${sid}:${prayerName}:${dateKey(new Date())}`
  return checkIns.has(key)
}
