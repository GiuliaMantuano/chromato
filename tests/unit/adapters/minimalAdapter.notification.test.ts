/**
 * MinimalAdapter NotificationPort twins — in-terminal-notifications slice-05
 * (DELIVER step 06-01).
 *
 * Feature ID : in-terminal-notifications
 * Wave       : DELIVER (step 06-01) | Date: 2026-07-05
 * Traceability: US-05 (AC-05.1 TTY half, AC-05.2), [D8], [D9], DDD-5,
 *               moment-priority pin ([D-DISTILL-1] minimal half, AC-01.6)
 *
 * The one TTY-only concern from the DISTILL feature file (AC-05.1: the
 * persistent line interleaving with the \r live-timer overwrite without
 * corruption) is unobservable through a piped subprocess — this is its
 * vitest twin (isTTY stub), same harness convention as
 * bellNotificationAdapter.test.ts / windowTitleAdapter.test.ts.
 *
 * TEST PARADIGM: property-viable — for ANY moment sequence, every persistent
 * line remains intact in the output (never overwritten by a later \r frame)
 * and piped output never contains a bell or ESC byte. fast-check is not a
 * project dependency (established precedent — windowTitle.test.ts /
 * notificationMode.test.ts): the sequence space is enumerated as a
 * representative table of moment/render interleavings standing in for the
 * fast-check arbitrary — a genuine property test, not hand-picked examples
 * chasing one code path.
 *
 * Test budget: 4 behaviors (TTY no-corruption interleave / non-TTY byte-clean
 * + resolveCopy wiring fidelity / append-only stacking across any sequence /
 * pre-attach guard) x 2 = 8 max; 5 test blocks written (some parametrized).
 *
 * Port boundary (Mandate 1): MinimalAdapter IS the driven adapter under
 * test; the injected stdout seam is the real infrastructure boundary — the
 * capture asserts the exact bytes the terminal (or pipe) would receive.
 */

import { describe, expect, it } from 'vitest';
import { MinimalAdapter } from '../../../src/adapters/minimalAdapter.js';
import {
  resolveCopy,
  type NotificationCopyNumbers,
  type NotificationMoment,
} from '../../../src/domain/notificationCopy.js';
import { DEFAULT_CONFIG } from '../../../src/domain/config.js';
import { deriveTimerSnapshot } from '../../../src/domain/timer.js';
import type { SessionSnapshot } from '../../../src/domain/types.js';
import type { PomodoroPhase } from '../../../src/domain/phase.js';

/** Captures the exact bytes an interactive (or piped) terminal would receive. */
class CapturingStdout {
  readonly writes: string[] = [];
  constructor(readonly isTTY: boolean) {}
  write(chunk: string): boolean {
    if (typeof chunk !== 'string') {
      throw new Error('MinimalAdapter must write string chunks');
    }
    this.writes.push(chunk);
    return true;
  }
  bytes(): string {
    return this.writes.join('');
  }
}

const NUMBERS: NotificationCopyNumbers = {
  workMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cycleCount: 4,
};

function testSnapshot(phase: PomodoroPhase): SessionSnapshot {
  return {
    phase,
    timer: deriveTimerSnapshot(1500, 750, 0),
    currentPomodoro: 1,
    completedToday: 0,
    streak: 0,
    config: DEFAULT_CONFIG,
  };
}

/** The FULL NotificationPort method universe — every moment the port can carry. */
const MOMENTS: ReadonlyArray<{
  name: string;
  moment: NotificationMoment;
  fire: (a: MinimalAdapter) => void;
}> = [
  {
    name: 'notifyPhaseChange(WORK -> BREAK)',
    moment: { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
    fire: (a) => a.notifyPhaseChange('WORK', 'BREAK'),
  },
  {
    name: 'notifyPhaseChange(BREAK -> WORK)',
    moment: { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
    fire: (a) => a.notifyPhaseChange('BREAK', 'WORK'),
  },
  {
    name: 'notifyPhaseChange(WORK -> LONG_BREAK)',
    moment: { kind: 'PHASE_CHANGE', from: 'WORK', to: 'LONG_BREAK' },
    fire: (a) => a.notifyPhaseChange('WORK', 'LONG_BREAK'),
  },
  {
    name: 'notifyOverdue()',
    moment: { kind: 'OVERDUE' },
    fire: (a) => a.notifyOverdue(),
  },
  {
    name: 'notifySessionComplete(25)',
    moment: { kind: 'SESSION_COMPLETE', focusedMinutes: 25 },
    fire: (a) => a.notifySessionComplete(25),
  },
];

/** Representative moment/render interleavings standing in for the fast-check arbitrary. */
const SEQUENCES: ReadonlyArray<{ label: string; actions: ReadonlyArray<'render' | number> }> = [
  { label: 'render, phase-change, render, render', actions: ['render', 0, 'render', 'render'] },
  {
    label: 'phase-change then session-complete (both stack, DISTILL pin AC-01.6)',
    actions: [0, 4],
  },
  {
    label: 'render, overdue, render, session-complete, render',
    actions: ['render', 3, 'render', 4, 'render'],
  },
  { label: 'three phase-changes in a row (repeated moments never merge)', actions: [0, 1, 2] },
];

function runSequence(adapter: MinimalAdapter, actions: ReadonlyArray<'render' | number>): void {
  for (const action of actions) {
    if (action === 'render') {
      adapter.render(testSnapshot('WORK'));
    } else {
      MOMENTS[action]!.fire(adapter);
    }
  }
}

describe('MinimalAdapter — NotificationPort byte-clean + resolveCopy wiring (DDD-5, [D8])', () => {
  // ── Twins of: "A minimal session announces..." + "Piped output carries..." ─
  it.each(
    MOMENTS,
  )('$name prints the resolveCopy "title — body" line, newline-terminated, zero ANSI, zero BEL (non-TTY)', ({
    moment,
    fire,
  }) => {
    const pipe = new CapturingStdout(false);
    const adapter = new MinimalAdapter(pipe);
    adapter.attachNotificationCopy(NUMBERS);
    fire(adapter);
    const { title, body } = resolveCopy(moment, NUMBERS);
    expect(pipe.bytes()).toBe(`${title} — ${body}\n`);
    expect(pipe.bytes()).not.toContain('\x1b');
    expect(pipe.bytes()).not.toContain('\x07');
  });

  // ── Twin of the TTY-only concern (AC-05.1): interleaving without corruption ─
  it('on a TTY, a persistent line terminates the live \\r timer line with \\n first, then the next render() resumes on the fresh row', () => {
    const tty = new CapturingStdout(true);
    const adapter = new MinimalAdapter(tty);
    adapter.attachNotificationCopy(NUMBERS);

    adapter.render(testSnapshot('WORK')); // live \r timer line, in place
    const beforeNotify = tty.bytes();
    expect(beforeNotify.startsWith('\r')).toBe(true);
    expect(beforeNotify.includes('\n')).toBe(false); // still an in-place, unterminated line

    adapter.notifyPhaseChange('WORK', 'BREAK');
    const { title, body } = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      NUMBERS,
    );
    const afterNotify = tty.bytes();
    // The live line was terminated with \n BEFORE the notification line printed —
    // no corruption: the timer's partial \r line is followed by \n, then the
    // notification line, itself newline-terminated.
    expect(afterNotify).toBe(`${beforeNotify}\n${title} — ${body}\n`);

    adapter.render(testSnapshot('BREAK')); // resumes the timer on the fresh row below
    const lastWrite = tty.writes[tty.writes.length - 1]!;
    expect(lastWrite.startsWith('\r')).toBe(true); // back to overwrite-in-place, not corrupted
  });

  // ── Property: any moment sequence keeps every persistent line intact ───────
  it.each(
    SEQUENCES,
  )('$label: every persistent line stays intact in TTY output, never overwritten by a later \\r frame', ({
    actions,
  }) => {
    const tty = new CapturingStdout(true);
    const adapter = new MinimalAdapter(tty);
    adapter.attachNotificationCopy(NUMBERS);
    runSequence(adapter, actions);

    const bytes = tty.bytes();
    for (const action of actions) {
      if (action === 'render') continue;
      const { title, body } = resolveCopy(MOMENTS[action]!.moment, NUMBERS);
      expect(bytes).toContain(`${title} — ${body}\n`);
    }
  });

  // ── Property: any moment sequence stays byte-clean on a pipe ───────────────
  it.each(SEQUENCES)('$label: piped (non-TTY) output never contains a bell or ESC byte', ({
    actions,
  }) => {
    const pipe = new CapturingStdout(false);
    const adapter = new MinimalAdapter(pipe);
    adapter.attachNotificationCopy(NUMBERS);
    runSequence(adapter, actions);

    const bytes = pipe.bytes();
    expect(bytes).not.toContain('\x07');
    expect(bytes).not.toContain('\x1b');
  });

  // ── Pre-wiring guard: silent no-op until attachNotificationCopy() is called ─
  it('notify methods no-op until attachNotificationCopy() is called (guards wiring order)', () => {
    const pipe = new CapturingStdout(false);
    const adapter = new MinimalAdapter(pipe);
    adapter.notifyPhaseChange('WORK', 'BREAK');
    adapter.notifyOverdue();
    adapter.notifySessionComplete(25);
    expect(pipe.writes).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Step 06-05 — same-drain OVERDUE line suppression (Upstream Issue 3). Once
// notificationCopy.ts's PHASE_CHANGE-to-OVERDUE bug is fixed, BOTH same-drain
// calls (notifyPhaseChange(BREAK|LONG_BREAK -> OVERDUE) + notifyOverdue())
// produce the CORRECT "Break ran over" text — but printing it twice in a row
// is pure noise (unlike the SESSION_COMPLETED pairing, which prints two
// DIFFERENT useful lines by design, [D-DISTILL-1], untouched here). Mirrors
// BellNotificationAdapter's phaseChangedThisDrain check-and-clear pattern,
// consumed ONLY by notifyOverdue() -- notifySessionComplete() does not check
// it, so its double-line behavior is unaffected (verified above, unchanged).
//
// Test budget: 2 behaviors (same-drain suppression / standalone still prints)
// x 2 = 4 max; 2 tests written (one parametrized over BREAK/LONG_BREAK).
// ════════════════════════════════════════════════════════════════════════════

describe('MinimalAdapter — same-drain OVERDUE line suppression (06-05, Upstream Issue 3)', () => {
  it.each([
    'BREAK',
    'LONG_BREAK',
  ] as const)('notifyPhaseChange(%s -> OVERDUE) then a same-drain notifyOverdue() prints only ONE line, not the duplicate', (from) => {
    const pipe = new CapturingStdout(false);
    const adapter = new MinimalAdapter(pipe);
    adapter.attachNotificationCopy(NUMBERS);
    adapter.notifyPhaseChange(from, 'OVERDUE');
    adapter.notifyOverdue();
    const { title, body } = resolveCopy({ kind: 'OVERDUE' }, NUMBERS);
    expect(pipe.bytes()).toBe(`${title} — ${body}\n`);
  });

  it('a standalone notifyOverdue() (no preceding same-drain phase change) still prints its line (60s follow-up reminder)', () => {
    const pipe = new CapturingStdout(false);
    const adapter = new MinimalAdapter(pipe);
    adapter.attachNotificationCopy(NUMBERS);
    adapter.notifyOverdue();
    const { title, body } = resolveCopy({ kind: 'OVERDUE' }, NUMBERS);
    expect(pipe.bytes()).toBe(`${title} — ${body}\n`);
  });
});
