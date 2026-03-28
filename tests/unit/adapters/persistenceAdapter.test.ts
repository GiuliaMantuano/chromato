/**
 * Integration tests: PersistenceAdapter (driven port adapter)
 *
 * Tests use real temp dirs (os.tmpdir()), not mocks.
 * Adapter integration tests verify real file I/O behavior.
 *
 * Test Budget: 2 distinct behaviors x 2 = 4 max unit tests
 *   B1: writeState + readState round-trip: written state is readable and valid JSON
 *   B2: readState returns null when no state file exists
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
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
});
