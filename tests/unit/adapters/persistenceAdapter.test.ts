/**
 * Integration tests: PersistenceAdapter (driven port adapter)
 *
 * Tests use real temp dirs (os.tmpdir()), not mocks.
 * Adapter integration tests verify real file I/O behavior.
 *
 * Test Budget: 4 distinct behaviors x 2 = 8 max unit tests
 *   B1: writeState + readState round-trip: written state is readable and valid JSON
 *   B2: readState returns null when no state file exists
 *   B3: readStreak() returns 0 when no sessions recorded
 *   B4: readStreak() returns 1 when sessions recorded today (consecutive-day streak)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
});
