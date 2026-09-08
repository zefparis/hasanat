/**
 * Hasanat proxy routes — the ONLY surface the browser client calls for HCS-U7.
 * The browser never sees an API key and never sends raw biometrics upstream.
 * All real HCS-U7 calls happen server-side via services/hcs-u7.ts.
 */
import { Router } from 'express'
import {
  createSession, submitVerification, rotationStatus, isMockMode,
  type HcsVerificationResult,
} from '../services/hcs-u7'

const router = Router()

// In-memory session store for the pilot. Real HCS-U7 issues a quick-auth JWT;
// in mock mode we keep a server-side session id so the badge can poll.
interface HasanatSession {
  sessionPublicId: string
  hcsToken: string | null
  isHuman: boolean
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  verifiedAt: number
  verificationCount: number
}
const sessions = new Map<string, HasanatSession>()

function newId(): string {
  return `hs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// GET /api/hasanat/health — includes whether we're in honest mock mode.
router.get('/health', (_req, res) => {
  res.json({ ok: true, mock: isMockMode(), service: 'hasanat-auth' })
})

// POST /api/hasanat/session — create a cognitive verification session.
// Client payload: none required. Returns the HCS-U7 sessionPublicId.
router.post('/session', async (_req, res) => {
  try {
    const s = await createSession()
    res.json(s)
  } catch (e) {
    res.status(502).json({ error: 'session_create_failed', message: (e as Error).message })
  }
})

// POST /api/hasanat/verify — submit the hold-to-verify cognitive verification.
// Client payload: { sessionPublicId, deviceFingerprint?, signals? }
// Server forces tenant_id + source upstream; sanitizes the response.
router.post('/verify', async (req, res) => {
  try {
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
    // Persist a Hasanat session the badge can poll.
    const sid = newId()
    sessions.set(sid, {
      sessionPublicId: result.sessionPublicId,
      hcsToken: result.hcsToken,
      isHuman: result.isHuman,
      score: result.score,
      riskLevel: result.riskLevel,
      verifiedAt: Date.now(),
      verificationCount: 1,
    })
    res.json({ sid, result })
  } catch (e) {
    res.status(502).json({ error: 'verify_failed', message: (e as Error).message })
  }
})

// GET /api/hasanat/session/:sid — poll the active session + 30s rotation status.
router.get('/session/:sid', async (req, res) => {
  const sid = req.params.sid
  const sess = sessions.get(sid)
  if (!sess) {
    res.status(404).json({ error: 'session_not_found' })
    return
  }
  try {
    const rotation = await rotationStatus(sess.hcsToken)
    // Increment the verification count each poll to mirror "re-verifies every 30s".
    sess.verificationCount += 1
    res.json({
      sid,
      sessionPublicId: sess.sessionPublicId,
      isHuman: sess.isHuman,
      score: sess.score,
      riskLevel: sess.riskLevel,
      verifiedAt: sess.verifiedAt,
      verificationCount: sess.verificationCount,
      rotation,
    })
  } catch (e) {
    res.status(502).json({ error: 'rotation_failed', message: (e as Error).message })
  }
})

// POST /api/hasanat/signout — revoke the Hasanat session locally.
// No public HCS-U7 sign-out endpoint exists; we clear the server-side session.
router.post('/signout', (req, res) => {
  const sid = req.body?.sid
  if (sid && sessions.has(sid)) {
    sessions.delete(sid)
  }
  res.json({ ok: true })
})

export default router
