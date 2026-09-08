/**
 * Hasanat AI chat service — DETERMINISTIC responses, not LLM-generated.
 *
 * The pilot does not call an LLM for Hasanat AI. Responses are pattern-matched
 * and static. This guarantees:
 *   - The fatwa refusal rule is never bypassed (classifyMessage runs FIRST)
 *   - Responses are predictable and auditable
 *   - No API key or network dependency for chat in the pilot
 *
 * If an LLM is added later, it must be called AFTER classifyMessage() and
 * the refusal must still be enforced by this layer, not the prompt.
 */

import { classifyMessage, FATWA_REFUSAL_RESPONSE, SCHOLAR_ACK_RESPONSE } from './fatwa'
import { getSchedule } from './prayer'

export interface ChatAction {
  label: string
  route: string
}

export interface ChatReply {
  text: string
  actions?: ChatAction[]
  /** if true, a Scholar panel follow-up will arrive a few seconds later */
  escalateToScholar?: boolean
}

// ─── Topic matchers (run AFTER fatwa check) ──────────────────────────────────

interface Topic {
  match: RegExp
  reply: (ctx: { balance: number; points: number }) => ChatReply
}

const TOPICS: Topic[] = [
  {
    match: /\b(prayer|salah|salat|namaz)\b.*\b(time|schedule|when|next)\b/i,
    reply: () => {
      try {
        const s = getSchedule()
        const t = s.times.map((x) => `${x.name} ${x.time}`).join(', ')
        return {
          text: `Next prayer is ${s.nextName} in ${Math.floor(s.secondsUntilNext / 3600)}h ${Math.floor((s.secondsUntilNext % 3600) / 60)}m. Today in ${s.city}: ${t}.`,
          actions: [{ label: 'Open prayer times', route: '/prayer' }],
        }
      } catch {
        return { text: 'Prayer times are loading. Try again in a moment.', actions: [{ label: 'Open prayer', route: '/prayer' }] }
      }
    },
  },
  {
    match: /\b(time|schedule|when|next)\b.*\b(prayer|salah|salat|namaz)\b/i,
    reply: () => {
      try {
        const s = getSchedule()
        const t = s.times.map((x) => `${x.name} ${x.time}`).join(', ')
        return {
          text: `Next prayer is ${s.nextName} in ${Math.floor(s.secondsUntilNext / 3600)}h ${Math.floor((s.secondsUntilNext % 3600) / 60)}m. Today in ${s.city}: ${t}.`,
          actions: [{ label: 'Open prayer times', route: '/prayer' }],
        }
      } catch {
        return { text: 'Prayer times are loading. Try again in a moment.', actions: [{ label: 'Open prayer', route: '/prayer' }] }
      }
    },
  },
  {
    match: /\b(balance|how much|wallet|funds?)\b/i,
    reply: (ctx) => ({
      text: `Your balance is ${ctx.balance} HAS (≈ ${ctx.balance} SAR) and ${ctx.points} Hasanat Points (non-monetary recognition).`,
      actions: [{ label: 'Open wallet', route: '/wallet' }],
    }),
  },
  {
    match: /\b(zakat|zakah)\b/i,
    reply: () => ({
      text: 'Zakat is 2.5% on qualifying wealth above the nisab threshold. The Give screen has a calculator to help you estimate your due — it is indicative, not a religious ruling.',
      actions: [{ label: 'Open Give', route: '/give' }],
    }),
  },
  {
    match: /\b(sadaqah|charity|donate|give)\b/i,
    reply: () => ({
      text: 'You can give Sadaqah from the Give screen. Choose an amount, pick a verified campaign, and the giving is recorded in your charitable ledger.',
      actions: [{ label: 'Open Give', route: '/give' }],
    }),
  },
  {
    match: /\b(hajj|umrah|pilgrimage)\b/i,
    reply: () => ({
      text: 'Hajj and Umrah guidance is available in the Learn section. For rulings on your specific situation, I will route you to the Scholar panel.',
      actions: [{ label: 'Open Learn', route: '/learn' }],
    }),
  },
  {
    match: /\b(arabic|learn|quran|qur\'?an|islam|study)\b/i,
    reply: () => ({
      text: 'The Learn section has Arabic lessons, Qur\'an study, and Islamic knowledge tracks.',
      actions: [{ label: 'Open Learn', route: '/learn' }],
    }),
  },
  {
    match: /\b(pay|merchant|scan|qr|store|shop)\b/i,
    reply: () => ({
      text: 'You can pay merchants by scanning their QR code from the Pay screen. The merchant chooses settlement in HAS or SAR.',
      actions: [{ label: 'Open Pay', route: '/pay' }],
    }),
  },
  {
    match: /\b(send|transfer|to\s+\w+)\b/i,
    reply: () => ({
      text: 'To send HAS, open the Wallet and choose Send. Pick a contact, enter the amount, and confirm.',
      actions: [{ label: 'Open Wallet', route: '/wallet' }],
    }),
  },
  {
    match: /\b(ramadan|fasting|fast|iftar|suhoor)\b/i,
    reply: () => ({
      text: 'Ramadan information, fasting times, and duas are in the Learn and Prayer sections.',
      actions: [{ label: 'Open Prayer', route: '/prayer' }, { label: 'Open Learn', route: '/learn' }],
    }),
  },
  {
    match: /\b(dua|du\'?a|supplication|prayer\s+for)\b/i,
    reply: () => ({
      text: 'Common duas are in the Learn section, organized by occasion.',
      actions: [{ label: 'Open Learn', route: '/learn' }],
    }),
  },
  {
    match: /\b(volunteer|volunteering|community|activity|log)\b/i,
    reply: () => ({
      text: 'You can log voluntary activities from Home. Each log is reviewed by Hasanat AI and, once approved, earns Hasanat Points as recognition.',
      actions: [{ label: 'Open Home', route: '/' }],
    }),
  },
  {
    match: /\b(business|merchant|directory|store)\b/i,
    reply: () => ({
      text: 'The Businesses directory lists halal merchants accepting HAS. You can pay them directly.',
      actions: [{ label: 'Open Businesses', route: '/businesses' }],
    }),
  },
  {
    match: /\b(mosque|masjid|nearby)\b/i,
    reply: () => ({
      text: 'The Mosques section shows nearby mosques, prayer times, and donation links.',
      actions: [{ label: 'Open Mosques', route: '/mosques' }],
    }),
  },
  {
    match: /\b(who are you|what can you|help)\b/i,
    reply: () => ({
      text: 'I am Hasanat AI. I help with prayer times, your wallet, Zakat and giving, learning, activity logging, and merchants. I never issue religious rulings — those go to the Scholar panel. Your conversations are private.',
    }),
  },
]

const FALLBACK: ChatReply = {
  text: 'I can help with prayer times, your wallet, Zakat and giving, learning, activity logging, and merchants. For a religious ruling I connect you privately to the Scholar panel. What would you like?',
}

/**
 * Generate a Hasanat AI reply. Fatwa check runs FIRST and short-circuits.
 * This is the only entry point the chat route calls.
 */
export function generateReply(message: string, ctx: { balance: number; points: number }): ChatReply {
  // ─── FATWA CHECK — deterministic, runs before any topic matching ───
  const verdict = classifyMessage(message)
  if (verdict.isFatwa) {
    return {
      text: FATWA_REFUSAL_RESPONSE,
      escalateToScholar: true,
    }
  }

  // ─── Topic matching (deterministic) ───
  for (const topic of TOPICS) {
    if (topic.match.test(message)) {
      return topic.reply(ctx)
    }
  }
  return FALLBACK
}

/**
 * Scholar panel ack — STATIC, never AI-generated.
 * The Scholar panel is human (or human-simulated for the pilot).
 */
export function scholarAck(): string {
  return SCHOLAR_ACK_RESPONSE
}

/**
 * Community / Family mock responses. Clearly labeled as mock — no AI
 * pretending to be a real human without disclosure.
 */
export function communityMockReply(userName: string): string {
  const replies = [
    `${userName}: Jazak Allah khairan for sharing! See you at the masjid in sha' Allah.`,
    `${userName}: Wa alaikum salam. May Allah accept your efforts.`,
    `${userName}: That\'s a good question — maybe ask the Scholar panel for a proper answer.`,
  ]
  return replies[Math.floor(Math.random() * replies.length)]
}

export function familyMockReply(userName: string): string {
  const replies = [
    `${userName}: Sounds good, see you at iftar!`,
    `${userName}: Barak Allah fik, I\'ll send some HAS for the groceries.`,
    `${userName}: Love you too. Don\'t forget Maghrib is at the masjid tonight.`,
  ]
  return replies[Math.floor(Math.random() * replies.length)]
}

/**
 * Voice note transcription. The pilot has no speech-to-text API configured,
 * so this is an EXPLICIT MOCK — labeled as such in the response.
 * If a real STT API is configured later, replace this function.
 */
export function transcribeVoice(_audioBase64: string): { text: string; mock: boolean } {
  return {
    text: '[Voice note — transcription unavailable in pilot. Mock placeholder.]',
    mock: true,
  }
}
