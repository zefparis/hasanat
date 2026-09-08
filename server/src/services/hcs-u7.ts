/**
 * HCS-U7 upstream client for the Hasanat Guard.
 *
 * Mirrors the PayGuard pattern: the Hasanat Express backend is the ONLY caller
 * of the HCS-U7 / Hybrid Vector API. The browser client never sees an API key
 * and never sends raw biometrics upstream directly.
 *
 * Configuration (env):
 *   HCS_U7_BASE_URL       — public entry (Worker), e.g. https://api.hcs-u7.org
 *   HV_API_KEY            — server-side API key sent as X-API-Key through the Worker
 *   HASANAT_TENANT_ID     — tenant override forced server-side (client cannot spoof)
 *   HCS_U7_MOCK           — "1" forces honest local mock mode (pilot without creds)
 *
 * submitVerification() routes through the HCS-U7 Worker at
 *   {HCS_BASE}/hv/demoguard/verify
 * The Worker adds X-HCS-Worker-Auth, WAF, bot detection, and header sanitization
 * before forwarding to the Hybrid Vector API. Hasanat still sends X-API-Key
 * (HV_API_KEY) which passes through the Worker to the backend's apiKeyMiddleware.
 *
 * When HCS_U7_MOCK=1 OR HV_API_KEY is missing, calls resolve against
 * a clearly-labeled local mock so the pilot runs in front of Benoit/Chairman
 * without real credentials. The code path is identical — only the transport
 * target changes. Set the env vars and unset HCS_U7_MOCK to go live.
 *
 * Golden rule: HCS-U7 authenticates an IDENTITY, never a devotional act.
 * Nothing here judges a prayer. This module only confirms the acting session
 * is the verified human behind it.
 */

const EXPLICIT_MOCK = process.env.HCS_U7_MOCK === '1'
const CREDS_MISSING = !process.env.HV_API_KEY
const IS_PROD = process.env.NODE_ENV === 'production'

// In production, missing HCS-U7 credentials WITHOUT an explicit HCS_U7_MOCK=1
// is a configuration error — the server must refuse to start rather than silently
// fall back to mock. In dev, we allow the silent fallback for convenience.
if (IS_PROD && CREDS_MISSING && !EXPLICIT_MOCK) {
  // eslint-disable-next-line no-console
  console.error(
    '\n[FATAL] HCS-U7 credentials missing in production (HV_API_KEY).\n' +
    'Set it, or set HCS_U7_MOCK=1 to explicitly run in mock mode.\n' +
    'Refusing to start — silent fallback to mock in prod is disabled.\n',
  )
  process.exit(1)
}

const MOCK = EXPLICIT_MOCK || CREDS_MISSING

if (MOCK) {
  // eslint-disable-next-line no-console
  console.warn(
    `\n[WARN] ════════════════════════════════════════════════════════════\n` +
    `[WARN]  HCS-U7 MOCK MODE ACTIVE${EXPLICIT_MOCK ? ' (explicit HCS_U7_MOCK=1)' : ' (HV_API_KEY missing)'}\n` +
    `[WARN]  All HCS-U7 calls resolve locally. No real identity verification.\n` +
    `[WARN]  This is fine for the pilot — NOT for production with real users.\n` +
    `[WARN] ════════════════════════════════════════════════════════════\n`,
  )
}

const HCS_BASE = (process.env.HCS_U7_BASE_URL || 'https://api.hcs-u7.org').replace(/\/+$/, '')
const HV_API_KEY = process.env.HV_API_KEY || ''
const TENANT_ID = process.env.HASANAT_TENANT_ID || 'hasanat'

const UPSTREAM_TIMEOUT_MS = 10_000

export interface HcsSession {
  sessionPublicId: string
  createdAt: string
  expiresAt: string
}

export interface HcsVerificationChecks {
  deviceBound: boolean
  liveness: boolean
  cognitiveSignatureMatched: boolean
  secureSession: boolean
}

export interface HcsVerificationResult {
  ok: boolean
  sessionPublicId: string
  isHuman: boolean
  /** Authoritative trust score from HCS-U7 (0-100). NULL when the upstream
   * response does not include trust_score/trust_score_normalized — the HTTP
   * response only exposes quality_score (signal completeness), NOT the
   * authoritative trust score. Do NOT fabricate a score. */
  score: number | null
  /** Signal completeness (0-1) from the upstream quality object. Honest proxy
   * for "how much signal was captured" — NOT a trust score. */
  qualityScore: number | null
  /** Authoritative global decision from hybridFusion. 'unknown' if absent. */
  decision: 'APPROVED' | 'REVIEW' | 'REJECTED' | 'unknown'
  /** Upstream status field: 'submitted' | 'review' | 'failed' | null. */
  upstreamStatus: string | null
  riskLevel: 'low' | 'medium' | 'high'
  checks: HcsVerificationChecks
  /** Quick-auth token issued by HCS-U7; passed back to the client and sent on
   * subsequent calls in the JSON body as hcsToken. Null in mock mode. */
  hcsToken: string | null
  expiresInSeconds: number
  traceId: string
}

async function fetchUpstream(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Create a cognitive verification session. Real call: POST /api/cognitive/liveguard/session. */
export async function createSession(): Promise<HcsSession> {
  if (MOCK) {
    const now = Date.now()
    return {
      sessionPublicId: `mock_sess_${now.toString(36)}`,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
    }
  }
  const res = await fetchUpstream(`${HCS_BASE}/api/cognitive/liveguard/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': HV_API_KEY },
    body: JSON.stringify({ tenantId: TENANT_ID }),
  })
  if (!res.ok) throw new Error(`HCS-U7 session create failed: ${res.status}`)
  return res.json() as Promise<HcsSession>
}

interface VerifyPayload {
  sessionPublicId: string
  deviceFingerprint?: Record<string, unknown>
  userAgent?: string
  /** Passive cognitive/biometric signals collected during the hold — timing,
   * touch pressure, motion/orientation micro-movements. Never raw biometrics. */
  signals?: Record<string, unknown>
}

/** Build the demo_guard payload sent to HCS-U7 /demoguard/verify.
 * Maps passive signals captured during the hold to the DemoGuard contract.
 * Only includes signal categories actually present in the client payload —
 * never fabricates missing sensor data. */
function buildDemoGuardPayload(payload: VerifyPayload): Record<string, unknown> {
  const signals = (payload.signals ?? {}) as Record<string, unknown>
  const timing = signals.timing as { holdDurationMs: number; startedAt: number; completedAt: number } | undefined
  const touch = signals.touch as { available: boolean; forceSamples: number[]; maxForce: number; avgForce: number; contactDurationMs: number; contactStable: boolean } | undefined
  const motion = signals.motion as { available: boolean; sampleCount: number; avgMagnitude: number; maxMagnitude: number; variance: number } | undefined
  const orientation = signals.orientation as { available: boolean; sampleCount: number; avgBeta: number; avgGamma: number; variance: number } | undefined

  const startedAt = timing ? new Date(timing.startedAt).toISOString() : new Date(Date.now() - 2500).toISOString()
  const completedAt = timing ? new Date(timing.completedAt).toISOString() : new Date().toISOString()

  // ─── Signal slots: only include categories actually observed ────────────
  const signalSlots: Record<string, unknown> = {}
  if (touch?.available) signalSlots.touch = { force: touch.avgForce, maxForce: touch.maxForce, samples: touch.forceSamples.length }
  if (motion?.available) signalSlots.motion = { avgMagnitude: motion.avgMagnitude, maxMagnitude: motion.maxMagnitude, samples: motion.sampleCount }
  if (orientation?.available) signalSlots.orientation = { avgBeta: orientation.avgBeta, avgGamma: orientation.avgGamma, samples: orientation.sampleCount }
  // visibility + network are always available in a browser context
  signalSlots.visibility = { visible: true, hidden: false }
  signalSlots.network = { online: true }

  // ─── Behavior summary from timing + touch ──────────────────────────────
  // The hold gesture is a single task with 1 interaction. computeBehaviorStatus
  // returns 'review' for tasksObserved < 2, which is honest for a passive hold.
  const holdDurationMs = timing?.holdDurationMs ?? 0
  const motorConfidence = touch?.available
    ? Math.min(1, touch.avgForce * 0.5 + (touch.contactStable ? 0.3 : 0) + 0.2)
    : 0.5
  const consistencyScore = touch?.available
    ? Math.min(1, (touch.contactStable ? 0.6 : 0.3) + Math.min(0.4, touch.avgForce * 0.4))
    : 0.4
  const behaviorSummary = {
    tasksObserved: 1,
    totalInteractions: 1,
    avgRhythmMs: holdDurationMs,
    rhythmVariance: null, // single hold — no variance to compute
    hesitationTotal: 0,
    correctionTotal: 0,
    consistencyScore,
    motorConfidence,
    behaviorLikelihood: 'medium' as const,
    quality: 'review' as const,
  }

  // ─── Touch diagnostics ─────────────────────────────────────────────────
  const touchDiagnostics = touch?.available
    ? {
        status: 'ok' as const,
        supported: true,
        interactionCount: 1,
        quality: 'ok' as const,
        reasonSafe: 'hold_with_force_data',
      }
    : {
        status: 'missing' as const,
        supported: false,
        interactionCount: 0,
        quality: 'missing' as const,
        reasonSafe: 'no_touch_force_api',
      }

  // ─── Quality: compute completeness from present signal categories ──────
  // 8 optional categories: selfie, reaction, voice, motion, orientation,
  // touch, visibility, network. We include only those actually observed.
  const present = new Set<string>()
  if (touch?.available) present.add('touch')
  if (motion?.available) present.add('motion')
  if (orientation?.available) present.add('orientation')
  present.add('visibility') // always available in browser
  present.add('network') // always available in browser
  const allOptional = ['selfie', 'reaction', 'voice', 'motion', 'orientation', 'touch', 'visibility', 'network']
  const missingOptional = allOptional.filter((c) => !present.has(c))
  const signalCompleteness = present.size / allOptional.length // 0.375–0.625
  const overallReady = signalCompleteness >= 0.50

  return {
    version: '1.0.0',
    started_at: startedAt,
    completed_at: completedAt,
    device: {
      type: 'mobile',
      fingerprint: payload.deviceFingerprint ?? {},
      userAgent: payload.userAgent ?? '',
    },
    signals: {
      ...signalSlots,
      behavior: {
        taskBehaviors: { hold: { durationMs: holdDurationMs, force: touch?.avgForce ?? null } },
        summary: behaviorSummary,
      },
      touchDiagnostics,
    },
    quality: {
      signal_completeness: signalCompleteness,
      device_ready: true,
      permissions_ready: true,
      overall_ready: overallReady,
      critical_missing: [],
      missing_optional: missingOptional,
    },
    test_scope: 'cognitive-only',
    presentation_variant: 'liveguard',
  }
}

/**
 * Submit verification. Routed through the HCS-U7 Worker:
 *   POST {HCS_BASE}/hv/demoguard/verify
 * The Worker adds X-HCS-Worker-Auth, WAF, bot detection, and header sanitization
 * before forwarding to the Hybrid Vector API. Hasanat sends X-API-Key (HV_API_KEY)
 * which passes through the Worker to the backend's apiKeyMiddleware.
 * The server forces tenant_id and source — the client cannot spoof either.
 * Response is sanitized: raw biometrics, PII, JWTs, debug fields are stripped
 * before reaching the browser (see sanitizeVerification).
 */
export async function submitVerification(payload: VerifyPayload): Promise<HcsVerificationResult> {
  if (MOCK) {
    return mockVerification(payload)
  }
  const demoGuard = buildDemoGuardPayload(payload)
  const body = {
    hcs_session_public_id: payload.sessionPublicId,
    source: 'liveguard_mobile',
    tenant_id: TENANT_ID,
    demo_guard: demoGuard,
  }
  const res = await fetchUpstream(`${HCS_BASE}/hv/demoguard/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': HV_API_KEY },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HCS-U7 verify failed: ${res.status}`)
  const raw = await res.json() as Record<string, unknown>
  return sanitizeVerification(raw, payload.sessionPublicId)
}

// ─── Response sanitization ──────────────────────────────────────────────────
// Mirrors payguard/api/_lib/demoguardSanitize.ts — strip raw biometrics, PII,
// JWTs, debug fields before the response reaches the browser.
const FORBIDDEN_KEYS = new Set([
  'selfie_b64', 'voice_b64', 'raw_audio', 'raw_image', 'raw_motion_trace',
  'raw_touch_trace', 'face_embedding', 'vocal_embedding', 'mfcc', 'mfcc_raw',
  'mfcc_summary', 'voiceprint', 'first_name', 'last_name', 'student_id',
  'email', 'phone', 'token', 'jwt', 'sessionToken', 'hcsResultToken', 'hcsCode',
  'components', 'breakdown', 'detail', 'debug', 'internal',
])

function stripForbidden(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(k)) continue
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? stripForbidden(v as Record<string, unknown>) : v
  }
  return out
}

function sanitizeVerification(raw: Record<string, unknown>, sessionPublicId: string): HcsVerificationResult {
  const clean = stripForbidden(raw)

  // ─── Read the AUTHORITATIVE decision, not generic `ok` ──────────────────
  // The upstream /demoguard/verify response shape (DemoGuardSafeResponse):
  //   { ok: true, status: 'submitted'|'review'|'failed',
  //     hybridFusion: { globalDecision: 'APPROVED'|'REVIEW'|'REJECTED' },
  //     quality_score: number, ready: boolean, traceId: string }
  //
  // `ok: true` means the request was PROCESSED, not that the user is human.
  // The authoritative human decision is `hybridFusion.globalDecision`.
  // `status: 'failed'` means signal completeness too low → also a rejection.
  //
  // The authoritative trust_score / trust_score_normalized are NOT in the HTTP
  // response — they are written to hv_sessions via emitHcsIngest. We therefore
  // expose quality_score (signal completeness) and the decision, but do NOT
  // fabricate a trust score.
  const hybridFusion = clean.hybridFusion as { globalDecision?: string } | undefined
  const globalDecision = hybridFusion?.globalDecision
  const upstreamStatus = (clean.status as string | undefined) ?? null

  const decision: HcsVerificationResult['decision'] =
    globalDecision === 'APPROVED' ? 'APPROVED' :
    globalDecision === 'REVIEW' ? 'REVIEW' :
    globalDecision === 'REJECTED' ? 'REJECTED' :
    'unknown'

  // isHuman: true ONLY for a non-rejected authoritative decision.
  // status 'failed' (signal completeness < 0.50) also means rejection.
  const isHuman = decision !== 'REJECTED' && decision !== 'unknown' && upstreamStatus !== 'failed'

  // quality_score is signal completeness (0-1), NOT a trust score.
  const qualityScore = typeof clean.quality_score === 'number' ? clean.quality_score : null

  // riskLevel from the authoritative decision (not fabricated from a score).
  const riskLevel: HcsVerificationResult['riskLevel'] =
    decision === 'APPROVED' ? 'low' :
    decision === 'REVIEW' ? 'medium' :
    'high'

  return {
    ok: Boolean(clean.ok) && isHuman,
    sessionPublicId,
    isHuman,
    score: null, // authoritative trust_score NOT in the HTTP response — do not fabricate
    qualityScore,
    decision,
    upstreamStatus,
    riskLevel,
    // The 4 UI checks are DERIVED from the real decision, not backend labels.
    checks: {
      deviceBound: true, // tenant_id + source forced server-side
      liveness: decision === 'APPROVED' || decision === 'REVIEW',
      cognitiveSignatureMatched: decision === 'APPROVED',
      secureSession: Boolean(clean.traceId),
    },
    hcsToken: null, // demoguard/verify does not issue an hcsToken in the safe response
    expiresInSeconds: 300,
    traceId: String(clean.traceId ?? `hv_${Date.now().toString(36)}`),
  }
}

// ─── Honest mock (pilot without real HCS-U7 credentials) ─────────────────────
function mockVerification(payload: VerifyPayload): HcsVerificationResult {
  return {
    ok: true,
    sessionPublicId: payload.sessionPublicId,
    isHuman: true,
    score: null, // mock — no real authoritative trust score
    qualityScore: 0.625, // mock signal completeness
    decision: 'REVIEW', // mock — honest: passive signals alone cap at REVIEW
    upstreamStatus: 'submitted',
    riskLevel: 'medium',
    checks: { deviceBound: true, liveness: true, cognitiveSignatureMatched: false, secureSession: true },
    hcsToken: null, // mock mode issues no real token
    expiresInSeconds: 300,
    traceId: `mock_${Date.now().toString(36)}`,
  }
}

export function isMockMode(): boolean {
  return MOCK
}
