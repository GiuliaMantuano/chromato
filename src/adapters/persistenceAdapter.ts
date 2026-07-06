/**
 * PersistenceAdapter: implements StatePort and HistoryPort.
 *
 * StatePort: writes state.json atomically via fs.renameSync (tmp -> final).
 *   State directory: $XDG_DATA_HOME/chromato/ (or ~/.local/share/chromato/).
 *
 * HistoryPort: records completed sessions in better-sqlite3 sessions table.
 *   NOTE: better-sqlite3 is loaded lazily (only when DB methods are called)
 *   to keep `chromato status` startup time under 50ms (AC-03.1).
 *
 * No ink/react imports -- synchronous I/O only.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { StatePort, HistoryPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';

// createRequire allows loading CJS native modules (better-sqlite3) from ESM context.
const _require = createRequire(import.meta.url);

function resolveStateDir(xdgDataHome?: string): string {
  const base =
    xdgDataHome ?? process.env['XDG_DATA_HOME'] ?? path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'chromato');
}

function resolveDbPath(stateDir: string): string {
  return path.join(stateDir, 'sessions.db');
}

interface StateFileContents {
  schemaVersion: number;
  phase: string;
  remainingSeconds: number;
  elapsedSeconds: number;
  progressFraction: number;
  currentPomodoro: number;
  cycleCount: number;
  completedToday: number;
  streak: number;
  isOverdue: boolean;
  overdueElapsedSeconds: number;
  lastUpdatedUtc: string;
}

// Lazy reference to better-sqlite3 Database type.
// Using unknown here to avoid top-level import of better-sqlite3.
// biome-ignore lint/suspicious/noExplicitAny: deliberate lazy type to avoid a top-level better-sqlite3 import, which the fast-path arch rules forbid.
type BetterSqliteDatabase = any;

export class PersistenceAdapter implements StatePort, HistoryPort {
  private readonly stateDir: string;
  private readonly stateFile: string;
  private db: BetterSqliteDatabase | null = null;

  constructor(xdgDataHome?: string) {
    this.stateDir = resolveStateDir(xdgDataHome);
    this.stateFile = path.join(this.stateDir, 'state.json');
  }

  writeState(snapshot: SessionSnapshot): void {
    fs.mkdirSync(this.stateDir, { recursive: true });

    const contents: StateFileContents = {
      schemaVersion: 1,
      phase: snapshot.phase,
      remainingSeconds: snapshot.timer.remainingSeconds,
      elapsedSeconds: snapshot.timer.elapsedSeconds,
      progressFraction: snapshot.timer.progressFraction,
      currentPomodoro: snapshot.currentPomodoro,
      cycleCount: snapshot.config.cycleCount,
      completedToday: snapshot.completedToday,
      streak: snapshot.streak,
      isOverdue: snapshot.timer.isOverdue,
      overdueElapsedSeconds: snapshot.timer.overdueElapsedSeconds,
      lastUpdatedUtc: new Date().toISOString(),
    };

    const tmp = `${this.stateFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(contents));
    fs.renameSync(tmp, this.stateFile);
  }

  writeIdle(): void {
    fs.mkdirSync(this.stateDir, { recursive: true });

    // Preserve completedToday so an interrupted session does not reset the daily count.
    // The last writeState() call wrote the current completedToday; read it back here.
    const completedToday = this.readCompletedToday();

    const idleContents = {
      schemaVersion: 1,
      phase: 'IDLE',
      remainingSeconds: 0,
      elapsedSeconds: 0,
      progressFraction: 0,
      currentPomodoro: 0,
      cycleCount: 4,
      completedToday,
      streak: 0,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    };

    const tmp = `${this.stateFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(idleContents));
    fs.renameSync(tmp, this.stateFile);
  }

  readCompletedToday(): number {
    if (!fs.existsSync(this.stateFile)) {
      return 0;
    }
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const data = JSON.parse(raw) as StateFileContents;
      return data.completedToday ?? 0;
    } catch {
      return 0;
    }
  }

  readState(): SessionSnapshot | null {
    if (!fs.existsSync(this.stateFile)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf8');
      const data = JSON.parse(raw) as StateFileContents;

      if (data.phase === 'IDLE') {
        return null;
      }

      return {
        phase: data.phase as SessionSnapshot['phase'],
        timer: {
          totalSeconds: (data.remainingSeconds ?? 0) + (data.elapsedSeconds ?? 0),
          elapsedSeconds: data.elapsedSeconds ?? 0,
          remainingSeconds: data.remainingSeconds ?? 0,
          progressFraction: data.progressFraction ?? 0,
          isOverdue: data.isOverdue ?? false,
          overdueElapsedSeconds: data.overdueElapsedSeconds ?? 0,
        },
        currentPomodoro: data.currentPomodoro ?? 1,
        completedToday: data.completedToday ?? 0,
        streak: data.streak ?? 0,
        config: {
          workDurationSeconds: (data.remainingSeconds ?? 0) + (data.elapsedSeconds ?? 0) || 1500,
          breakDurationSeconds: 300,
          longBreakDurationSeconds: 900,
          cycleCount: data.cycleCount ?? 4,
          useAscii: false,
          useColor: true,
        },
      };
    } catch {
      return null;
    }
  }

  recordSession(completedPomodoros: number): void {
    const db = this.openDb();
    db.prepare('INSERT INTO sessions (completed_pomodoros, recorded_at) VALUES (?, ?)').run(
      completedPomodoros,
      new Date().toISOString(),
    );
  }

  readTodayCount(): number {
    const db = this.openDb();
    const row = db
      .prepare(
        "SELECT COALESCE(SUM(completed_pomodoros), 0) AS total FROM sessions WHERE date(recorded_at) = date('now')",
      )
      .get() as { total: number };
    return row.total;
  }

  /**
   * KPI 1/2 data source (step 04-04): records one completed OVERDUE episode.
   * Written when the episode ends (skip to WORK) or the session exits while
   * still overdue (quit/Ctrl+C/SIGTERM) -- see SessionService's hook points.
   * `started_at` is derived (now - duration) since the domain only surfaces
   * the elapsed count, not a wall-clock start. Additive: sessions table and
   * the lazy-sqlite status fast path (AC-03.1) are untouched.
   */
  recordOverdueEpisode(durationSeconds: number): void {
    const db = this.openDb();
    const recordedAt = new Date();
    const startedAt = new Date(recordedAt.getTime() - durationSeconds * 1000);
    db.prepare(
      'INSERT INTO overdue_episodes (phase, started_at, duration_seconds, recorded_at) VALUES (?, ?, ?, ?)',
    ).run('OVERDUE', startedAt.toISOString(), durationSeconds, recordedAt.toISOString());
  }

  readStreak(): number {
    const db = this.openDb();
    // Compute streak: count the number of consecutive calendar days ending today
    // that have at least one recorded session.
    // Strategy: fetch distinct local dates (descending), walk backward from today
    // until a gap is found.
    const rows = db
      .prepare(
        `SELECT DISTINCT date(recorded_at, 'localtime') AS local_date
       FROM sessions
       ORDER BY local_date DESC`,
      )
      .all() as { local_date: string }[];

    if (rows.length === 0) {
      return 0;
    }

    const today = new Date();
    // Use local date components to match SQLite's `date(recorded_at, 'localtime')`.
    // toISOString() returns UTC which diverges from local date after midnight local time.
    const todayStr =
      today.getFullYear() +
      '-' +
      String(today.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(today.getDate()).padStart(2, '0');

    // Streak only counts if there is a session today (or yesterday for same-day start edge case).
    // We walk from today backward; each consecutive day increments the streak.
    let streak = 0;
    let cursor = todayStr;

    for (const row of rows) {
      if (row.local_date === cursor) {
        streak += 1;
        // Move cursor to the previous day.
        const prev = new Date(`${cursor}T00:00:00Z`);
        prev.setUTCDate(prev.getUTCDate() - 1);
        cursor = prev.toISOString().slice(0, 10);
      } else {
        break;
      }
    }

    return streak;
  }

  private openDb(): BetterSqliteDatabase {
    if (this.db !== null) {
      return this.db;
    }
    fs.mkdirSync(this.stateDir, { recursive: true });
    // Use _require (createRequire) to load CJS native module from ESM context.
    // Lazy load to keep `chromato status` startup fast (AC-03.1).
    const Database = _require('better-sqlite3');
    const db = new Database(resolveDbPath(this.stateDir));
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        completed_pomodoros INTEGER NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS overdue_episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase TEXT NOT NULL,
        started_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        recorded_at TEXT NOT NULL
      )
    `);
    this.db = db;
    return db;
  }
}
