/**
 * Give service — Zakat calculator, Sadaqah, campaigns.
 * Pilot mock: no real charitable disbursement. Ledger entries use the
 * 'charitable' label, consistent with wallet.ts.
 *
 * Storage: SQLite (see db.ts). Campaign progress and hawl persist across restarts.
 */

import { send as walletSend } from './wallet'
import db from './db'

// ─── Zakat types ───────────────────────────────────────────────────────────

export type ZakatMadhab = 'hanafi' | 'shafi' | 'maliki' | 'hanbali'
export type NisabType = 'gold' | 'silver'

export interface ZakatInput {
  cash: number
  gold: number // value in SAR (personal jewelry + investment gold)
  silver: number // value in SAR
  businessAssets: number
  receivables: number // money owed by third parties, reasonably recoverable
  shortTermDebts: number // debts/installments due within the coming year (always deductible)
  longTermDebts: number // remaining balance of long-term loans (deductible depends on madhab)
  madhab: ZakatMadhab
  nisabType: NisabType
}

export interface ZakatResult {
  /** net assessable wealth */
  netAssetBase: number
  /** 2.5% of net base */
  zakatDue: number
  /** nisab threshold in SAR (based on gold or silver) */
  nisab: number
  /** true if above nisab */
  aboveNisab: boolean
  /** which metal the nisab is based on */
  nisabType: NisabType
  /** nisab metal price used (SAR per gram) */
  nisabMetalPrice: number
  /** whether the metal price is live or fallback */
  nisabPriceSource: 'live' | 'fallback'
  /** madhab used for the calculation */
  madhab: ZakatMadhab
  /** gold value included in the calculation (0 if exempt by madhab) */
  goldIncluded: number
  /** total deductible debts */
  deductibleDebts: number
  /** hawl status */
  hawl: {
    /** timestamp when net assets first exceeded nisab (null if never or reset) */
    firstAboveNisabAt: number | null
    /** hawl duration in ms (1 lunar year ≈ 354 days) */
    hawlDurationMs: number
    /** timestamp when hawl completes (null if not started) */
    hawlCompleteAt: number | null
    /** days remaining until hawl completes (null if not started) */
    daysRemaining: number | null
    /** whether hawl is complete */
    isComplete: boolean
  }
  /** disclaimer — this is indicative, not a fatwa */
  disclaimer: string
}

// ─── Metal prices ──────────────────────────────────────────────────────────

const USD_TO_SAR = 3.75 // Saudi Riyal is pegged to USD
const TROY_OZ_TO_GRAM = 31.1035

// Nisab thresholds (grams)
const GOLD_NISAB_GRAMS = 87.48 // ≈ 20 dinars
const SILVER_NISAB_GRAMS = 612.36 // ≈ 200 dirhams

// Fallback prices (SAR per gram) — updated 2026-09, used if API is unavailable
const FALLBACK_GOLD_SAR_PER_GRAM = 532 // ≈ $4415/oz × 3.75 / 31.1
const FALLBACK_SILVER_SAR_PER_GRAM = 8.05 // ≈ $66.8/oz × 3.75 / 31.1

interface MetalPrices {
  goldSarPerGram: number
  silverSarPerGram: number
  source: 'live' | 'fallback'
}

let cachedPrices: MetalPrices | null = null
let cachedPricesAt = 0
const PRICE_CACHE_MS = 15 * 60 * 1000 // 15 minutes

async function fetchMetalPrices(): Promise<MetalPrices> {
  // Return cached if fresh
  if (cachedPrices && Date.now() - cachedPricesAt < PRICE_CACHE_MS) {
    return cachedPrices
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch('https://mintedmetal.com/api/prices.json', { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`metal API ${res.status}`)
    const data = await res.json() as {
      metals: { gold: { price: number }; silver: { price: number } }
    }
    const goldUsdPerOz = data.metals.gold.price
    const silverUsdPerOz = data.metals.silver.price
    if (!goldUsdPerOz || !silverUsdPerOz) throw new Error('missing prices')

    const prices: MetalPrices = {
      goldSarPerGram: (goldUsdPerOz * USD_TO_SAR) / TROY_OZ_TO_GRAM,
      silverSarPerGram: (silverUsdPerOz * USD_TO_SAR) / TROY_OZ_TO_GRAM,
      source: 'live',
    }
    cachedPrices = prices
    cachedPricesAt = Date.now()
    return prices
  } catch {
    // Fallback to static prices
    const prices: MetalPrices = {
      goldSarPerGram: FALLBACK_GOLD_SAR_PER_GRAM,
      silverSarPerGram: FALLBACK_SILVER_SAR_PER_GRAM,
      source: 'fallback',
    }
    return prices
  }
}

function calculateNisab(nisabType: NisabType, prices: MetalPrices): { nisab: number; metalPrice: number } {
  if (nisabType === 'gold') {
    return { nisab: GOLD_NISAB_GRAMS * prices.goldSarPerGram, metalPrice: prices.goldSarPerGram }
  }
  return { nisab: SILVER_NISAB_GRAMS * prices.silverSarPerGram, metalPrice: prices.silverSarPerGram }
}

// ─── Madhab rules ────────────────────────────────────────────────────────────
//
// Gold/jewelry personal use:
//   Hanafi: ALL gold/silver is zakatable (jewelry included)
//   Shafi'i/Maliki/Hanbali: personal-use jewelry is exempt if customary, not excessive
//   Sources: islamqa.org (Shafi'i), halalwallet.us, fatawacenter.com, AMJA
//   NOTE: One source (mizaan.ca) states Shafi'i treats all gold as zakatable.
//   The majority of sources say Shafi'i exempts personal-use jewelry.
//   We follow the majority view but flag this discrepancy in the disclaimer.
//
// Debt deduction:
//   Hanafi/Maliki/Hanbali: all debts with a human creditor are deductible
//     (full balance of long-term loans is deductible)
//   Shafi'i: only the annual installment due in the coming 12 months is deductible
//   Sources: islamicfinancecalculator.com, joebradford.net, seekersguidance.org

function goldIncludable(input: ZakatInput): number {
  // Hanafi: all gold is zakatable
  // Shafi'i/Maliki/Hanbali: personal-use jewelry is exempt
  // Since the user enters gold as a single value, we treat it as personal jewelry.
  // The user can separate investment gold into cash/businessAssets if following
  // a non-Hanafi madhab.
  if (input.madhab === 'hanafi') return input.gold
  return 0 // Exempt for Shafi'i/Maliki/Hanbali (personal use)
}

function deductibleDebts(input: ZakatInput): number {
  // Short-term debts are always deductible (all madhabs)
  let total = input.shortTermDebts

  // Long-term debts: deductible for Hanafi/Maliki/Hanbali, NOT for Shafi'i
  if (input.madhab !== 'shafi') {
    total += input.longTermDebts
  }

  return total
}

// ─── Hawl tracking ────────────────────────────────────────────────────────────

const HAWL_DURATION_MS = 354 * 24 * 60 * 60 * 1000 // 1 lunar year ≈ 354 days

interface HawlRow {
  sid: string
  nisab_type: string
  first_above_nisab_at: number | null
  last_checked_at: number
  last_net_asset_base: number
}

function updateHawl(sid: string, nisabType: NisabType, netAssetBase: number, nisab: number): ZakatResult['hawl'] {
  const now = Date.now()
  const aboveNisab = netAssetBase >= nisab

  const existing = db.prepare('SELECT * FROM zakat_hawl WHERE sid = ?').get(sid) as HawlRow | undefined

  let firstAboveNisabAt: number | null

  if (aboveNisab) {
    if (existing && existing.first_above_nisab_at && existing.nisab_type === nisabType) {
      // Already above nisab, keep the original timestamp
      firstAboveNisabAt = existing.first_above_nisab_at
    } else {
      // First time above nisab (or nisab type changed)
      firstAboveNisabAt = now
    }
  } else {
    // Below nisab — reset the counter
    firstAboveNisabAt = null
  }

  // Persist
  db.prepare(`
    INSERT INTO zakat_hawl (sid, nisab_type, first_above_nisab_at, last_checked_at, last_net_asset_base)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(sid) DO UPDATE SET
      nisab_type = excluded.nisab_type,
      first_above_nisab_at = excluded.first_above_nisab_at,
      last_checked_at = excluded.last_checked_at,
      last_net_asset_base = excluded.last_net_asset_base
  `).run(sid, nisabType, firstAboveNisabAt, now, netAssetBase)

  const hawlCompleteAt = firstAboveNisabAt ? firstAboveNisabAt + HAWL_DURATION_MS : null
  const daysRemaining = hawlCompleteAt ? Math.ceil((hawlCompleteAt - now) / (24 * 60 * 60 * 1000)) : null
  const isComplete = hawlCompleteAt ? now >= hawlCompleteAt : false

  return {
    firstAboveNisabAt,
    hawlDurationMs: HAWL_DURATION_MS,
    hawlCompleteAt,
    daysRemaining,
    isComplete,
  }
}

// ─── Main calculation ──────────────────────────────────────────────────────

export async function calculateZakat(input: ZakatInput, sid: string): Promise<ZakatResult> {
  const prices = await fetchMetalPrices()
  const { nisab, metalPrice } = calculateNisab(input.nisabType, prices)

  const goldValue = goldIncludable(input)
  const debts = deductibleDebts(input)

  const netAssetBase = Math.max(0,
    input.cash + goldValue + input.silver + input.businessAssets + input.receivables - debts
  )
  const zakatDue = Math.round(netAssetBase * 0.025 * 100) / 100
  const aboveNisab = netAssetBase >= nisab

  const hawl = updateHawl(sid, input.nisabType, netAssetBase, nisab)

  const disclaimerParts = [
    'This is an indicative calculation, not a religious ruling (fatwa).',
    ` Nisab based on ${input.nisabType} (${(input.nisabType === 'gold' ? GOLD_NISAB_GRAMS : SILVER_NISAB_GRAMS).toFixed(2)}g).`,
    prices.source === 'fallback' ? ' Metal prices are fallback estimates (live API unavailable).' : '',
    input.madhab !== 'hanafi'
      ? ` ${input.madhab.charAt(0).toUpperCase() + input.madhab.slice(1)}: personal-use gold jewelry is exempt. Investment gold should be listed under cash/business assets.`
      : ' Hanafi: all gold and silver jewelry is zakatable.',
    input.madhab === 'shafi'
      ? ' Shafi\'i: only debts due within 12 months are deductible (long-term loan balances are not).'
      : ` ${input.madhab.charAt(0).toUpperCase() + input.madhab.slice(1)}: all debts with a human creditor are deductible.`,
    ' For a definitive assessment, consult the Scholar panel.',
  ]

  return {
    netAssetBase,
    zakatDue,
    nisab: Math.round(nisab),
    aboveNisab,
    nisabType: input.nisabType,
    nisabMetalPrice: Math.round(metalPrice * 100) / 100,
    nisabPriceSource: prices.source,
    madhab: input.madhab,
    goldIncluded: goldValue,
    deductibleDebts: debts,
    hawl,
    disclaimer: disclaimerParts.join(''),
  }
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  title: string
  subtitle: string
  raised: number
  goal: number
  verified: boolean
  sponsorPool: number
}

interface CampaignRow {
  id: string
  title: string
  subtitle: string
  raised: number
  goal: number
  verified: number
  sponsor_pool: number
}

function rowToCampaign(r: CampaignRow): Campaign {
  return { id: r.id, title: r.title, subtitle: r.subtitle, raised: r.raised, goal: r.goal, verified: !!r.verified, sponsorPool: r.sponsor_pool }
}

export function getCampaigns(): Campaign[] {
  const rows = db.prepare('SELECT * FROM campaigns').all() as CampaignRow[]
  return rows.map(rowToCampaign)
}

export function contributeToCampaign(campaignId: string, amount: number): Campaign | null {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as CampaignRow | undefined
  if (!row) return null
  const newRaised = Math.min(row.goal, row.raised + amount)
  db.prepare('UPDATE campaigns SET raised = ? WHERE id = ?').run(newRaised, campaignId)
  const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId) as CampaignRow
  return rowToCampaign(updated)
}

/**
 * Pay Zakat — routes to the charitable ledger via the wallet service.
 * Refuses if amount > balance (wallet.send throws).
 */
export function payZakat(sid: string, amount: number) {
  return walletSend(sid, 'Zakat — eligible recipients', amount)
}

export function paySadaqah(sid: string, amount: number, campaignId?: string) {
  if (campaignId) contributeToCampaign(campaignId, amount)
  return walletSend(sid, campaignId ? `Sadaqah — ${campaignId}` : 'Sadaqah', amount)
}
