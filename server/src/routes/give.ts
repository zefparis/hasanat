/** Give routes — Zakat calculator, Sadaqah, campaigns. */
import { Router } from 'express'
import { calculateZakat, getCampaigns, paySadaqah, payZakat } from '../services/give'

const r = Router()

function sidFrom(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-hasanat-sid'] as string) || 'demo'
}

// Zakat calculator — indicative, not a fatwa.
r.post('/zakat', (req, res) => {
  const { cash, gold, silver, businessAssets, debts } = req.body ?? {}
  const result = calculateZakat({
    cash: Number(cash) || 0,
    gold: Number(gold) || 0,
    silver: Number(silver) || 0,
    businessAssets: Number(businessAssets) || 0,
    debts: Number(debts) || 0,
  })
  res.json(result)
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
