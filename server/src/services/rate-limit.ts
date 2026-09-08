/**
 * Simple SQLite-backed rate limiter for the pilot.
 *
 * No Redis needed — uses the same SQLite DB as the rest of Hasanat.
 * Sliding window: counts hits in the last `windowMs` for a given (sid, action).
 *
 * Usage:
 *   const { allowed, remaining, retryAfterMs } = checkRateLimit(sid, 'buy', 10, 3_600_000)
 *   if (!allowed) { res.status(429).json({ error: 'rate_limited', retryAfterMs }); return }
 *
 * Configurable via env:
 *   RATE_LIMIT_BUY_MAX   — max Buy transactions per window (default: 10)
 *   RATE_LIMIT_WINDOW_MS — window size in ms (default: 3_600_000 = 1 hour)
 */

import db from './db'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
  limit: number
  windowMs: number
}

/**
 * Check (and record) a rate-limit hit for (sid, action).
 * If the action would exceed `max` hits within `windowMs`, returns allowed=false
 * and does NOT record the hit (so the user isn't penalized for a rejected request).
 *
 * Periodically prunes old hits to keep the table small.
 */
export function checkRateLimit(sid: string, action: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const windowStart = now - windowMs

  // Count hits in the current window
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM rate_limit_hits WHERE sid = ? AND action = ? AND ts >= ?'
  ).get(sid, action, windowStart) as { c: number }

  const count = row.c
  const allowed = count < max

  if (allowed) {
    // Record this hit
    db.prepare('INSERT INTO rate_limit_hits (sid, action, ts) VALUES (?, ?, ?)').run(sid, action, now)
  }

  // Prune old hits occasionally (every ~100 requests, cheaply)
  // This keeps the table from growing unbounded without pruning on every call.
  if (Math.random() < 0.01) {
    db.prepare('DELETE FROM rate_limit_hits WHERE ts < ?').run(windowStart)
  }

  // Calculate retry-after: time until the oldest hit in the window expires
  let retryAfterMs = 0
  if (!allowed) {
    const oldest = db.prepare(
      'SELECT MIN(ts) as ts FROM rate_limit_hits WHERE sid = ? AND action = ? AND ts >= ?'
    ).get(sid, action, windowStart) as { ts: number | null }
    if (oldest.ts) {
      retryAfterMs = Math.max(0, oldest.ts + windowMs - now)
    }
  }

  return {
    allowed,
    remaining: Math.max(0, max - count - (allowed ? 1 : 0)),
    retryAfterMs,
    limit: max,
    windowMs,
  }
}

// ─── Presets ────────────────────────────────────────────────────────────────

const BUY_MAX = Number(process.env.RATE_LIMIT_BUY_MAX) || 10
const RECEIVE_MAX = Number(process.env.RATE_LIMIT_RECEIVE_MAX) || 10
const HCS_MAX = Number(process.env.RATE_LIMIT_HCS_MAX) || 5
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000 // 1 hour

/** Rate limit for the Buy endpoint. Keyed by sid. */
export function checkBuyRateLimit(sid: string): RateLimitResult {
  return checkRateLimit(sid, 'buy', BUY_MAX, WINDOW_MS)
}

/** Rate limit for the Receive endpoint. Keyed by sid. */
export function checkReceiveRateLimit(sid: string): RateLimitResult {
  return checkRateLimit(sid, 'receive', RECEIVE_MAX, WINDOW_MS)
}

/** Rate limit for HCS-U7 session creation. Keyed by IP (sid doesn't exist yet). */
export function checkHcsSessionRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`ip:${ip}`, 'hcs_session', HCS_MAX, WINDOW_MS)
}

/** Rate limit for HCS-U7 verification. Keyed by IP (sid is created only on success). */
export function checkHcsVerifyRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`ip:${ip}`, 'hcs_verify', HCS_MAX, WINDOW_MS)
}
