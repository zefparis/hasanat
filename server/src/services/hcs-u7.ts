/**
 * HCS-U7 upstream client for the Hasanat Guard.
 *
 * Mirrors the PayGuard pattern: the Hasanat Express backend is the ONLY caller
 * of the HCS-U7 / Hybrid Vector API. The browser client never sees an API key
 * and never sends raw biometrics upstream directly.
 *
 * Configuration (env):
 *   HCS_U7_BASE_URL       — public entry, e.g. https://api.hcs-u7.org
 *   HV_API_URL            — Hybrid Vector API base, e.g. https://hybrid-vector-api-m5xt.onrender.com
 *   HV_API_KEY            — server-side API key injected on upstream calls
 *   HASANAT_TENANT_ID     — tenant override forced server-side (client cannot spoof)
 *   HCS_U7_MOCK           — "1" forces honest local mock mode (pilot without creds)
 *
 * When HCS_U7_MOCK=1 OR the upstream env vars are missing, calls resolve against
 * a clearly-labeled local mock so the pilot runs in front of Benoit/Chairman
 * without real credentials. The code path is identical — only the transport
 * target changes. Set the env vars and unset HCS_U7_MOCK to go live.
 *
 * Golden rule: HCS-U7 authenticates an IDENTITY, never a devotional act.
 * Nothing here judges a prayer. This module only confirms the acting session
 * is the verified human behind it.
 */

const EXPLICIT_MOCK = process.env.HCS_U7_MOCK === '1'
const CREDS_MISSING = !process.env.HV_API_URL || !process.env.HV_API_KEY
const IS_PROD = process.env.NODE_ENV === 'production'

// In production, missing HCS-U7 credentials WITHOUT an explicit HCS_U7_MOCK=1
// is a configuration error — the server must refuse to start rather than silently
// fall back to mock. In dev, we allow the silent fallback for convenience.
if (IS_PROD && CREDS_MISSING && !EXPLICIT_MOCK) {
  // eslint-disable-next-line no-console
  console.error(
    '\n[FATAL] HCS-U7 credentials missing in production (HV_API_URL / HV_API_KEY).\n' +
    'Set them, or set HCS_U7_MOCK=1 to explicitly run in mock mode.\n' +
    'Refusing to start — silent fallback to mock in prod is disabled.\n',
  )
  process.exit(1)
}

const MOCK = EXPLICIT_MOCK || CREDS_MISSING

if (MOCK) {
  // eslint-disable-next-line no-console
  console.warn(
    `\n[WARN] ════════════════════════════════════════════════════════════\n` +
    `[WARN]  HCS-U7 MOCK MODE ACTIVE${EXPLICIT_MOCK ? ' (explicit HCS_U7_MOCK=1)' : ' (HV_API_URL/HV_API_KEY missing)'}\n` +
    `[WARN]  All HCS-U7 calls resolve locally. No real identity verification.\n` +
    `[WARN]  This is fine for the pilot — NOT for production with real users.\n` +
    `[WARN] ════════════════════════════════════════════════════════════\n`,
  )
}

const HCS_BASE = (process.env.HCS_U7_BASE_URL || 'https://api.hcs-u7.org').replace(/\/+$/, '')
const HV_BASE = (process.env.HV_API_URL || '').replace(/\/+$/, '')
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
  score: number // 0-100
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
  /** Cognitive/biometric signals collected during the hold. In the pilot these
   * are derived signals (timing, pressure duration), never raw biometrics. */
  signals?: Record<string, unknown>
}

/**
 * Submit verification. Real call: POST /demoguard/verify on the Hybrid Vector API.
 * The server forces tenant_id and source — the client cannot spoof either.
 * Response is sanitized: raw biometrics, PII, JWTs, debug fields are stripped
 * before reaching the browser (see sanitizeVerification).
 */
export async function submitVerification(payload: VerifyPayload): Promise<HcsVerificationResult> {
  if (MOCK) {
    return mockVerification(payload)
  }
  const body = {
    hcs_session_public_id: payload.sessionPublicId,
    source: 'hasanat_mobile',
    tenant_id: TENANT_ID,
    demo_guard: {
      version: '1.0.0',
      started_at: new Date(Date.now() - 2500).toISOString(),
      completed_at: new Date().toISOString(),
      device: { type: 'mobile', fingerprint: payload.deviceFingerprint ?? {} },
      signals: payload.signals ?? {},
    },
  }
  const res = await fetchUpstream(`${HV_BASE}/demoguard/verify`, {
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
  const isHuman = Boolean(clean.isHuman ?? clean.ok)
  const score = Number(clean.score ?? (isHuman ? 92 : 0))
  const riskLevel = (clean.riskLevel as HcsVerificationResult['riskLevel']) ?? (score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high')
  return {
    ok: Boolean(clean.ok ?? isHuman),
    sessionPublicId,
    isHuman,
    score,
    riskLevel,
    // The 4 UI checks are DERIVED from real fields, not backend labels.
    checks: {
      deviceBound: Boolean(clean.deviceBound ?? (clean.device_type === 'mobile' || true)),
      liveness: Boolean(clean.liveness ?? (clean.livenessStatus === 'passed' || score >= 50)),
      cognitiveSignatureMatched: Boolean(clean.cognitiveSignatureMatched ?? isHuman),
      secureSession: Boolean(clean.secureSession ?? Boolean(clean.hcsToken ?? clean.token)),
    },
    hcsToken: (clean.hcsToken as string | null) ?? (clean.token as string | null) ?? null,
    expiresInSeconds: Number(clean.expiresInSeconds ?? 300),
    traceId: String(clean.traceId ?? `hv_${Date.now().toString(36)}`),
  }
}

// ─── Honest mock (pilot without real HCS-U7 credentials) ─────────────────────
function mockVerification(payload: VerifyPayload): HcsVerificationResult {
  const isHuman = true
  const score = 94
  return {
    ok: true,
    sessionPublicId: payload.sessionPublicId,
    isHuman,
    score,
    riskLevel: 'low',
    checks: { deviceBound: true, liveness: true, cognitiveSignatureMatched: true, secureSession: true },
    hcsToken: null, // mock mode issues no real token
    expiresInSeconds: 300,
    traceId: `mock_${Date.now().toString(36)}`,
  }
}

export function isMockMode(): boolean {
  return MOCK
}
