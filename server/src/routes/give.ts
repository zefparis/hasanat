/** Give routes — Zakat calculator, Sadaqah, campaigns. */
import { Router } from 'express'
import { calculateZakat, getCampaigns, paySadaqah, payZakat, type ZakatInput, type ZakatMadhab, type NisabType } from '../services/give'

const r = Router()

function sidFrom(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-hasanat-sid'] as string) || 'demo'
}

// Zakat calculator — indicative, not a fatwa.
r.post('/zakat', async (req, res) => {
  try {
    const sid = sidFrom(req)
    const b = req.body ?? {}
    const input: ZakatInput = {
      cash: Number(b.cash) || 0,
      gold: Number(b.gold) || 0,
      silver: Number(b.silver) || 0,
      businessAssets: Number(b.businessAssets) || 0,
      receivables: Number(b.receivables) || 0,
      shortTermDebts: Number(b.shortTermDebts) || 0,
      longTermDebts: Number(b.longTermDebts) || 0,
      madhab: (b.madhab as ZakatMadhab) || 'hanafi',
      nisabType: (b.nisabType as NisabType) || 'silver',
    }
    const result = await calculateZakat(input, sid)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: 'zakat_calc_failed', message: (e as Error).message })
  }
})

// Pay Zakat — routes to charitable ledger.
r.post('/zakat/pay', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { amount } = req.body ?? {}
    if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }
    res.json(payZakat(sid, amount))
  } catch (e) { res.status(400).json({ error: 'zakat_failed', message: (e as Error).message }) }
})

// Sadaqah — quick give or campaign contribution.
r.post('/sadaqah', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { amount, campaignId } = req.body ?? {}
    if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }
    res.json(paySadaqah(sid, amount, campaignId))
  } catch (e) { res.status(400).json({ error: 'sadaqah_failed', message: (e as Error).message }) }
})

// Campaigns list.
r.get('/campaigns', (_req, res) => {
  res.json({ campaigns: getCampaigns() })
})

export default r
