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
export interface HcsVerifyRes { sid: string; result: HcsVerifyResult; verifiedAt: number }

export interface HcsSessionStatusRes {
  sid: string
  sessionPublicId: string
  isHuman: boolean
  score: number
  riskLevel: 'low' | 'medium' | 'high'
  verifiedAt: number
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

// ─── Presence (check-in level 1) ──────────────────────────────────────────────
// GOLDEN RULE: "presence recorded" / "présence enregistrée" — NEVER "prayer verified"
export interface CheckInWindow {
  prayerName: string
  opensAt: number
  closesAt: number
  isOpen: boolean
  isPast: boolean
  secondsUntilOpen: number
  schedule: Array<{ name: string; time: string; asrHanafi?: string }>
}
export interface CheckInResult {
  ok: boolean
  message: string
  recordedAt: number
  prayerName: string
  pointsAwarded: number
  reason?: 'window_closed' | 'window_not_open' | 'already_checked_in' | 'session_invalid'
}
export interface CheckInHistoryEntry { prayerName: string; date: string; recordedAt: number }
export const presenceApi = {
  window: () => api<CheckInWindow>('/presence/window'),
  history: () => api<{ history: CheckInHistoryEntry[] }>('/presence/history'),
  today: () => api<{ checkedInToday: Array<{ name: string; checkedIn: boolean }> }>('/presence/today'),
  checkIn: () => api<CheckInResult>('/presence/checkin', { method: 'POST' }),
}

// ─── Explore (mosques, businesses, learn) ─────────────────────────────────────
export interface Mosque {
  id: string; name: string; area: string; distanceKm: number; jumuahTime: string
  institutionWallet: { general: number; sadaqah: number; zakat: number; pendingApprovals: number; signatoryThreshold: string }
}
export interface Business {
  id: string; name: string; category: 'Food' | 'Retail' | 'Travel' | 'Services'; area: string; acceptsHAS: boolean
  pos: { salesToday: number; transactionsToday: number; settlementPreference: 'retain' | 'convert' | 'split'; nextSettlementSAR: number; kybStatus: 'verified' | 'pending' | 'not_started' }
}
export interface Course { id: string; title: string; progress: number; lessons: number; completedLessons: number }
export interface Badge { id: string; title: string; earned: boolean; icon: string }
export interface LearnState { quran: { juzRead: number; juzTotal: number; streak: number; pointsThisMonth: number }; courses: Course[]; badges: Badge[] }
export const exploreApi = {
  mosques: () => api<{ mosques: Mosque[] }>('/mosques'),
  mosque: (id: string) => api<Mosque>(`/mosques/${id}`),
  donateMosque: (id: string, amount: number) => api<{ entry: LedgerEntry; balance: number }>(`/mosques/${id}/donate`, { method: 'POST', body: JSON.stringify({ amount }) }),
  businesses: () => api<{ businesses: Business[] }>('/businesses'),
  business: (id: string) => api<Business>(`/businesses/${id}`),
  learn: () => api<LearnState>('/learn'),
}
