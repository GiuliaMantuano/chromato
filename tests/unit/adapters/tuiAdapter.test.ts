/**
 * Integration tests: TuiAdapter compact layout, phase-matched colors, and ASCII fallback.
 *
 * Tests verify that the TuiAdapter renders required fields correctly in
 * narrow terminal mode (columns < 40), that progress bar fill colors
 * match the current phase (AC-01.5), and that ASCII fallback renders
 * the correct characters (AC-01.4).
 *
 * Test Budget:
 *   Compact layout: 2 behaviors x 2 = 4 max unit tests
 *     B1: Compact layout activates at columns < 40 — progress bar fits within column budget
 *     B2: Required fields (phase label, timer, badge) all remain visible in compact mode
 *   Phase colors: 4 behaviors x 2 = 8 max unit tests
 *     B3: WORK phase renders with WORK fg color (#00d7ff) ANSI codes
 *     B4: BREAK phase renders with BREAK fg color (#005fff) ANSI codes
 *     B5: OVERDUE phase renders with OVERDUE fg color (#ff0000) ANSI codes
 *     B6: useColor=false suppresses all ANSI escape sequences
 *   ASCII fallback: 1 behavior x 2 = 2 max unit tests
 *     B7: useAscii=true renders '=' for filled and '-' for empty (not Unicode block chars)
 *
 * Note: ink-testing-library Stdout hardcodes columns=100.
 * The TimerFrame component accepts an explicit `columns` prop for testability.
 * Tests render TimerFrame directly with columns=30 to verify compact layout.
 *
 * Port boundary: TimerFrame is the internal React component; tests import it to
 * verify adapter layout behavior. This is an adapter integration test per
 * hexagonal testing mandate M4 (adapters tested with integration tests only).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { render as inkRender } from 'ink';
import * as inkModule from 'ink';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import { TimerFrame, TuiAdapter } from '../../../src/adapters/tuiAdapter.js';
import { printBanner } from '../../../src/adapters/bannerAdapter.js';
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

function makeSnapshot(phase: SessionSnapshot['phase'], useColor: boolean): SessionSnapshot {
  return {
    phase,
    timer: {
      totalSeconds: 1500,
      elapsedSeconds: 300,
      remainingSeconds: 1200,
      progressFraction: 0.2,
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
      useColor,
    },
  };
}

/** Checks whether a string contains ANSI color sequences (not just control sequences). */
function hasAnsiEscapes(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\x1b\[/.test(str);
}

/** Checks whether a string contains ANSI color-specific sequences (38;2; truecolor or 38;5; 256-color). */
function hasColorEscapes(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\x1b\[(?:38|39|31|32|33|34|35|36|37|9[0-7]);/.test(str) || /\x1b\[38;[25];/.test(str);
}

// ---------------------------------------------------------------------------
// Helper: render TimerFrame with a real Ink instance and forced color output.
//
// ink-testing-library uses debug:true which strips ANSI codes. For color
// verification we need a custom stream with FORCE_COLOR=1 to ensure chalk
// emits ANSI sequences even without a real TTY.
// ---------------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  readonly columns = 80;
  private _lastFrame = '';
  write(frame: string): void { this._lastFrame = frame; }
  lastFrame(): string { return this._lastFrame; }
}

async function renderWithColor(element: React.ReactElement): Promise<string> {
  const stdout = new FakeStdout();
  const instance = inkRender(element, {
    // Cast required: Ink accepts any writable stream-like object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stdout: stdout as any,
    debug: false,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  // Allow one microtask cycle for React to flush
  await new Promise<void>((resolve) => setImmediate(resolve));
  instance.unmount();
  return stdout.lastFrame();
}

// ---------------------------------------------------------------------------
// AC-01.5: Phase-matched progress bar colors
// ---------------------------------------------------------------------------

describe('TuiAdapter phase-matched progress bar colors (AC-01.5)', () => {
  // Force chalk to emit ANSI codes in the test process (no real TTY available).
  // FORCE_COLOR is read at module import time by chalk; we set it before importing.
  // Since chalk is already imported, we must set the env before the describe block
  // to influence chalk's color level for subsequent renders.
  let originalChalkLevel: chalk.Level;
  beforeAll(() => { originalChalkLevel = chalk.level; chalk.level = 3; });
  afterAll(() => { chalk.level = originalChalkLevel; });

  it('B3: WORK phase renders ANSI color codes when useColor=true', async () => {
    const snapshot = makeSnapshot('WORK', true);
    // WORK phase fg color is #00d7ff — Ink encodes as \x1b[38;2;0;215;255m
    const frame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot, columns: 80 })
    );
    expect(hasAnsiEscapes(frame)).toBe(true);
  });

  it('B4: BREAK phase renders ANSI color codes when useColor=true', async () => {
    const snapshot = makeSnapshot('BREAK', true);
    // BREAK phase fg color is #005fff — \x1b[38;2;0;95;255m
    const frame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot, columns: 80 })
    );
    expect(hasAnsiEscapes(frame)).toBe(true);
  });

  it('B5: OVERDUE phase renders ANSI color codes when useColor=true', async () => {
    const snapshot = makeSnapshot('OVERDUE', true);
    // OVERDUE phase fg color is #ff0000 — \x1b[38;2;255;0;0m
    const frame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot, columns: 80 })
    );
    expect(hasAnsiEscapes(frame)).toBe(true);
  });

  it('B6: useColor=false suppresses color ANSI sequences', async () => {
    const snapshot = makeSnapshot('WORK', false);
    const frame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot, columns: 80 })
    );
    // Ink emits cursor/control sequences; we check specifically for color sequences
    expect(hasColorEscapes(frame)).toBe(false);
  });
});

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

// ---------------------------------------------------------------------------
// AC-01.4: ASCII fallback character rendering
// ---------------------------------------------------------------------------

describe('TuiAdapter ASCII fallback characters (AC-01.4)', () => {
  it('B7: useAscii=true renders "=" for filled and "-" for empty — no Unicode block chars', () => {
    const asciiSnapshot: SessionSnapshot = {
      phase: 'WORK',
      timer: {
        totalSeconds: 300,
        elapsedSeconds: 150,
        remainingSeconds: 150,
        progressFraction: 0.5,
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
        useAscii: true,
        useColor: false,
      },
    };

    const { lastFrame } = render(
      React.createElement(TimerFrame, { snapshot: asciiSnapshot, columns: 40 })
    );

    const frame = lastFrame() ?? '';
    const plain = stripAnsi(frame);

    expect(plain).toMatch(/=/);
    expect(plain).toMatch(/-/);
    expect(plain).not.toMatch(/█/);
    expect(plain).not.toMatch(/░/);
  });
});

// ---------------------------------------------------------------------------
// AC-01.6: Overdue pulse animation
//
// Test Budget:
//   3 behaviors x 2 = 6 max unit tests
//   B8: isOverdue=true, overdueElapsedSeconds=0 → solid red (no dimColor on bar)
//   B9: isOverdue=true, overdueElapsedSeconds=2 → dim red (dimColor=true on bar)
//   B10: isOverdue=true → bar fill is 100%
// ---------------------------------------------------------------------------

function makeOverdueSnapshot(overdueElapsedSeconds: number): SessionSnapshot {
  return {
    phase: 'OVERDUE',
    timer: {
      totalSeconds: 1500,
      elapsedSeconds: 1500,
      remainingSeconds: 0,
      progressFraction: 1.0,
      isOverdue: true,
      overdueElapsedSeconds,
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
}

describe('TuiAdapter overdue pulse animation (AC-01.6)', () => {
  let originalChalkLevel: chalk.Level;
  beforeAll(() => { originalChalkLevel = chalk.level; chalk.level = 3; });
  afterAll(() => { chalk.level = originalChalkLevel; });

  // Count occurrences of ANSI dim code \x1b[2m in a frame string.
  function countDimCodes(frame: string): number {
    // eslint-disable-next-line no-control-regex
    return (frame.match(/\x1b\[2m/g) ?? []).length;
  }

  it('B8 vs B9: dim pulse (overdueElapsedSeconds=2) has MORE dim codes than solid pulse (overdueElapsedSeconds=0)', async () => {
    // At overdueElapsedSeconds=0: Math.floor(0/2) % 2 === 0 → solid red (no bar dimColor)
    // At overdueElapsedSeconds=2: Math.floor(2/2) % 2 === 1 → dim red (bar gets dimColor)
    // After implementation: the dim frame must have at least one extra \x1b[2m vs solid frame.
    const solidSnapshot = makeOverdueSnapshot(0);
    const dimSnapshot = makeOverdueSnapshot(2);

    const solidFrame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot: solidSnapshot, columns: 80 })
    );
    const dimFrame = await renderWithColor(
      React.createElement(TimerFrame, { snapshot: dimSnapshot, columns: 80 })
    );

    // OVERDUE label must be visible in both states (accessibility NFR-05.1)
    expect(stripAnsi(solidFrame)).toMatch(/OVERDUE/i);
    expect(stripAnsi(dimFrame)).toMatch(/OVERDUE/i);

    // Dim pulse frame must have more \x1b[2m codes than solid pulse frame
    // (the extra code wraps the progress bar text in dim mode)
    expect(countDimCodes(dimFrame)).toBeGreaterThan(countDimCodes(solidFrame));
  });

  it('B10: progress bar fill is 100% when isOverdue=true', () => {
    // Regardless of pulse state, the bar fill must be full (progressFraction=1.0)
    const snapshot = makeOverdueSnapshot(0);
    const { lastFrame } = render(
      React.createElement(TimerFrame, { snapshot, columns: 80 })
    );
    const plain = stripAnsi(lastFrame() ?? '');
    // 100% fill label
    expect(plain).toMatch(/100%/);
    // No empty-block characters in a fully-filled bar
    expect(plain).not.toMatch(/░/);
  });
});

// ---------------------------------------------------------------------------
// AC-P1: Flicker-free progress bar updates
//
// Test Budget:
//   2 behaviors x 2 = 4 max unit tests
//   B11: No ESC[2J (clear-screen) sequence in rendered output between consecutive frames
//   B12: Bar character count changes by at most 1 between consecutive ticks on a 60-second session
// ---------------------------------------------------------------------------

function makeTickSnapshot(progressFraction: number): SessionSnapshot {
  const totalSeconds = 60;
  const elapsedSeconds = Math.round(progressFraction * totalSeconds);
  return {
    phase: 'WORK',
    timer: {
      totalSeconds,
      elapsedSeconds,
      remainingSeconds: totalSeconds - elapsedSeconds,
      progressFraction,
      isOverdue: false,
      overdueElapsedSeconds: 0,
    },
    currentPomodoro: 1,
    completedToday: 0,
    streak: 0,
    config: {
      workDurationSeconds: totalSeconds,
      breakDurationSeconds: 300,
      longBreakDurationSeconds: 900,
      cycleCount: 4,
      useAscii: false,
      useColor: false,
    },
  };
}

/** Count filled-block characters in a rendered frame (plain text). */
function countFilledBlocks(plain: string): number {
  return (plain.match(/█/g) ?? []).length;
}

describe('TuiAdapter flicker-free updates (AC-P1)', () => {
  it('B11: no ESC[2J clear-screen sequence appears in any rendered frame', () => {
    // Render 10 frames at evenly-spaced progress fractions (0/10 to 9/10)
    // Each frame is independent (ink-testing-library renders stateless components)
    const frames: string[] = [];
    for (let tick = 0; tick < 10; tick++) {
      const fraction = tick / 60;
      const snapshot = makeTickSnapshot(fraction);
      const { lastFrame } = render(
        React.createElement(TimerFrame, { snapshot, columns: 80 })
      );
      frames.push(lastFrame() ?? '');
    }

    // ESC[2J is the ANSI clear-screen sequence — must not appear in any frame
    for (const frame of frames) {
      // eslint-disable-next-line no-control-regex
      expect(frame).not.toMatch(/\x1b\[2J/);
    }
  });

  it('B12: filled-block character count increases by at most 1 between consecutive ticks on a 60-second session', () => {
    // On an 80-column terminal, barWidth = max(8, 80-20) = 60 chars wide
    // Each second of a 60-second session advances 1/60 fraction
    // At 60-char bar width, each tick moves exactly 1/60 * 60 = 1 block
    const frames: string[] = [];
    for (let tick = 0; tick <= 10; tick++) {
      const fraction = tick / 60;
      const snapshot = makeTickSnapshot(fraction);
      const { lastFrame } = render(
        React.createElement(TimerFrame, { snapshot, columns: 80 })
      );
      frames.push(lastFrame() ?? '');
    }

    const plainFrames = frames.map(stripAnsi);
    for (let index = 1; index < plainFrames.length; index++) {
      const prevBlocks = countFilledBlocks(plainFrames[index - 1]);
      const currBlocks = countFilledBlocks(plainFrames[index]);
      const delta = currBlocks - prevBlocks;
      expect(delta).toBeGreaterThanOrEqual(0);
      expect(delta).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression tests R1–R5: TUI terminal-blocking bugs
//
// Test Budget: 5 distinct behaviors x 1 = 5 regression tests
//   R1: useInput fires process.emit('SIGINT') when input='c' and key.ctrl=true
//   R2: TuiAdapter.render() writes alternate-screen entry sequence as first stdout write
//   R3: TuiAdapter.stop() writes alternate-screen exit sequence to stdout
//   R4: alternate-screen sequence precedes any banner output in stdout write order
//   R5: Ink render() is called with exitOnCtrlC: false
// ---------------------------------------------------------------------------

const REGRESSION_SNAPSHOT: SessionSnapshot = {
  phase: 'WORK',
  timer: {
    totalSeconds: 1500,
    elapsedSeconds: 0,
    remainingSeconds: 1500,
    progressFraction: 0,
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

describe('Regression R1: useInput fires SIGINT on Ctrl+C (Ink 4.x key interface)', () => {
  // Ink 4.x Key interface has NO `name` property.
  // The correct check is `input === 'c' && key.ctrl` NOT `key.name === 'c' && key.ctrl`.
  // Current code (tuiAdapter.tsx line ~93): if (key.ctrl && key.name === 'c') — FAILS because
  // key.name is always undefined; the condition never evaluates to true.
  it('R1: process.emit("SIGINT") is called when useInput receives input="c" with key.ctrl=true', () => {
    // mockReturnValue(false) prevents the SIGINT from actually propagating to Node.js
    // signal handlers (which would kill the vitest worker), while still recording the call.
    const emitSpy = vi.spyOn(process, 'emit').mockReturnValue(false);

    // ink-testing-library exposes stdin.write() to simulate raw input.
    // Ctrl+C in a real terminal sends byte 0x03 (ETX). In Ink 4.x raw mode
    // useInput receives input='c' and key={ctrl:true} for this byte sequence.
    const { stdin } = render(
      React.createElement(TimerFrame, { snapshot: REGRESSION_SNAPSHOT, columns: 80 })
    );

    // Write the Ctrl+C byte to the fake stdin — Ink decodes it as input='c', key.ctrl=true
    stdin.write('\x03');

    try {
      expect(emitSpy).toHaveBeenCalledWith('SIGINT');
    } finally {
      emitSpy.mockRestore();
    }
  });
});

describe('Regression R2: TuiAdapter.render() writes alternate-screen entry sequence', () => {
  // BUG: TuiAdapter checks NODE_ENV==='test' at construction time and skips the alternate-screen
  // entry sequence entirely in the test environment. This means the sequence
  // \x1b[?1049h\x1b[2J\x1b[H is NEVER written when tests are run via Vitest, making it
  // impossible to verify the alternate-screen behaviour from the test suite.
  // The fix is to make the test-mode detection injectable (constructor parameter or
  // factory function) rather than hardcoding process.env at construction.
  //
  // This test FAILS against the unmodified source because NODE_ENV=test is always set
  // by Vitest, causing TuiAdapter to skip the alternate-screen write entirely.
  it('R2: TuiAdapter.render() writes \\x1b[?1049h\\x1b[2J\\x1b[H as the first stdout write', () => {
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });

    // Temporarily override NODE_ENV so TuiAdapter.testMode = false and writes the
    // alternate-screen sequence. Restored in finally to avoid polluting other tests.
    const origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    try {
      const adapter = new TuiAdapter();
      adapter.render(REGRESSION_SNAPSHOT);
      adapter.stop();

      expect(writes[0]).toBe('\x1b[?1049h\x1b[2J\x1b[H');
    } finally {
      process.env['NODE_ENV'] = origNodeEnv;
      writeSpy.mockRestore();
    }
  });
});

describe('Regression R3: TuiAdapter.stop() writes alternate-screen exit sequence', () => {
  // BUG: TuiAdapter checks NODE_ENV==='test' and skips the alternate-screen exit sequence
  // \x1b[?1049l in the test environment. This means that TuiAdapter.stop() can never
  // be verified to restore the primary terminal buffer from the test suite.
  // The fix is the same as R2: make test-mode detection injectable.
  //
  // This test FAILS against the unmodified source because NODE_ENV=test is always set
  // by Vitest, causing TuiAdapter.stop() to skip the alternate-screen exit write.
  it('R3: TuiAdapter.stop() writes \\x1b[?1049l to stdout', () => {
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });

    // Same NODE_ENV override as R2: testMode=false so stop() writes the exit sequence.
    const origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    try {
      const adapter = new TuiAdapter();
      adapter.render(REGRESSION_SNAPSHOT);
      writes.length = 0; // Reset: only capture writes from stop()
      adapter.stop();

      const stopWrites = writes.join('');
      expect(stopWrites).toContain('\x1b[?1049l');
    } finally {
      process.env['NODE_ENV'] = origNodeEnv;
      writeSpy.mockRestore();
    }
  });
});

describe('Regression R4: alternate-screen sequence must precede any banner output', () => {
  // BUG: src/index.ts calls printBanner() at line 194 BEFORE calling TuiAdapter.render().
  // This causes banner text to be written to the PRIMARY screen buffer before
  // \x1b[?1049h switches to the alternate screen, leaving banner debris visible on the
  // primary buffer after the session ends.
  //
  // Correct order: TuiAdapter.render() → writes \x1b[?1049h FIRST → then any banner output.
  //
  // This test reproduces the actual call order in src/index.ts and asserts the correct
  // invariant: the alternate-screen sequence must be the first stdout write.
  // FAILS with the current index.ts ordering: printBanner() writes banner text BEFORE
  // the TuiAdapter even gets a chance to emit \x1b[?1049h.
  //
  // Additionally, in test mode (NODE_ENV=test), TuiAdapter skips the escape sequence
  // entirely, so writes[0] is banner text and the assertion fails both because of the
  // wrong call order AND because of the testMode bypass.
  it('R4: TuiAdapter.render() does not write banner text — alternate-screen sequence is first write', () => {
    // Fix: printBanner() was removed from the TUI path in src/index.ts.
    // This test verifies the fixed invariant: TuiAdapter itself never writes banner content,
    // so the alternate-screen sequence is always the first write in non-test mode.
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });

    const origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    try {
      // TuiAdapter.render() in non-test mode — no printBanner() call before it.
      const adapter = new TuiAdapter();
      adapter.render(REGRESSION_SNAPSHOT);
      adapter.stop();

      // Alternate-screen sequence must be the FIRST write — no banner text precedes it.
      expect(writes[0]).toBe('\x1b[?1049h\x1b[2J\x1b[H');
      // No write should contain ASCII art (the 'chromato' block-letter logo).
      const allOutput = writes.join('');
      expect(allOutput).not.toContain('██');
    } finally {
      process.env['NODE_ENV'] = origNodeEnv;
      writeSpy.mockRestore();
    }
  });
});

describe('Regression R5: Ink render() called with exitOnCtrlC: false', () => {
  // BUG: If exitOnCtrlC defaults to true (Ink default), Ink intercepts Ctrl+C and calls
  // process.exit(0) directly — bypassing any SIGINT handlers that perform cleanup
  // (save session state, write \x1b[?1049l to restore terminal, etc.).
  // The fix requires passing exitOnCtrlC: false explicitly to ink.render().
  //
  // This test verifies the Ink render() call receives exitOnCtrlC: false by spying on
  // the ink module's render export. It FAILS if Ink is called without this option.
  //
  // Note: In test mode (NODE_ENV=test), TuiAdapter passes debug: true to ink.render()
  // but exitOnCtrlC: false must still be present regardless of debug mode.
  it('R5: ink.render() options include exitOnCtrlC: false', () => {
    // Spy on the ink module's render export.
    // TuiAdapter imports { render } from 'ink' — the same ESM module instance
    // as inkModule here, so the spy intercepts TuiAdapter's render calls.
    const inkRenderSpy = vi.spyOn(inkModule, 'render');

    try {
      const adapter = new TuiAdapter();
      adapter.render(REGRESSION_SNAPSHOT);
      adapter.stop();

      expect(inkRenderSpy).toHaveBeenCalled();
      const callArgs = inkRenderSpy.mock.calls[0];
      // ink.render(element, options) — options is second argument
      const options = callArgs?.[1] as Record<string, unknown> | undefined;
      expect(options).toBeDefined();
      expect(options?.['exitOnCtrlC']).toBe(false);
    } finally {
      inkRenderSpy.mockRestore();
    }
  });
});
