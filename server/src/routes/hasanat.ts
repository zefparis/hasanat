/**
 * Hasanat proxy routes — the ONLY surface the browser client calls for HCS-U7.
 * The browser never sees an API key and never sends raw biometrics upstream.
 * All real HCS-U7 calls happen server-side via services/hcs-u7.ts.
 *
 * Storage: SQLite (see db.ts). Sessions persist across process restarts.
 */
import { Router, type Request } from 'express'
import {
  createSession, submitVerification, isMockMode,
  type HcsVerificationResult,
} from '../services/hcs-u7'
import db from '../services/db'
import { checkHcsSessionRateLimit, checkHcsVerifyRateLimit } from '../services/rate-limit'

const router = Router()

/**
 * Extract the client IP for rate-limiting HCS-U7 endpoints.
 * These endpoints are called BEFORE a sid exists (session creates it),
 * so we rate-limit by IP instead of sid.
 *
 * On Render, traffic flows: Client → Cloudflare → Render LB → App.
 * The client CAN forge X-Forwarded-For (it becomes the leftmost entry).
 * Cloudflare APPENDS the real IP after the forged value, and also sets
 * CF-Connecting-IP to the real client IP (which the client cannot forge).
 *
 * Priority (most trustworthy first):
 *   1. CF-Connecting-IP — set by Cloudflare, client cannot forge
 *   2. True-Client-IP — set by Cloudflare Enterprise, client cannot forge
 *   3. req.ip — Express with trust proxy: 1 (rightmost XFF = Render LB's IP, NOT client)
 *   4. socket.remoteAddress — direct connection (only without proxy)
 *
 * Do NOT use the leftmost XFF entry — it's client-forgable on Render.
 */
function ipFrom(req: Request): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf.trim()) return cf.trim()

  const tci = req.headers['true-client-ip']
  if (typeof tci === 'string' && tci.trim()) return tci.trim()

  // Fallback: req.ip (with trust proxy: 1, this is the rightmost XFF entry,
  // which on Render is the LB's IP — not ideal but at least consistent per service)
  return req.ip || req.socket.remoteAddress || 'unknown'
}

interface HasanatSession {
  sessionPublicId: string
  isHuman: boolean
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  verifiedAt: number
}

interface SessionRow {
  sid: string
  session_public_id: string
  is_human: number
  score: number
  risk_level: string
  verified_at: number
}

function rowToSession(r: SessionRow): HasanatSession {
  return {
    sessionPublicId: r.session_public_id,
    isHuman: !!r.is_human,
    score: r.score,
    riskLevel: r.risk_level as HasanatSession['riskLevel'],
    verifiedAt: r.verified_at,
  }
}

function newId(): string {
  return `hs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// GET /api/hasanat/health — includes whether we're in honest mock mode.
router.get('/health', (_req, res) => {
  res.json({ ok: true, mock: isMockMode(), service: 'hasanat-auth' })
})

// POST /api/hasanat/session — create a cognitive verification session.
// Client payload: none required. Returns the HCS-U7 sessionPublicId.
// Rate-limited by IP (5/hour) — this endpoint calls upstream HCS-U7 (real cost/quota).
router.post('/session', async (req, res) => {
  try {
    const ip = ipFrom(req)
    const rl = checkHcsSessionRateLimit(ip)
    if (!rl.allowed) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'Too many session creation attempts. Please slow down and try again later.',
        retryAfterMs: rl.retryAfterMs,
        limit: rl.limit,
        windowMs: rl.windowMs,
      })
      return
    }
    const s = await createSession()
    res.json(s)
  } catch (e) {
    res.status(502).json({ error: 'session_create_failed', message: (e as Error).message })
  }
})

// POST /api/hasanat/verify — submit the hold-to-verify cognitive verification.
// Client payload: { sessionPublicId, deviceFingerprint?, signals? }
// Server forces tenant_id + source upstream; sanitizes the response.
// Rate-limited by IP (5/hour) — this endpoint calls upstream HCS-U7 (real cost/quota).
router.post('/verify', async (req, res) => {
  try {
    const ip = ipFrom(req)
    const rl = checkHcsVerifyRateLimit(ip)
    if (!rl.allowed) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'Too many verification attempts. Please slow down and try again later.',
        retryAfterMs: rl.retryAfterMs,
        limit: rl.limit,
        windowMs: rl.windowMs,
      })
      return
    }
    const { sessionPublicId, deviceFingerprint, signals } = req.body ?? {}
    if (!sessionPublicId || typeof sessionPublicId !== 'string') {
      res.status(400).json({ error: 'missing_sessionPublicId' })
      return
    }
    const result: HcsVerificationResult = await submitVerification({
      sessionPublicId,
      deviceFingerprint,
      userAgent: req.headers['user-agent'],
      signals,
    })
    if (!result.ok || !result.isHuman) {
      res.status(403).json({ error: 'verification_failed', result })
      return
    }
    // Persist a Hasanat session the badge can read.
    const sid = newId()
    const verifiedAt = Date.now()
    db.prepare('INSERT INTO hasanat_sessions (sid, session_public_id, is_human, score, risk_level, verified_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sid, result.sessionPublicId, result.isHuman ? 1 : 0, result.score, result.riskLevel, verifiedAt)
    res.json({ sid, result, verifiedAt })
  } catch (e) {
    res.status(502).json({ error: 'verify_failed', message: (e as Error).message })
  }
})

// GET /api/hasanat/session/:sid — read the active session status (no upstream poll).
router.get('/session/:sid', (req, res) => {
  const sid = req.params.sid
  const row = db.prepare('SELECT * FROM hasanat_sessions WHERE sid = ?').get(sid) as SessionRow | undefined
  if (!row) {
    res.status(404).json({ error: 'session_not_found' })
    return
  }
  const sess = rowToSession(row)
  res.json({
    sid,
    sessionPublicId: sess.sessionPublicId,
    isHuman: sess.isHuman,
    score: sess.score,
    riskLevel: sess.riskLevel,
    verifiedAt: sess.verifiedAt,
  })
})

// POST /api/hasanat/signout — revoke the Hasanat session locally.
// No public HCS-U7 sign-out endpoint exists; we clear the server-side session.
router.post('/signout', (req, res) => {
  const sid = req.body?.sid
  if (sid) {
    db.prepare('DELETE FROM hasanat_sessions WHERE sid = ?').run(sid)
  }
  res.json({ ok: true })
})

export default router
