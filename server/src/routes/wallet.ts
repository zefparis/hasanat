/**
 * Wallet routes — pilot mock ledger.
 * HONEST MOCK: no real value moves. See services/wallet.ts.
 */
import { Router } from 'express'
import {
  getWalletState, getLedgerEntries, buy, send, receive, pay, isMockLedger,
} from '../services/wallet'
import { checkBuyRateLimit } from '../services/rate-limit'

// Simple sid extraction from header (the auth proxy sets the Hasanat session id).
function sidFrom(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-hasanat-sid'] as string) || 'demo'
}

const r = Router()

r.get('/', (req, res) => {
  const sid = sidFrom(req)
  res.json({ ...getWalletState(sid), mockLedger: isMockLedger() })
})

r.get('/activity', (req, res) => {
  const sid = sidFrom(req)
  res.json({ entries: getLedgerEntries(sid), mockLedger: isMockLedger() })
})

r.post('/buy', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { sar } = req.body ?? {}
    if (typeof sar !== 'number' || sar <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }

    // Rate limit: max RATE_LIMIT_BUY_MAX Buy transactions per hour (default 10).
    // Prevents script abuse of the mock ledger while it has no real backing.
    const rl = checkBuyRateLimit(sid)
    if (!rl.allowed) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'Too many Buy transactions. Please slow down and try again later.',
        retryAfterMs: rl.retryAfterMs,
        limit: rl.limit,
        windowMs: rl.windowMs,
      })
      return
    }

    res.json(buy(sid, sar))
  } catch (e) { res.status(400).json({ error: 'buy_failed', message: (e as Error).message }) }
})

r.post('/send', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { to, amount } = req.body ?? {}
    if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }
    if (!to || typeof to !== 'string') { res.status(400).json({ error: 'invalid_recipient' }); return }
    res.json(send(sid, to, amount))
  } catch (e) { res.status(400).json({ error: 'send_failed', message: (e as Error).message }) }
})

r.post('/receive', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { amount } = req.body ?? {}
    if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }
    res.json(receive(sid, amount))
  } catch (e) { res.status(400).json({ error: 'receive_failed', message: (e as Error).message }) }
})

r.post('/pay', (req, res) => {
  try {
    const sid = sidFrom(req)
    const { merchant, amount, fee, settlement } = req.body ?? {}
    if (typeof amount !== 'number' || amount <= 0) { res.status(400).json({ error: 'invalid_amount' }); return }
    if (!merchant) { res.status(400).json({ error: 'invalid_merchant' }); return }
    const s = (settlement as 'retain' | 'convert' | 'split') ?? 'retain'
    res.json(pay(sid, merchant, amount, Number(fee) || 0, s))
  } catch (e) { res.status(400).json({ error: 'pay_failed', message: (e as Error).message }) }
})

export default r
