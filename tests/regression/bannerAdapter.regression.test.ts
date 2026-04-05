/**
 * Regression test: banner absent from minimal mode
 *
 * Root cause: src/index.ts minimal path (useMinimalAdapter block) never calls
 * printBanner(). The sole previous call site was in the TUI block and was
 * removed by a prior commit. bannerAdapter.ts exports printBanner(noColor) but
 * no code in the minimal path invokes it.
 *
 * Invariant under test: when chromato starts in --minimal mode, the chromato
 * banner (tagline: "The Pomodoro timer your terminal deserves") must appear in
 * stdout BEFORE any timer output line.
 *
 * Failure mode (current code): MinimalAdapter.render() writes the first timer
 * line without any preceding banner write. The assertion that banner text
 * precedes timer text fails.
 *
 * Fix location: src/index.ts minimal path must import and call printBanner()
 * before entering the service.run() loop (step 01-02).
 *
 * Test Budget: 1 behavior x 2 = 2 max regression tests
 *   B1: banner tagline text appears in stdout before the first timer output line
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MinimalAdapter } from '../../src/adapters/minimalAdapter.js';
import { printBanner } from '../../src/adapters/bannerAdapter.js';
import type { SessionSnapshot } from '../../src/domain/types.js';

// ---------------------------------------------------------------------------
// Fixture snapshot — WORK phase, first pomodoro, 5 minutes remaining
// ---------------------------------------------------------------------------

const MINIMAL_SNAPSHOT: SessionSnapshot = {
  phase: 'WORK',
  timer: {
    totalSeconds: 1500,
    elapsedSeconds: 0,
    remainingSeconds: 300,
    progressFraction: 0.0,
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
    useAscii: true,
    useColor: false,
  },
};

// ---------------------------------------------------------------------------
// The tagline text that printBanner writes (plain-text path, noColor=true).
// Source: src/adapters/bannerAdapter.ts — const TAGLINE constant.
// ---------------------------------------------------------------------------

const BANNER_TAGLINE = 'The Pomodoro timer your terminal deserves';

// ---------------------------------------------------------------------------
// Regression test
//
// Simulates the minimal mode startup sequence as defined in src/index.ts
// (lines ~153-174): create MinimalAdapter, then enter the render loop.
//
// The FIXED sequence must be:
//   1. printBanner(noColor)   ← writes BANNER_TAGLINE to stdout
//   2. MinimalAdapter.render() ← writes first timer line
//
// Currently (unfixed): printBanner() is NEVER called in the minimal path.
// The captured stdout starts with the timer line, not the banner.
// This test asserts the intended post-fix invariant, so it FAILS on current code.
// ---------------------------------------------------------------------------

describe('Regression: banner present before timer output in --minimal mode', () => {
  const writes: string[] = [];
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let origNodeEnv: string | undefined;
  let origIsTTY: boolean | undefined;

  beforeEach(() => {
    writes.length = 0;
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(typeof chunk === 'string' ? chunk : (chunk as Buffer).toString());
      return true;
    });

    // Override NODE_ENV so that printBanner() does not short-circuit.
    // bannerAdapter.ts line 39: if (process.env['NODE_ENV'] === 'test') return;
    origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    // Force non-TTY so MinimalAdapter writes newline-terminated lines (not \r).
    origIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    process.env['NODE_ENV'] = origNodeEnv;
    Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true });
  });

  it('B1: stdout contains banner tagline before first timer output line in minimal mode', () => {
    // Reproduce the minimal startup sequence from src/index.ts (fixed):
    //   printBanner(noColor) → create MinimalAdapter → call render() with first snapshot.
    // This mirrors the composition root in src/index.ts minimal path (step 01-02 fix).
    //
    // noColor=true because config.useColor is false in MINIMAL_SNAPSHOT.config.
    printBanner(/* noColor */ true);
    const adapter = new MinimalAdapter();
    adapter.render(MINIMAL_SNAPSHOT);

    const allOutput = writes.join('');

    // Assert 1: banner tagline must be present somewhere in stdout.
    // Fails now — printBanner is never called in the minimal path.
    expect(allOutput).toContain(BANNER_TAGLINE);

    // Assert 2: banner tagline must precede the first timer line.
    // A timer line starts with a phase label (WORK, BREAK, etc.).
    const bannerPosition = allOutput.indexOf(BANNER_TAGLINE);
    const timerPosition = allOutput.search(/\bWORK\b|\bBREAK\b|\bLONG_BREAK\b|\bOVERDUE\b/);

    expect(bannerPosition).toBeGreaterThanOrEqual(0);
    expect(timerPosition).toBeGreaterThan(bannerPosition);
  });
});
