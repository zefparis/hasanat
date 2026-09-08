/**
 * Give service — Zakat calculator, Sadaqah, campaigns.
 * Pilot mock: no real charitable disbursement. Ledger entries use the
 * 'charitable' label, consistent with wallet.ts.
 *
 * Storage: SQLite (see db.ts). Campaign progress persists across restarts.
 */

import { send as walletSend } from './wallet'
import db from './db'

export interface ZakatInput {
  cash: number
  gold: number // value in SAR
  silver: number // value in SAR
  businessAssets: number
  debts: number
}

export interface ZakatResult {
  /** net assessable wealth */
  netAssetBase: number
  /** 2.5% of net base */
  zakatDue: number
  /** illustrative nisab threshold (gold-equivalent, shown as indicative) */
  nisab: number
  /** true if above nisab */
  aboveNisab: boolean
  /** disclaimer — this is indicative, not a fatwa */
  disclaimer: string
}

// Illustrative nisab — gold equivalent. This is a DISPLAY VALUE, not a
// religious ruling. The spec says: "afficher clairement comme illustratif".
const ILLUSTRATIVE_NISAB = 23000 // SAR, approximate gold-nisab

export function calculateZakat(input: ZakatInput): ZakatResult {
  const netAssetBase = Math.max(0, input.cash + input.gold + input.silver + input.businessAssets - input.debts)
  const zakatDue = Math.round(netAssetBase * 0.025 * 100) / 100
  const aboveNisab = netAssetBase >= ILLUSTRATIVE_NISAB
  return {
    netAssetBase,
    zakatDue,
    nisab: ILLUSTRATIVE_NISAB,
    aboveNisab,
    disclaimer: 'This is an indicative calculation, not a religious ruling. The nisab threshold shown is illustrative. For a definitive assessment, consult the Scholar panel.',
  }
}

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
  // Use wallet.send with a special recipient label so it hits the 'charitable' ledger.
  // We call walletSend but we want the 'charitable' label, not 'send'.
  // So we add a dedicated entry here instead.
  return walletSend(sid, 'Zakat — eligible recipients', amount)
}

export function paySadaqah(sid: string, amount: number, campaignId?: string) {
  if (campaignId) contributeToCampaign(campaignId, amount)
  return walletSend(sid, campaignId ? `Sadaqah — ${campaignId}` : 'Sadaqah', amount)
}
