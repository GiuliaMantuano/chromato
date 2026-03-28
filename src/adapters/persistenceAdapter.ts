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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'node:module';
import type { StatePort, HistoryPort } from '../domain/ports.js';
import type { SessionSnapshot } from '../domain/types.js';

// createRequire allows loading CJS native modules (better-sqlite3) from ESM context.
const _require = createRequire(import.meta.url);

function resolveStateDir(xdgDataHome?: string): string {
  const base = xdgDataHome ?? process.env['XDG_DATA_HOME'] ?? path.join(os.homedir(), '.local', 'share');
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const idleContents = {
      schemaVersion: 1,
      phase: 'IDLE',
      remainingSeconds: 0,
      elapsedSeconds: 0,
      progressFraction: 0,
      currentPomodoro: 0,
      cycleCount: 4,
      completedToday: 0,
      streak: 0,
      isOverdue: false,
      overdueElapsedSeconds: 0,
      lastUpdatedUtc: new Date().toISOString(),
    };

    const tmp = `${this.stateFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(idleContents));
    fs.renameSync(tmp, this.stateFile);
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
    db.prepare(
      'INSERT INTO sessions (completed_pomodoros, recorded_at) VALUES (?, ?)'
    ).run(completedPomodoros, new Date().toISOString());
  }

  readTodayCount(): number {
    const db = this.openDb();
    const row = db.prepare(
      "SELECT COALESCE(SUM(completed_pomodoros), 0) AS total FROM sessions WHERE date(recorded_at) = date('now')"
    ).get() as { total: number };
    return row.total;
  }

  readStreak(): number {
    // Minimal stub: streak logic is post-MVP scope.
    return 0;
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
      )
    `);
    this.db = db;
    return db;
  }
}
