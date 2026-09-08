/**
 * Hasanat wallet / ledger — pilot mock, now backed by SQLite.
 *
 * HONEST MOCK: no real ledger, no real value moves. This service exists so the
 * pilot is demonstrable in front of Benoit/Chairman. The interface is designed
 * so a real ledger engine can replace it without touching the front.
 *
 * Storage: SQLite (see db.ts). State survives process restarts.
 *
 * Labels (ledger): reserve (buy/incoming), settlement (merchant redeem),
 * charitable (give), reward (points from presence/log), send (p2p transfer).
 */

import db from './db'

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

interface WalletRow {
  sid: string
  balance: number
  points: number
  given_this_month: number
  monthly_cap: number
}

interface LedgerRow {
  id: string
  sid: string
  ts: number
  label: string
  description: string
  amount: number
  unit: string
  receipt_no: string | null
}

function rowToWallet(r: WalletRow): Wallet {
  return { balance: r.balance, points: r.points, givenThisMonth: r.given_this_month, monthlyCap: r.monthly_cap }
}

function rowToLedger(r: LedgerRow): LedgerEntry {
  return { id: r.id, ts: r.ts, label: r.label as LedgerLabel, description: r.description, amount: r.amount, unit: r.unit as LedgerEntry['unit'], receiptNo: r.receipt_no ?? undefined }
}

const SEED_BALANCE = 1250
const SEED_POINTS = 320
const SEED_GIVEN = 45
const SEED_CAP = 10000

function getWallet(sid: string): Wallet {
  let row = db.prepare('SELECT * FROM wallets WHERE sid = ?').get(sid) as WalletRow | undefined
  if (!row) {
    db.prepare('INSERT INTO wallets (sid, balance, points, given_this_month, monthly_cap) VALUES (?, ?, ?, ?, ?)')
      .run(sid, SEED_BALANCE, SEED_POINTS, SEED_GIVEN, SEED_CAP)
    row = db.prepare('SELECT * FROM wallets WHERE sid = ?').get(sid) as WalletRow
    // Seed the ledger with the same initial entries as the old in-memory version
    const now = Date.now()
    const seedEntries = [
      { id: `seed1_${sid}`, ts: now - 86_400_000, label: 'reserve', description: 'Initial backing received', amount: SEED_BALANCE, unit: 'HAS', receiptNo: 'MOCK-001' },
      { id: `seed2_${sid}`, ts: now - 43_200_000, label: 'reward', description: 'Fajr presence recorded', amount: 10, unit: 'pts', receiptNo: undefined },
      { id: `seed3_${sid}`, ts: now - 21_600_000, label: 'charitable', description: 'Sadaqah — water wells', amount: -25, unit: 'HAS', receiptNo: undefined },
    ]
    const insert = db.prepare('INSERT INTO ledger_entries (id, sid, ts, label, description, amount, unit, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const e of seedEntries) {
      insert.run(e.id, sid, e.ts, e.label, e.description, e.amount, e.unit, e.receiptNo ?? null)
    }
  }
  return rowToWallet(row)
}

function getLedger(sid: string): LedgerEntry[] {
  const rows = db.prepare('SELECT * FROM ledger_entries WHERE sid = ? ORDER BY ts DESC').all(sid) as LedgerRow[]
  return rows.map(rowToLedger)
}

function addEntry(sid: string, entry: Omit<LedgerEntry, 'id' | 'ts'>): LedgerEntry {
  // Use crypto.randomUUID() for collision-free IDs (Date.now()+random collides on rapid-fire requests)
  const id = `e_${crypto.randomUUID()}`
  const ts = Date.now()
  db.prepare('INSERT INTO ledger_entries (id, sid, ts, label, description, amount, unit, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, sid, ts, entry.label, entry.description, entry.amount, entry.unit, entry.receiptNo ?? null)
  return { ...entry, id, ts }
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
  const newBalance = w.balance + sar
  db.prepare('UPDATE wallets SET balance = ? WHERE sid = ?').run(newBalance, sid)
  const entry = addEntry(sid, { label: 'reserve', description: `Buy ${sar} HAS (backed 1:1)`, amount: sar, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: newBalance }
}

export interface SendResult { entry: LedgerEntry; balance: number }
export function send(sid: string, to: string, amount: number): SendResult {
  const w = getWallet(sid)
  if (amount <= 0) throw new Error('Amount must be positive')
  if (amount > w.balance) throw new Error('Insufficient balance')
  const newBalance = w.balance - amount
  db.prepare('UPDATE wallets SET balance = ? WHERE sid = ?').run(newBalance, sid)
  const entry = addEntry(sid, { label: 'send', description: `Sent to ${to}`, amount: -amount, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: newBalance }
}

export interface ReceiveResult { entry: LedgerEntry; balance: number }
export function receive(sid: string, amount: number): ReceiveResult {
  const w = getWallet(sid)
  const newBalance = w.balance + amount
  db.prepare('UPDATE wallets SET balance = ? WHERE sid = ?').run(newBalance, sid)
  const entry = addEntry(sid, { label: 'reserve', description: 'Received (incoming payment)', amount, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: newBalance }
}

export interface PayResult { entry: LedgerEntry; balance: number; merchantReceives: number }
export function pay(sid: string, merchant: string, amount: number, fee: number, settlement: 'retain' | 'convert' | 'split'): PayResult {
  const w = getWallet(sid)
  const total = amount + fee
  if (total > w.balance) throw new Error('Insufficient balance')
  const newBalance = w.balance - total
  db.prepare('UPDATE wallets SET balance = ? WHERE sid = ?').run(newBalance, sid)
  let merchantReceives = amount
  if (settlement === 'convert') merchantReceives = amount // merchant gets SAR equivalent
  else if (settlement === 'split') merchantReceives = Math.round(amount * 0.8 * 100) / 100
  const entry = addEntry(sid, { label: 'settlement', description: `Paid ${merchant} (${settlement})`, amount: -total, unit: 'HAS', receiptNo: receiptNo() })
  return { entry, balance: newBalance, merchantReceives }
}

export function isMockLedger(): boolean {
  return true // honest: this is a pilot mock ledger, no real chain behind it
}
