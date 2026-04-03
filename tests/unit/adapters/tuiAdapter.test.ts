/**
 * Integration tests: TuiAdapter compact layout at 30 columns.
 *
 * Tests verify that the TuiAdapter renders required fields correctly in
 * narrow terminal mode (columns < 40).
 *
 * Test Budget: 2 distinct behaviors x 2 = 4 max unit tests
 *   B1: Compact layout activates at columns < 40 — progress bar fits within column budget
 *   B2: Required fields (phase label, timer, badge) all remain visible in compact mode
 *
 * Note: ink-testing-library Stdout hardcodes columns=100.
 * The TimerFrame component accepts an explicit `columns` prop for testability.
 * Tests render TimerFrame directly with columns=30 to verify compact layout.
 *
 * Port boundary: TimerFrame is the internal React component; tests import it to
 * verify adapter layout behavior. This is an adapter integration test per
 * hexagonal testing mandate M4 (adapters tested with integration tests only).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TimerFrame } from '../../../src/adapters/tuiAdapter.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

const WORK_SNAPSHOT: SessionSnapshot = {
  phase: 'WORK',
  timer: {
    totalSeconds: 300,
    elapsedSeconds: 0,
    remainingSeconds: 300,
    progressFraction: 0,
    isOverdue: false,
    overdueElapsedSeconds: 0,
  },
  currentPomodoro: 1,
  completedToday: 0,
  streak: 0,
  config: {
    workDurationSeconds: 300,
    breakDurationSeconds: 300,
    longBreakDurationSeconds: 900,
    cycleCount: 4,
    useAscii: false,
    useColor: false,
  },
};

describe('TuiAdapter compact layout at columns=30', () => {
  it('B1: renders no line wider than 30 columns in compact mode', () => {
    const { lastFrame } = render(
      React.createElement(TimerFrame, { snapshot: WORK_SNAPSHOT, columns: 30 })
    );

    const frame = lastFrame() ?? '';
    const plain = stripAnsi(frame);
    const lines = plain.split('\n').filter((l) => l.trim().length > 0);

    const overflowingLines = lines.filter((line) => line.length > 30);
    expect(overflowingLines).toHaveLength(0);
  });

  it('B2: phase label, timer countdown, and session badge all appear in compact mode', () => {
    const { lastFrame } = render(
      React.createElement(TimerFrame, { snapshot: WORK_SNAPSHOT, columns: 30 })
    );

    const frame = lastFrame() ?? '';
    const plain = stripAnsi(frame);

    expect(plain).toMatch(/WORK|BREAK|LONG BREAK|OVERDUE|IDLE/i);
    expect(plain).toMatch(/\d{2}:\d{2}/);
    expect(plain).toMatch(/POMODORO/i);
  });
});
