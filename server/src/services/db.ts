/**
 * SQLite database connection — the single persistent store for Hasanat pilot.
 *
 * Replaces all in-memory Maps (wallets, ledgers, check-ins, campaigns,
 * HCS-U7 sessions) with a real SQLite file that survives process restarts.
 *
 * The DB path is configurable via SQLITE_DB_PATH env var.
 * Default: ./data/hasanat.db (relative to the server workspace).
 * On Render, mount a Persistent Disk and set SQLITE_DB_PATH to the disk path.
 */
import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

const DB_PATH = resolve(process.env.SQLITE_DB_PATH ?? './data/hasanat.db')

// Ensure the directory exists (fresh disk on Render won't have it yet)
mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)

// WAL mode for better concurrency (multiple reads during writes)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS wallets (
    sid TEXT PRIMARY KEY,
    balance REAL NOT NULL DEFAULT 1250,
    points REAL NOT NULL DEFAULT 320,
    given_this_month REAL NOT NULL DEFAULT 45,
    monthly_cap REAL NOT NULL DEFAULT 10000
  );

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    sid TEXT NOT NULL,
    ts INTEGER NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    unit TEXT NOT NULL,
    receipt_no TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_sid ON ledger_entries(sid, ts);

  CREATE TABLE IF NOT EXISTS presence_checkins (
    sid TEXT NOT NULL,
    prayer_name TEXT NOT NULL,
    date TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    UNIQUE(sid, prayer_name, date)
  );
  CREATE INDEX IF NOT EXISTS idx_checkins_sid ON presence_checkins(sid, recorded_at);

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    raised REAL NOT NULL DEFAULT 0,
    goal REAL NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 1,
    sponsor_pool REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS hasanat_sessions (
    sid TEXT PRIMARY KEY,
    session_public_id TEXT NOT NULL,
    is_human INTEGER NOT NULL DEFAULT 1,
    score REAL NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'low',
    verified_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS zakat_hawl (
    sid TEXT PRIMARY KEY,
    nisab_type TEXT NOT NULL DEFAULT 'silver',
    first_above_nisab_at INTEGER,
    last_checked_at INTEGER NOT NULL,
    last_net_asset_base REAL NOT NULL DEFAULT 0
  );
`)

// ─── Seed (only if tables are empty) ──────────────────────────────────────────

const seedWallet = db.prepare('SELECT COUNT(*) as c FROM wallets').get() as { c: number }
if (seedWallet.c === 0) {
  // Wallets are created on-demand per session (getWallet), so no seed needed here.
}

const seedCampaigns = db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as { c: number }
if (seedCampaigns.c === 0) {
  const insert = db.prepare(`
    INSERT INTO campaigns (id, title, subtitle, raised, goal, verified, sponsor_pool)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  insert.run('iftar', 'Orphan Iftar Fund', 'Meals for 500 orphans this Ramadan', 8400, 12000, 1, 2000)
  insert.run('water', 'Water Wells — Sahel', 'Clean water for 3 villages', 15600, 25000, 1, 5000)
  insert.run('school', 'Madrasa Books', 'Learning materials for 200 students', 3200, 8000, 1, 1000)
}

// Ledger seed happens per-session on first access (same as the old in-memory behavior).

export default db
