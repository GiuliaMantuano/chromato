/**
 * Integration tests: StatusAdapter (driven port adapter)
 *
 * Tests verify observable formatting behavior.
 * No mocks -- real adapter called directly (adapter integration test).
 *
 * Test Budget: 3 distinct behaviors x 2 = 6 max unit tests
 *   B1: formatTmux returns non-empty string <= 20 visible chars for active WORK session
 *   B2: formatTmux returns empty string for null (no active session)
 *   B3: formatTmux bounds RAW output length (incl. ANSI escape overhead) to maxWidth,
 *       falling back to plain text when the colored variant would overflow while still
 *       preserving color when the colored variant already fits (parametrized, 1 test)
 */

import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
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

  // B3: chalk.hex() wraps visible text in ~22 bytes of ANSI escape overhead.
  // A maxWidth strictly between the visible length (10, e.g. "15:00 WORK")
  // and visible+overhead (~32) is the exact gap where the raw colored string
  // overflows maxWidth even though the plain (stripped) text fits.
  // Force chalk.level so the assertion is deterministic regardless of the
  // environment's own color-support detection (TTY / FORCE_COLOR).
  it.each([
    { width: 15, expectColorPreserved: false },
    { width: 100, expectColorPreserved: true },
  ])('formatTmux bounds raw length to width=$width chars (color preserved=$expectColorPreserved)', ({
    width,
    expectColorPreserved,
  }) => {
    const originalLevel = chalk.level;
    chalk.level = 3;
    try {
      const result = adapter.formatTmux(WORK_SNAPSHOT, width);
      expect(result.length).toBeLessThanOrEqual(width);
      expect(result.includes('\x1b[')).toBe(expectColorPreserved);
    } finally {
      chalk.level = originalLevel;
    }
  });
});
