/** Mosques + Businesses + Learn routes. */
import { Router } from 'express'
import { getMosques, getMosque } from '../services/mosques'
import { getBusinesses, getBusiness } from '../services/businesses'
import { getLearnState } from '../services/learn'
import { send as walletSend } from '../services/wallet'

const r = Router()

function sidFrom(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-hasanat-sid'] as string) || 'demo'
}

// ─── Mosques ───
r.get('/mosques', (_req, res) => res.json({ mosques: getMosques() }))
r.get('/mosques/:id', (req, res) => {
  const m = getMosque(req.params.id)
  if (!m) { res.status(404).json({ error: 'not_found' }); return }
  res.json(m)
})
r.post('/mosques/:id/donate', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { amount } = req.body ?? {}
    if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }
    const m = getMosque(req.params.id)
    if (!m) { res.status(404).json({ error: 'not_found' }); return }
    res.json(walletSend(sid, `Donation — ${m.name}`, amount))
  } catch (e) { res.status(400).json({ error: 'donate_failed', message: (e as Error).message }) }
})

// ─── Businesses ───
r.get('/businesses', (_req, res) => res.json({ businesses: getBusinesses() }))
r.get('/businesses/:id', (req, res) => {
  const b = getBusiness(req.params.id)
  if (!b) { res.status(404).json({ error: 'not_found' }); return }
  res.json(b)
})

// ─── Learn ───
r.get('/learn', (_req, res) => res.json(getLearnState()))

export default r
