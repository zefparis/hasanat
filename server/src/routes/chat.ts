/** Chat routes — Hasanat AI (deterministic), Scholar ack, community/Family mock. */
import { Router } from 'express'
import { generateReply, scholarAck, communityMockReply, familyMockReply, transcribeVoice } from '../services/chat'
import { getWalletState } from '../services/wallet'

const r = Router()

function sidFrom(req: { headers: Record<string, string | string[] | undefined> }): string {
  return (req.headers['x-hasanat-sid'] as string) || 'demo'
}

// Hasanat AI — deterministic reply. Fatwa check runs inside generateReply.
r.post('/ai', (req, res) => {
  const sid = sidFrom(req)
  const { message } = req.body ?? {}
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'invalid_message' })
    return
  }
  const w = getWalletState(sid)
  const reply = generateReply(message, { balance: w.balance, points: w.points })
  res.json(reply)
})

// Scholar panel ack — static, never AI-generated. Detects Arabic from original message.
r.post('/scholar', (req, res) => {
  const { message } = req.body ?? {}
  res.json({ text: scholarAck(typeof message === 'string' ? message : undefined) })
})

// Community mock reply — clearly mock, no AI pretending to be human.
r.post('/community', (req, res) => {
  const { userName } = req.body ?? {}
  res.json({ text: communityMockReply(userName || 'You') })
})

// Family mock reply — clearly mock.
r.post('/family', (req, res) => {
  const { userName } = req.body ?? {}
  res.json({ text: familyMockReply(userName || 'You') })
})

// Voice note transcription — explicit mock in pilot.
r.post('/transcribe', (req, res) => {
  const { audio } = req.body ?? {}
  const result = transcribeVoice(audio || '')
  res.json(result)
})

export default r
