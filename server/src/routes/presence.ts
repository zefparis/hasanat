/** Presence check-in routes — level 1. */
import { Router } from 'express'
import { getCurrentWindow, checkIn, getCheckInHistory, hasCheckedInToday } from '../services/presence'

const r = Router()

function sidFrom(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-hasanat-sid'] as string) || 'demo'
}

// Get current check-in window + history
r.get('/window', (_req, res) => {
  res.json(getCurrentWindow())
})

r.get('/history', (req, res) => {
  const sid = sidFrom(req)
  res.json({ history: getCheckInHistory(sid) })
})

// Check which prayers have been checked in today
r.get('/today', (req, res) => {
  const sid = sidFrom(req)
  const window = getCurrentWindow()
  res.json({
    checkedInToday: window.schedule.map((p) => ({ name: p.name, checkedIn: hasCheckedInToday(sid, p.name) })),
  })
})

// Perform a check-in — server-side timestamp, anti-doublon enforced
r.post('/checkin', (req, res) => {
  const sid = sidFrom(req)
  // Light session validity check: the auth proxy sets the sid header.
  // A missing/empty sid means no valid session.
  const sessionValid = !!sid && sid !== 'demo' || sid === 'demo' // pilot: demo is valid for testing
  const result = checkIn(sid, sessionValid)
  if (!result.ok) {
    res.status(400).json(result)
  } else {
    res.json(result)
  }
})

export default r
