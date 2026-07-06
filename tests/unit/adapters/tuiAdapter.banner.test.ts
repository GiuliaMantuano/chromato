/**
 * Banner lifecycle ink-testing twins — in-terminal-notifications slice-01.
 *
 * Feature ID : in-terminal-notifications
 * Wave       : DELIVER (step 02-02) | Date: 2026-07-05
 * Traceability: US-01 (AC-01.2 pulse cadence, scenario 2 skip supersession,
 *               scenario 3 cycle celebration), [D-DISTILL-4] twin-then-remove.
 *
 * These are the vitest TWINS of the three @ink-testing SPEC_ONLY scenarios that
 * lived in tests/acceptance/in-terminal-notifications/slice-01-banner.feature
 * (removed by this step, each replaced with a pointer comment). They are
 * physically unobservable through a piped cucumber subprocess:
 *   - pulse styling is dim/colour ANSI, invisible in the piped CI capture;
 *   - reaching LONG_BREAK / skipping a break needs a raw-mode S keypress.
 * Harness precedent: inSessionControls.interaction.test.ts (keypress surface +
 * headless SessionService via tickOnce) and tuiAdapter.test.ts (FakeStdout +
 * chalk.level=3 for ANSI assertions; process.stdout spy for TuiAdapter frames).
 *
 * NAMING NOTE: *.test.ts (not .tsx) — vitest.config.ts `include` only matches
 * `tests/unit/**\/*.test.ts`; a .tsx twin would be silently excluded (fake-green
 * trap). All sibling adapter tests follow the same .ts + React.createElement style.
 *
 * TEST PARADIGM: EXEMPT from PBT — single-shot UI flows with exact-copy
 * assertions; the pulse twin is a golden-behavior lock on the SHIPPED cadence.
 * Test budget: 3 scenarios -> 3 tests (budget 2 x 3 = 6).
 *
 * Port boundary (Mandate 1): tests enter through driving surfaces only —
 * SessionService.tickOnce (driving port), the TimerFrame keypress surface wired
 * to the real control port (ADR-017), and the TuiAdapter NotificationPort/
 * RenderPort seam. Domain internals are exercised indirectly.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { render as inkRender } from 'ink';
import chalk from 'chalk';
import { EventEmitter } from 'node:events';
import {
  TimerFrame,
  TuiAdapter,
  type BannerNotification,
} from '../../../src/adapters/tuiAdapter.js';
import { SessionService } from '../../../src/application/sessionService.js';
import { resolveCopy, type NotificationCopyNumbers } from '../../../src/domain/notificationCopy.js';
import type { StatePort, HistoryPort } from '../../../src/domain/ports.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';
import type { SessionConfig } from '../../../src/domain/config.js';

// ── Helpers (style mirrors inSessionControls.interaction + tuiAdapter tests) ──

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

/** Ink registers useInput via useEffect (async); flush effects + a render tick. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * Wait out Ink's non-debug render throttles (rootNode.onRender is throttled at
 * 32ms leading+trailing; the log write is throttled again) so re-rendered
 * TuiAdapter frames reach the spied stdout. 60ms > 32ms trailing window.
 */
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 60));
}

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    workDurationSeconds: 25 * 60,
    breakDurationSeconds: 5 * 60,
    longBreakDurationSeconds: 15 * 60,
    cycleCount: 4,
    useAscii: false,
    useColor: false,
    ...overrides,
  };
}

const NUMBERS: NotificationCopyNumbers = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycleCount: 4,
};

class InMemoryStatePort implements StatePort {
  readonly written: SessionSnapshot[] = [];
  idleWritten = false;
  initialCompletedToday = 0;
  writeState(snapshot: SessionSnapshot): void {
    this.written.push(snapshot);
  }
  writeIdle(): void {
    this.idleWritten = true;
  }
  readState(): SessionSnapshot | null {
    return this.written.at(-1) ?? null;
  }
  readCompletedToday(): number {
    return this.initialCompletedToday;
  }
}

class InMemoryHistoryPort implements HistoryPort {
  readonly recorded: number[] = [];
  recordSession(completedPomodoros: number): void {
    this.recorded.push(completedPomodoros);
  }
  readTodayCount(): number {
    return this.recorded.length;
  }
  readStreak(): number {
    return 0;
  }
}

/** Capture process.stdout writes (TuiAdapter debug frames in NODE_ENV=test). */
function captureStdout(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    writes.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  });
  return { writes, restore: () => spy.mockRestore() };
}

/** The most recent full TuiAdapter debug frame among captured writes. */
function lastTimerFrame(writes: string[]): string {
  const frames = writes.filter((w) => stripAnsi(w).includes('POMODORO'));
  return frames.at(-1) ?? '';
}

// FakeStdout + chalk.level pattern from tuiAdapter.test.ts: ink-testing-library
// strips colour, so ANSI dim assertions need a real Ink instance on a fake stream.
class FakeStdout extends EventEmitter {
  readonly columns = 80;
  private _lastFrame = '';
  write(frame: string): void {
    this._lastFrame = frame;
  }
  lastFrame(): string {
    return this._lastFrame;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Twin 1 of: "The banner pulses at the shipped overdue cadence" (AC-01.2)
// ════════════════════════════════════════════════════════════════════════════

describe('AC-01.2 — the banner pulses at the shipped OVERDUE cadence (twin)', () => {
  let originalChalkLevel: typeof chalk.level;
  beforeAll(() => {
    originalChalkLevel = chalk.level;
    chalk.level = 3;
  });
  afterAll(() => {
    chalk.level = originalChalkLevel;
  });

  /** True when the rendered banner copy line carries the ANSI dim code \x1b[2m. */
  function bannerLineIsDim(rawFrame: string, copyText: string): boolean {
    const rawLine = rawFrame.split('\n').find((line) => stripAnsi(line).includes(copyText));
    // eslint-disable-next-line no-control-regex
    return rawLine !== undefined && /\x1b\[2m/.test(rawLine);
  }

  it('banner alternates normal/dim over four seconds of ticks at the shipped 2s rhythm', async () => {
    // Given the phase-change banner is visible in a running session (BREAK frame,
    // colour on so the dim pulse is expressed as ANSI).
    const snapshot: SessionSnapshot = {
      phase: 'BREAK',
      timer: {
        totalSeconds: 300,
        elapsedSeconds: 10,
        remainingSeconds: 290,
        progressFraction: 10 / 300,
        isOverdue: false,
        overdueElapsedSeconds: 0,
      },
      currentPomodoro: 1,
      completedToday: 1,
      streak: 0,
      config: makeConfig({ useColor: true }),
    };
    // Fake ONLY Date (Ink keeps its real timers/setImmediate).
    vi.useFakeTimers({ toFake: ['Date'] });
    const shownAtMs = Date.now();
    const notification: BannerNotification = {
      copy: resolveCopy({ kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' }, NUMBERS),
      phase: 'BREAK',
      shownAtMs,
    };
    const stdout = new FakeStdout();
    const frameAt = () => React.createElement(TimerFrame, { snapshot, columns: 80, notification });
    const instance = inkRender(frameAt(), {
      // biome-ignore lint/suspicious/noExplicitAny: test double — Ink accepts any writable stream-like object.
      stdout: stdout as any,
      debug: false,
      exitOnCtrlC: false,
      patchConsole: false,
    });
    const dimStates: boolean[] = [];
    try {
      // When the next four seconds of ticks render (re-render per 1s tick).
      for (const secondsSinceShown of [0, 1, 2, 3, 4]) {
        vi.setSystemTime(shownAtMs + secondsSinceShown * 1000);
        instance.rerender(frameAt());
        await flush();
        dimStates.push(bannerLineIsDim(stdout.lastFrame(), 'Time for a 5-minute break.'));
      }
    } finally {
      instance.unmount();
      vi.useRealTimers();
    }
    // Then the banner alternates normal/dim at the SAME cadence as the shipped
    // OVERDUE pulse — dim on the odd 2-second interval (floor(dt/2) % 2 === 1).
    // Golden-behavior lock on the shipped isOverdueDimPulse rhythm.
    expect(dimStates).toEqual([false, false, true, true, false]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Twin 2 of: "Completing the final pomodoro celebrates the cycle" (US-01 sc.3)
// ════════════════════════════════════════════════════════════════════════════

describe('US-01 — completing the final pomodoro celebrates the cycle (twin)', () => {
  it('final work block of a 2-pomodoro cycle shows "2 pomodoros done" naming the long break length', async () => {
    const { writes, restore } = captureStdout();
    // NODE_ENV override (R2/R3 precedent in tuiAdapter.test.ts): testMode would
    // auto-stop the Ink instance on setImmediate BEFORE React commits the
    // re-rendered banner frame — production mode keeps the instance alive so the
    // per-tick frames reach the (spied) stdout.
    const origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    const tui = new TuiAdapter();
    try {
      // Production composition (ADR-017 / slice-01): TuiAdapter is BOTH the
      // render port and the NotificationPort; copy numbers injected as the
      // composition root does (copyNumbersFrom equivalent for a 2-cycle config).
      tui.attachNotificationCopy({ ...NUMBERS, cycleCount: 2 });
      const statePort = new InMemoryStatePort();
      statePort.initialCompletedToday = 1; // her first pomodoro of the 2-cycle is done
      const service = new SessionService(tui, statePort, tui, new InMemoryHistoryPort());
      tui.attachControl(service);
      const config = makeConfig({ cycleCount: 2, workDurationSeconds: 2 });

      // Given a running session on its final work block of a 2-pomodoro cycle
      service.tickOnce(config, 0); // IDLE -> WORK (the 2nd and final block)
      await settle();
      // When the final work block ends
      service.tickOnce(config, 2); // WORK completes -> 2 % 2 === 0 -> LONG_BREAK
      await settle();

      // Then the in-frame banner shows the cycle celebration copy and names the
      // long break length (D3 copy: "Take a proper 15-minute break.").
      const frame = stripAnsi(lastTimerFrame(writes));
      expect(frame).toContain('2 pomodoros done');
      expect(frame).toContain('15-minute');
      expect(stripAnsi(lastTimerFrame(writes))).toContain('LONG BREAK'); // celebration fires on the LONG_BREAK frame
    } finally {
      tui.stop();
      process.env['NODE_ENV'] = origNodeEnv;
      restore();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Twin 3 of: "Skipping the break replaces the break banner immediately" (US-01 sc.2)
// ════════════════════════════════════════════════════════════════════════════

describe('US-01 — skipping the break replaces the break banner immediately (twin)', () => {
  it('pressing S during a break supersedes the break-start banner with "Break’s over" (at most one banner)', async () => {
    const { writes, restore } = captureStdout();
    // Same NODE_ENV override as twin 2 (R2/R3 precedent): keep the TuiAdapter's
    // Ink instance alive across ticks so the banner frames are observable.
    const origNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    const tui = new TuiAdapter();
    let keypressSurface: ReturnType<typeof render> | null = null;
    try {
      tui.attachNotificationCopy(NUMBERS);
      const service = new SessionService(
        tui,
        new InMemoryStatePort(),
        tui,
        new InMemoryHistoryPort(),
      );
      tui.attachControl(service);
      const config = makeConfig({ workDurationSeconds: 2, breakDurationSeconds: 300 });

      // Given the break-start banner is still visible in a running session
      service.tickOnce(config, 0); // IDLE -> WORK
      await settle();
      service.tickOnce(config, 2); // WORK -> BREAK: "Pomodoro complete 🍅" banner
      await settle();
      expect(stripAnsi(lastTimerFrame(writes))).toContain('Pomodoro complete');

      // When the user presses S to skip the break — the REAL keypress surface
      // (TimerFrame useInput) routed to the REAL control port (ADR-017), the
      // walking-skeleton production path from inSessionControls.interaction.
      keypressSurface = render(
        React.createElement(TimerFrame, {
          snapshot: service.getSnapshot()!,
          columns: 80,
          control: service,
        }),
      );
      await flush();
      writes.length = 0; // observe only the post-keypress TuiAdapter frames
      keypressSurface.stdin.write('s');
      await settle();

      // Then the in-frame banner shows the warm copy "Break’s over"…
      const frame = stripAnsi(lastTimerFrame(writes));
      expect(frame).toContain('Break’s over');
      // …the superseded break-start banner is gone, and at most ONE banner is
      // visible (the single-slot invariant: the new title exactly once).
      expect(frame).not.toContain('Pomodoro complete');
      expect(frame.match(/Break’s over/g) ?? []).toHaveLength(1);
      expect(service.getSnapshot()!.phase).toBe('WORK');
    } finally {
      keypressSurface?.unmount();
      tui.stop();
      process.env['NODE_ENV'] = origNodeEnv;
      restore();
    }
  });
});
