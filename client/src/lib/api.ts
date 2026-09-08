/** Browser API client for the Hasanat backend. Never calls HCS-U7 directly. */

const BASE = '/api'

const REQUEST_TIMEOUT_MS = 12_000

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const b = body as { error?: string; message?: string } | null
    throw new ApiError(res.status, b?.message ?? `Request failed: ${res.status}`, b?.error)
  }
  return body as T
}

// ─── Typed responses ─────────────────────────────────────────────────────────
export interface HcsSessionRes { sessionPublicId: string; createdAt: string; expiresAt: string }

export interface HcsChecks {
  deviceBound: boolean
  liveness: boolean
  cognitiveSignatureMatched: boolean
  secureSession: boolean
}
export interface HcsVerifyResult {
  ok: boolean
  sessionPublicId: string
  isHuman: boolean
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  checks: HcsChecks
  hcsToken: string | null
  expiresInSeconds: number
  traceId: string
}
export interface HcsVerifyRes { sid: string; result: HcsVerifyResult }

export interface HcsRotation {
  secondsUntilRotation: number
  rotationPeriodSeconds: number
  lastVerificationStatus: 'ok' | 'warning' | 'unknown'
}
export interface HcsSessionStatusRes {
  sid: string
  sessionPublicId: string
  isHuman: boolean
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  verifiedAt: number
  verificationCount: number
  rotation: HcsRotation
}

export const hcsApi = {
  createSession: () => api<HcsSessionRes>('/hasanat/session', { method: 'POST' }),
  verify: (body: { sessionPublicId: string; deviceFingerprint?: Record<string, unknown>; signals?: Record<string, unknown> }) =>
    api<HcsVerifyRes>('/hasanat/verify', { method: 'POST', body: JSON.stringify(body) }),
  sessionStatus: (sid: string) => api<HcsSessionStatusRes>(`/hasanat/session/${sid}`),
  signout: (sid: string) => api<{ ok: boolean }>('/hasanat/signout', { method: 'POST', body: JSON.stringify({ sid }) }),
}
