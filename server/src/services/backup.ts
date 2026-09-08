/**
 * SQLite periodic backup — native better-sqlite3 backup() for crash-consistent copies.
 *
 * Render takes daily disk snapshots, but a raw snapshot can capture the .db file
 * mid-write and corrupt it. This module uses better-sqlite3's native backup API
 * which produces a transactionally-consistent copy even during active writes.
 *
 * Backups are written to a subfolder of the same disk (no new service, no cost).
 * Old backups are purged automatically (configurable retention, default 24).
 *
 * Config (env):
 *   SQLITE_DB_PATH       — same as db.ts (the source DB)
 *   BACKUP_INTERVAL_MS   — backup frequency (default: 3600000 = 1 hour)
 *   BACKUP_RETENTION     — number of backups to keep (default: 24)
 *   BACKUP_DIR           — backup directory (default: <db_dir>/backups)
 */

import db from './db'
import { mkdirSync, readdirSync, unlinkSync, statSync, closeSync, openSync } from 'fs'
import { dirname, join, resolve } from 'path'

const DB_PATH = resolve(process.env.SQLITE_DB_PATH ?? './data/hasanat.db')
const BACKUP_DIR = process.env.BACKUP_DIR ?? join(dirname(DB_PATH), 'backups')
const BACKUP_INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS) || 60 * 60 * 1000 // 1 hour
const BACKUP_RETENTION = Number(process.env.BACKUP_RETENTION) || 24

let timer: ReturnType<typeof setInterval> | null = null

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // 2026-09-08T18-00-00
}

/**
 * Run a single backup. Returns the backup file path on success, null on failure.
 * Uses better-sqlite3's native backup() which is crash-consistent and does not
 * block readers (it uses SQLite's online backup API under the hood).
 */
export function runBackup(): string | null {
  mkdirSync(BACKUP_DIR, { recursive: true })

  const filename = `hasanat-${timestampForFilename()}.db`
  const destPath = join(BACKUP_DIR, filename)

  try {
    // Use the shared db instance (already open, WAL mode enabled).
    // better-sqlite3's backup() uses SQLite's online backup API which
    // copies page-by-page without locking out readers.
    // Pre-create the file so better-sqlite3's internal statSync doesn't ENOENT.
    const fd = openSync(destPath, 'w')
    closeSync(fd)
    db.backup(destPath)

    const size = statSync(destPath).size
    // eslint-disable-next-line no-console
    console.log(`[BACKUP] OK: ${filename} (${(size / 1024).toFixed(1)} KB)`)
    return destPath
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[BACKUP] FAILED: ${(e as Error).message}`)
    return null
  }
}

/**
 * Delete old backups beyond the retention count.
 * Only deletes files matching the hasanat-*.db pattern to avoid touching other files.
 */
export function purgeOldBackups(): number {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('hasanat-') && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: join(BACKUP_DIR, f),
        mtime: statSync(join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime) // newest first

    let purged = 0
    for (const file of files.slice(BACKUP_RETENTION)) {
      try {
        unlinkSync(file.path)
        purged++
      } catch {
        // best-effort purge
      }
    }

    if (purged > 0) {
      // eslint-disable-next-line no-console
      console.log(`[BACKUP] Purged ${purged} old backup(s) (retention: ${BACKUP_RETENTION})`)
    }
    return purged
  } catch {
    return 0
  }
}

/**
 * Start the periodic backup scheduler. Runs an immediate backup on start,
 * then every BACKUP_INTERVAL_MS. Stops cleanly on process exit.
 */
export function startBackupScheduler(): void {
  // eslint-disable-next-line no-console
  console.log(
    `[BACKUP] Scheduler started — interval: ${BACKUP_INTERVAL_MS / 1000}s, ` +
    `retention: ${BACKUP_RETENTION}, dir: ${BACKUP_DIR}`
  )

  // Immediate backup on startup (so we always have at least one fresh copy)
  runBackup()
  purgeOldBackups()

  timer = setInterval(() => {
    runBackup()
    purgeOldBackups()
  }, BACKUP_INTERVAL_MS)

  // Clean shutdown
  process.on('SIGTERM', () => {
    if (timer) { clearInterval(timer); timer = null }
  })
  process.on('SIGINT', () => {
    if (timer) { clearInterval(timer); timer = null }
  })
}
