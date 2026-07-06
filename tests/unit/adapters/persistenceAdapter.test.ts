/**
 * Integration tests: PersistenceAdapter (driven port adapter)
 *
 * Tests use real temp dirs (os.tmpdir()), not mocks.
 * Adapter integration tests verify real file I/O behavior.
 *
 * Test Budget: 7 distinct behaviors x 2 = 14 max unit tests
 *   B1: writeState + readState round-trip: written state is readable and valid JSON
 *   B2: readState returns null when no state file exists
 *   B3: readStreak() returns 0 when no sessions recorded
 *   B4: readStreak() returns 1 when sessions recorded today (consecutive-day streak)
 *   B5: recordOverdueEpisode() persists one overdue_episodes row per call, in call
 *       order, with duration_seconds matching the input (KPI 1/2 data source, step
 *       04-04). Property: for ANY sequence of overdue durations, recorded rows equal
 *       ended episodes with matching durations. Parametrized over representative
 *       duration sequences (no fast-check in this repo's devDependencies — this
 *       project's established convention for equivalence-class coverage without a
 *       new dependency is `it.each`, see tests/unit/domain/notificationMode.test.ts).
 *       The sqlite write/read itself is wiring-level (single mechanism exercised
 *       across all cases), not a property in its own right.
 *   B6: writeState/writeIdle create the state dir at 0o700 and write state.json
 *       at 0o600 (LOW-4, CWE-276: file_write_without_mode)
 *   B7: the tmp-then-rename write never follows a pre-existing symlink planted
 *       at the tmp path -- closes the TOCTOU gap (LOW-5, CWE-59:
 *       insecure_temp_then_rename)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { PersistenceAdapter } from '../../../src/adapters/persistenceAdapter.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';

const WORK_SNAPSHOT: SessionSnapshot = {
  phase: 'WORK',
  timer: {
    totalSeconds: 1500,
    elapsedSeconds: 600,
    remainingSeconds: 900,
    progressFraction: 0.4,
    isOverdue: false,
    overdueElapsedSeconds: 0,
  },
  currentPomodoro: 1,
  completedToday: 0,
  streak: 0,
  config: {
    workDurationSeconds: 1500,
    breakDurationSeconds: 300,
    longBreakDurationSeconds: 900,
    cycleCount: 4,
    useAscii: false,
    useColor: true,
  },
};

describe('PersistenceAdapter', () => {
  let tempDir: string;
  let adapter: PersistenceAdapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chromato-test-'));
    adapter = new PersistenceAdapter(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('writeState round-trips through readState and produces valid JSON on disk', () => {
    adapter.writeState(WORK_SNAPSHOT);

    const stateFile = path.join(tempDir, 'chromato', 'state.json');
    const raw = fs.readFileSync(stateFile, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();

    const recovered = adapter.readState();
    expect(recovered).not.toBeNull();
    expect(recovered!.phase).toBe('WORK');
    expect(recovered!.timer.remainingSeconds).toBe(900);
  });

  it('readState returns null when no state file exists', () => {
    const result = adapter.readState();
    expect(result).toBeNull();
  });

  // B3: readStreak() returns 0 when no sessions recorded
  it('readStreak returns 0 when no sessions have been recorded', () => {
    const streak = adapter.readStreak();
    expect(streak).toBe(0);
  });

  // B4: readStreak() returns >= 1 when a session was recorded today
  it('readStreak returns 1 after recording a session today', () => {
    adapter.recordSession(1);
    const streak = adapter.readStreak();
    expect(streak).toBeGreaterThanOrEqual(1);
  });

  // B5: recordOverdueEpisode() persists one row per call, matching duration_seconds,
  // in call order — the property holds for any sequence of overdue durations.
  it.each([
    [[1]],
    [[30, 60]],
    [[5, 3600, 12]],
    [[0]],
  ])('records %j as matching overdue_episodes rows', (durations) => {
    for (const duration of durations) {
      adapter.recordOverdueEpisode(duration);
    }

    const dbPath = path.join(tempDir, 'chromato', 'sessions.db');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const rows = db
        .prepare('SELECT duration_seconds FROM overdue_episodes ORDER BY id')
        .all() as { duration_seconds: number }[];
      expect(rows.map((r) => r.duration_seconds)).toEqual(durations);
    } finally {
      db.close();
    }
  });

  // B6/B7: file permission + TOCTOU hardening (LOW-4/LOW-5, 2026-07-06 security review)
  describe('file permission + TOCTOU hardening (LOW-4/LOW-5)', () => {
    it('creates the state directory with owner-only permissions (0o700)', () => {
      adapter.writeState(WORK_SNAPSHOT);
      const stateDir = path.join(tempDir, 'chromato');
      const mode = fs.statSync(stateDir).mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it('writes state.json with owner-only permissions (0o600)', () => {
      adapter.writeState(WORK_SNAPSHOT);
      const stateFile = path.join(tempDir, 'chromato', 'state.json');
      const mode = fs.statSync(stateFile).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('writeIdle also writes state.json with owner-only permissions (0o600)', () => {
      adapter.writeState(WORK_SNAPSHOT);
      adapter.writeIdle();
      const stateFile = path.join(tempDir, 'chromato', 'state.json');
      const mode = fs.statSync(stateFile).mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it('retroactively hardens a pre-existing state directory left at 0o755 by an older version', () => {
      // mkdirSync's `mode` option is a documented no-op when the directory
      // already exists -- this pre-seeds the dir the way an install upgrading
      // from a pre-fix version would find it, and proves the fix chmods it
      // explicitly rather than relying on mkdirSync alone.
      fs.mkdirSync(path.join(tempDir, 'chromato'), { recursive: true, mode: 0o755 });
      adapter.writeState(WORK_SNAPSHOT);
      const mode = fs.statSync(path.join(tempDir, 'chromato')).mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it('does not follow a pre-existing symlink planted at the tmp path (TOCTOU guard)', () => {
      const stateDir = path.join(tempDir, 'chromato');
      fs.mkdirSync(stateDir, { recursive: true });
      const victim = path.join(tempDir, 'victim.json');
      fs.writeFileSync(victim, 'untouched');
      const tmpPath = path.join(stateDir, 'state.json.tmp');
      fs.symlinkSync(victim, tmpPath);

      adapter.writeState(WORK_SNAPSHOT);

      // The symlink target must be untouched -- the write must not have
      // followed it -- and the real state file must contain fresh content.
      expect(fs.readFileSync(victim, 'utf8')).toBe('untouched');
      const stateFile = path.join(stateDir, 'state.json');
      expect(fs.lstatSync(stateFile).isSymbolicLink()).toBe(false);
      const written = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      expect(written.phase).toBe('WORK');
    });
  });
});
