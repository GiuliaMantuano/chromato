/**
 * Integration tests: StatusAdapter (driven port adapter)
 *
 * Tests verify observable formatting behavior.
 * No mocks -- real adapter called directly (adapter integration test).
 *
 * Test Budget: 2 distinct behaviors x 2 = 4 max unit tests
 *   B1: formatTmux returns non-empty string <= 20 visible chars for active WORK session
 *   B2: formatTmux returns empty string for null (no active session)
 */

import { describe, it, expect } from 'vitest';
import { StatusAdapter } from '../../../src/adapters/statusAdapter.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

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
    useColor: false,
  },
};

describe('StatusAdapter', () => {
  const adapter = new StatusAdapter();

  it('formatTmux returns non-empty string of 20 visible chars or fewer for active WORK session', () => {
    const result = adapter.formatTmux(WORK_SNAPSHOT);
    const visible = stripAnsi(result);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(20);
  });

  it('formatTmux returns empty string when snapshot is null', () => {
    const result = adapter.formatTmux(null);
    expect(result).toBe('');
  });
});
