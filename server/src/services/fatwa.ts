/**
 * Fatwa refusal engine — the most sensitive piece of the Hasanat product.
 *
 * This is a DETERMINISTIC, keyword/pattern-based detector. It does NOT depend
 * on any LLM. The refusal is a PRODUCT RULE, not a prompt preference — a model
 * can be jailbroken or drift, but this code cannot.
 *
 * When a message is classified as a fatwa request, the chat route MUST:
 *   1. Refuse to answer (no "general information" workaround that smuggles an opinion)
 *   2. Tell the user the question is escalated to the Scholar panel
 *   3. Trigger a Scholar panel message a few seconds later
 *
 * The patterns below are explicit and auditable. Adding a new pattern is a
 * code change that goes through review, not a prompt tweak.
 */

export type FatwaVerdict = {
  isFatwa: boolean
  /** which pattern matched, for auditability */
  matchedPattern?: string
  /** the category of question detected */
  category?: 'halal_haram' | 'validity' | 'personal_status' | 'religious_ruling' | 'ritual_validity'
}

// ─── Pattern categories ──────────────────────────────────────────────────────

// Halal/haram questions — asking whether something is permitted or forbidden.
const HALAL_HARAM_PATTERNS: RegExp[] = [
  /\bis\s+(this|it|that)\s+(halal|haram)\b/i,
  /\b(halal|haram)\s+(or|to)\b/i,
  /\b(is|are)\s+.{0,40}\s+(halal|haram)\b/i,
  /\bcan\s+i\s+(eat|drink|consume|use|do)\s+.{0,30}\b/i,
  /\bpermissible\b/i,
  /\bforbidden\b/i,
  /\bnot\s+allowed\b/i,
  /\b(is|are)\s+.{0,30}\s+(allowed|permitted)\s+(in\s+islam|for\s+muslims?)\b/i,
  // Arabic patterns — \b doesn't work with Arabic script, use direct matching
  /حلال/i,
  /حرام/i,
  /مباح/i,
  /ممنوع/i,
  /غير\s*جائز/i,
  /هل\s+يجوز/i,
  /هل\s+هذا\s+(حلال|حرام)/i,
]

// Validity of an act — asking if a specific action is valid/accepted.
const VALIDITY_PATTERNS: RegExp[] = [
  /\bis\s+my\s+(prayer|salah|salat|wudu|ghusl|fast|ramadan|nikah|marriage|divorce|talaq|hajj|umrah|zakat|sadaqah)\s+(valid|accepted|correct)\b/i,
  /\bdoes\s+my\s+.{0,30}\s+(count|count as|qualify)\b/i,
  /\b(is|are)\s+.{0,30}\s+(valid|invalid|accepted|rejected)\s+(in\s+islam|for\s+muslims?)\b/i,
  /\bnullify|invalidate|break\s+(my|the)\s+(fast|wudu|prayer|salah|salat)\b/i,
  // Arabic patterns
  /هل\s+(صلاتي|وضوئي|صيامي|صلاتي)\s+(صحيحة?|مقبولة?|صحيح)/i,
  /هل\s+يصح/i,
  /هل\s+يقبل/i,
  /أ?بطل/i,
  /يبطل/i,
  /يفسد/i,
  /هل\s+.{0,20}\s+(صحيح|باطل|مقبول|مرفوض)/i,
]

// Personal status — marriage, divorce, inheritance, custody.
const PERSONAL_STATUS_PATTERNS: RegExp[] = [
  /\b(nikah|marriage|divorce|talaq|khula|custody|inheritance|wali|mahr|dowry)\b/i,
  /\bcan\s+i\s+(marry|divorce|remarry)\b/i,
  /\b(is|are)\s+.{0,30}\s+(marriage|divorce)\s+(valid|recognized|allowed)\b/i,
  // Arabic patterns
  /زواج/i,
  /طلاق/i,
  /خلع/i,
  /حضانة/i,
  /ميراث/i,
  /ولي\s+الأمر/i,
  /مهر/i,
  /هل\s+يجوز\s+أن\s+أتزوج/i,
  /هل\s+يجوز\s+الطلاق/i,
]

// Direct request for a ruling / fatwa / opinion.
const RELIGIOUS_RULING_PATTERNS: RegExp[] = [
  /\bfatwa\b/i,
  /\bruling\b/i,
  /\b(religious|islamic)\s+(opinion|ruling|verdict|judgment|judgement)\b/i,
  /\bshould\s+i\s+(pray|fast|pay|give|divorce|marry)\b/i,
  /\bwhat\s+(should|must)\s+i\s+do\s+(about|regarding)\b/i,
  /\bis\s+it\s+(a\s+sin|sinful)\b/i,
  /\b(is|are)\s+.{0,30}\s+a\s+sin\b/i,
  // Arabic patterns
  /فتوى/i,
  /حكم\s+(شرعي|ديني)/i,
  /رأي\s+(ديني|شرعي)/i,
  /ماذا\s+يجب\s+أن\s+أفعل/i,
  /هل\s+هذا\s+إثم/i,
  /هل\s+هو\s+إثم/i,
  /إثم/i,
]

// Ritual validity — specific worship act correctness.
const RITUAL_VALIDITY_PATTERNS: RegExp[] = [
  /\bhow\s+(do|should)\s+i\s+(pray|perform|do)\s+(salah|salat|prayer|wudu|ghusl|janabah)\b/i,
  /\b(is|are)\s+.{0,20}\s+(rakats|rakahs|units)\s+(correct|right|enough)\b/i,
  /\bmissed\s+(a|my)\s+(prayer|salah|salat|fast|ramadan)\b/i,
  /\bmake\s?up\s+(for|a)\s+(missed|prayer|fast)\b/i,
  /\bqada\b/i,
  // Arabic patterns
  /كيف\s+أصلي/i,
  /كيف\s+أتوضأ/i,
  /كيف\s+أغتسل/i,
  /كم\s+ركعة/i,
  /فاتتني\s+(صلاة|فريضة)/i,
  /قضاء/i,
]

const ALL_CATEGORIES: { category: FatwaVerdict['category']; patterns: RegExp[] }[] = [
  { category: 'halal_haram', patterns: HALAL_HARAM_PATTERNS },
  { category: 'validity', patterns: VALIDITY_PATTERNS },
  { category: 'personal_status', patterns: PERSONAL_STATUS_PATTERNS },
  { category: 'religious_ruling', patterns: RELIGIOUS_RULING_PATTERNS },
  { category: 'ritual_validity', patterns: RITUAL_VALIDITY_PATTERNS },
]

/**
 * Classify a user message. Returns isFatwa=true if ANY pattern matches.
 * This is the single function the chat route calls — it is pure and
 * deterministic. No LLM, no network, no ambiguity.
 */
export function classifyMessage(text: string): FatwaVerdict {
  const trimmed = text.trim()
  if (!trimmed) return { isFatwa: false }

  for (const { category, patterns } of ALL_CATEGORIES) {
    for (const p of patterns) {
      if (p.test(trimmed)) {
        return { isFatwa: true, matchedPattern: p.source, category }
      }
    }
  }
  return { isFatwa: false }
}

/**
 * The refusal message shown to the user. This is STATIC — never generated.
 * It explicitly refuses to give an opinion, even a "general" one, and
 * explains the escalation.
 */
export const FATWA_REFUSAL_RESPONSE =
  "I can't issue a religious ruling or give an opinion on this — that's a matter for qualified scholars, not an AI assistant. " +
  "I'm routing your question privately to the Scholar panel. A scholar will respond in this chat shortly, in sha' Allah."

export const FATWA_REFUSAL_RESPONSE_AR =
  "لا يمكنني إصدار فتوى أو إبداء رأي ديني — هذا من اختصاص العلماء المؤهلين، وليس مساعد ذكاء اصطناعي. " +
  "أحوّل سؤالك سرًا إلى لجنة العلماء. سيرد عالم في هذه المحادثة قريبًا، إن شاء الله."

/**
 * The Scholar panel's follow-up message. Also STATIC — never AI-generated.
 * The Scholar panel is human (or human-simulated for the pilot), never the
 * same engine as Hasanat AI.
 */
export const SCHOLAR_ACK_RESPONSE =
  "Assalamu alaikum. The Scholar panel has received your question. " +
  "A qualified scholar will review it and respond here. This may take a few hours during the pilot. " +
  "Your question is private and shared only with the panel. Jazak Allah khairan for your patience."

export const SCHOLAR_ACK_RESPONSE_AR =
  "السلام عليكم. تلقّت لجنة العلماء سؤالك. " +
  "سيراجعه عالم مؤهل ويرد هنا. قد يستغرق ذلك بضع ساعات في النسخة التجريبية. " +
  "سؤالك خاص ويُشارك فقط مع اللجنة. جزاك الله خيرًا على صبرك."

/**
 * Detect whether a message is written in Arabic script.
 * Used to select the appropriate refusal / scholar ack language.
 */
export function isArabicText(text: string): boolean {
  // Count Arabic script characters (basic range + supplemental)
  const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F]/g)
  return !!arabicChars && arabicChars.length >= 3
}
