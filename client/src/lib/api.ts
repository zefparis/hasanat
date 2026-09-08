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

// ─── Prayer ──────────────────────────────────────────────────────────────────
export interface PrayerTime { name: string; time: string; asrHanafi?: string }
export interface PrayerSchedule {
  date: string; hijri: string; city: string; times: PrayerTime[]
  nextIndex: number; secondsUntilNext: number; nextName: string
}
export const prayerApi = {
  schedule: () => api<PrayerSchedule>('/prayer'),
}

// ─── Wallet ──────────────────────────────────────────────────────────────────
export type LedgerLabel = 'reserve' | 'settlement' | 'charitable' | 'reward' | 'send'
export interface LedgerEntry {
  id: string; ts: number; label: LedgerLabel; description: string
  amount: number; unit: 'HAS' | 'pts' | 'SAR'; receiptNo?: string
}
export interface WalletState {
  balance: number; points: number; givenThisMonth: number; monthlyCap: number; mockLedger: boolean
}
export interface WalletActivity { entries: LedgerEntry[]; mockLedger: boolean }
export interface BuyRes { entry: LedgerEntry; balance: number }
export interface SendRes { entry: LedgerEntry; balance: number }
export interface ReceiveRes { entry: LedgerEntry; balance: number }
export interface PayRes { entry: LedgerEntry; balance: number; merchantReceives: number }

export const walletApi = {
  state: () => api<WalletState>('/wallet'),
  activity: () => api<WalletActivity>('/wallet/activity'),
  buy: (sar: number) => api<BuyRes>('/wallet/buy', { method: 'POST', body: JSON.stringify({ sar }) }),
  send: (to: string, amount: number) => api<SendRes>('/wallet/send', { method: 'POST', body: JSON.stringify({ to, amount }) }),
  receive: (amount: number) => api<ReceiveRes>('/wallet/receive', { method: 'POST', body: JSON.stringify({ amount }) }),
  pay: (merchant: string, amount: number, fee: number, settlement: 'retain' | 'convert' | 'split') =>
    api<PayRes>('/wallet/pay', { method: 'POST', body: JSON.stringify({ merchant, amount, fee, settlement }) }),
}

// ─── Chat ────────────────────────────────────────────────────────────────────
export interface ChatAction { label: string; route: string }
export interface ChatReply {
  text: string
  actions?: ChatAction[]
  escalateToScholar?: boolean
}
export const chatApi = {
  ai: (message: string) => api<ChatReply>('/chat/ai', { method: 'POST', body: JSON.stringify({ message }) }),
  scholar: () => api<{ text: string }>('/chat/scholar', { method: 'POST' }),
  community: (userName: string) => api<{ text: string }>('/chat/community', { method: 'POST', body: JSON.stringify({ userName }) }),
  family: (userName: string) => api<{ text: string }>('/chat/family', { method: 'POST', body: JSON.stringify({ userName }) }),
  transcribe: (audio: string) => api<{ text: string; mock: boolean }>('/chat/transcribe', { method: 'POST', body: JSON.stringify({ audio }) }),
}

// ─── Give ────────────────────────────────────────────────────────────────────
export interface ZakatInput { cash: number; gold: number; silver: number; businessAssets: number; debts: number }
export interface ZakatResult {
  netAssetBase: number; zakatDue: number; nisab: number; aboveNisab: boolean; disclaimer: string
}
export interface Campaign {
  id: string; title: string; subtitle: string; raised: number; goal: number; verified: boolean; sponsorPool: number
}
export const giveApi = {
  zakat: (input: ZakatInput) => api<ZakatResult>('/give/zakat', { method: 'POST', body: JSON.stringify(input) }),
  payZakat: (amount: number) => api<{ entry: LedgerEntry; balance: number }>('/give/zakat/pay', { method: 'POST', body: JSON.stringify({ amount }) }),
  sadaqah: (amount: number, campaignId?: string) => api<{ entry: LedgerEntry; balance: number }>('/give/sadaqah', { method: 'POST', body: JSON.stringify({ amount, campaignId }) }),
  campaigns: () => api<{ campaigns: Campaign[] }>('/give/campaigns'),
}
