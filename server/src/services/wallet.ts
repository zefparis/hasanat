/**
 * Hasanat wallet / ledger — pilot mock.
 *
 * HONEST MOCK: no real ledger, no real value moves. This service exists so the
 * pilot is demonstrable in front of Benoit/Chairman. The interface is designed
 * so a real ledger engine can replace it without touching the front.
 *
 * Labels (ledger): reserve (buy/incoming), settlement (merchant redeem),
 * charitable (give), reward (points from presence/log), send (p2p transfer).
 */

export type LedgerLabel = 'reserve' | 'settlement' | 'charitable' | 'reward' | 'send'

export interface LedgerEntry {
  id: string
  ts: number // epoch ms
  label: LedgerLabel
  description: string
  amount: number // positive = credit, negative = debit
  unit: 'HAS' | 'pts' | 'SAR'
  /** mock-only: not a real chain confirmation */
  receiptNo?: string
}

export interface Wallet {
  balance: number // HAS
  points: number
  givenThisMonth: number // HAS
  monthlyCap: number // HAS
}

const wallets = new Map<string, Wallet>()
const ledgers = new Map<string, LedgerEntry[]>()

function getWallet(sid: string): Wallet {
  if (!wallets.has(sid)) {
    wallets.set(sid, { balance: 1250, points: 320, givenThisMonth: 45, monthlyCap: 10000 })
  }
  return wallets.get(sid)!
}

function getLedger(sid: string): LedgerEntry[] {
  if (!ledgers.has(sid)) {
    ledgers.set(sid, [
      { id: 'seed1', ts: Date.now() - 86_400_000, label: 'reserve', description: 'Initial backing received', amount: 1250, unit: 'HAS', receiptNo: 'MOCK-001' },
      { id: 'seed2', ts: Date.now() - 43_200_000, label: 'reward', description: 'Fajr presence recorded', amount: 10, unit: 'pts' },
      { id: 'seed3', ts: Date.now() - 21_600_000, label: 'charitable', description: 'Sadaqah — water wells', amount: -25, unit: 'HAS' },
    ])
  }
  return ledgers.get(sid)!
}

function addEntry(sid: string, entry: Omit<LedgerEntry, 'id' | 'ts'>): LedgerEntry {
  const ledger = getLedger(sid)
  const full: LedgerEntry = { ...entry, id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, ts: Date.now() }
  ledger.unshift(full)
  return full
}

function receiptNo(): string {
  return `MOCK-${Date.now().toString(36).toUpperCase()}`
}

export function getWalletState(sid: string): Wallet {
  return getWallet(sid)
}

export function getLedgerEntries(sid: string): LedgerEntry[] {
  return getLedger(sid)
}

export interface BuyResult { entry: LedgerEntry; balance: number }
export function buy(sid: string, sar: number): BuyResult {
  if (sar <= 0) throw new Error('Amount must be positive')
  const w = getWallet(sid)
  w.balance += sar // 1:1
  const entry = addEntry(sid, { label: 'reserve', description: `Buy ${sar} HAS (backed 1:1)`, amount: sar, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: w.balance }
}

export interface SendResult { entry: LedgerEntry; balance: number }
export function send(sid: string, to: string, amount: number): SendResult {
  const w = getWallet(sid)
  if (amount <= 0) throw new Error('Amount must be positive')
  if (amount > w.balance) throw new Error('Insufficient balance')
  w.balance -= amount
  const entry = addEntry(sid, { label: 'send', description: `Sent to ${to}`, amount: -amount, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: w.balance }
}

export interface ReceiveResult { entry: LedgerEntry; balance: number }
export function receive(sid: string, amount: number): ReceiveResult {
  const w = getWallet(sid)
  w.balance += amount
  const entry = addEntry(sid, { label: 'reserve', description: 'Received (incoming payment)', amount, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: w.balance }
}

export interface PayResult { entry: LedgerEntry; balance: number; merchantReceives: number }
export function pay(sid: string, merchant: string, amount: number, fee: number, settlement: 'retain' | 'convert' | 'split'): PayResult {
  const w = getWallet(sid)
  const total = amount + fee
  if (total > w.balance) throw new Error('Insufficient balance')
  w.balance -= total
  let merchantReceives = amount
  if (settlement === 'convert') merchantReceives = amount // merchant gets SAR equivalent
  else if (settlement === 'split') merchantReceives = Math.round(amount * 0.8 * 100) / 100
  const entry = addEntry(sid, { label: 'settlement', description: `Paid ${merchant} (${settlement})`, amount: -total, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: w.balance, merchantReceives }
}

export function isMockLedger(): boolean {
  return true // honest: this is a pilot mock ledger, no real chain behind it
}
