/**
 * BellNotificationAdapter @tty-sim twins — in-terminal-notifications slice-02.
 *
 * Feature ID : in-terminal-notifications
 * Wave       : DELIVER (step 02-03) | Date: 2026-07-05
 * Traceability: US-02 (AC-02.1, AC-02.2, AC-02.3, AC-02.5), [D8], M8-08, DDD-3
 *
 * Vitest TWINS of the five @tty-sim SPEC_ONLY scenarios removed from
 * tests/acceptance/in-terminal-notifications/slice-02-bell.feature by this step
 * (pointer comments left in place). TTY-POSITIVE bell emission is physically
 * unobservable through a piped cucumber subprocess ([D8] correctly suppresses
 * it) — the isTTY stub below is the simulated terminal.
 *
 * TEST PARADIGM (TS adaptation of the PBT mandate): the [D8]/AC-02.1 contract
 * is a property — for ANY port method and ANY moment, non-TTY emits ZERO bytes
 * and TTY emits EXACTLY one \x07. fast-check is not a project dependency, so
 * the full method universe (all 3 NotificationPort methods) is enumerated as a
 * parametrized test table — total coverage of the input space, zero new deps.
 * Exact-byte assertions (\x07 identity, no companion bytes) are exact-byte
 * contract locks (EXEMPT category).
 *
 * Test budget: 7 behaviors (TTY rings once / non-TTY silent / same-drain
 * collision suppressed / standalone call after flag-consumed still rings /
 * full session sequence = 2 bells not 4 / NO_COLOR independence / bare
 * control byte) x 2 = 14 max; 7 written.
 *
 * 06-04 fix: session.ts transitionPhase() pushes PHASE_CHANGED together with
 * a SECOND event on every WORK→rest transition (+SESSION_COMPLETED) and every
 * rest→OVERDUE transition (+OVERDUE_ACTIVATED) — SessionService.processEvents()
 * drains both as back-to-back synchronous calls on this adapter. The old
 * "never doubles a bell" test below called all 4 moments independently and
 * sequentially, which is NOT how a real drain shapes the calls; it never
 * caught the double-ring bug. Rewritten to simulate the real paired-call
 * shape per moment (see "phase-change wins" and "full WORK→BREAK→OVERDUE
 * session" tests).
 *
 * Port boundary (Mandate 1): BellNotificationAdapter IS the driven adapter
 * under test; the injected stdout seam is the real infrastructure boundary —
 * the capture asserts the exact bytes the terminal would receive.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BellNotificationAdapter } from '../../../src/adapters/bellNotificationAdapter.js';

const BEL = '\x07';

/** Captures the exact bytes an interactive (or piped) terminal would receive. */
class CapturingStdout {
  readonly writes: string[] = [];
  constructor(readonly isTTY: boolean) {}
  write(chunk: string): boolean {
    if (typeof chunk !== 'string') {
      throw new Error('BellNotificationAdapter must write string chunks');
    }
    this.writes.push(chunk);
    return true;
  }
  bytes(): string {
    return this.writes.join('');
  }
}

/** The FULL NotificationPort method universe — every moment the port can carry. */
const MOMENTS: ReadonlyArray<{ name: string; fire: (a: BellNotificationAdapter) => void }> = [
  {
    name: 'notifyPhaseChange (work block ends)',
    fire: (a) => a.notifyPhaseChange('WORK', 'BREAK'),
  },
  { name: 'notifyOverdue (break runs over)', fire: (a) => a.notifyOverdue() },
  { name: 'notifySessionComplete', fire: (a) => a.notifySessionComplete(50) },
];

describe('BellNotificationAdapter — TTY-gated single BEL (DDD-3)', () => {
  // ── Twin of: "A phase end rings once" + "Overdue reminders ring too" ──────
  // AC-02.1 property over the full moment universe: on an interactive terminal
  // EVERY notification moment emits exactly one bell — and nothing more.
  it.each(MOMENTS)('$name emits exactly one BEL on an interactive terminal', ({ fire }) => {
    const tty = new CapturingStdout(true);
    fire(new BellNotificationAdapter(tty));
    expect(tty.bytes()).toBe(BEL); // exactly one \x07 — no second bell for the same moment
  });

  // ── [D8] invariant half of the property: piped output stays byte-clean ────
  // Not a scenario twin (the @real-io cucumber scenario covers the subprocess
  // truth) — this is the unit half: non-TTY emits ZERO bytes for ANY moment.
  it.each(MOMENTS)('$name emits nothing when stdout is not a TTY ([D8])', ({ fire }) => {
    const pipe = new CapturingStdout(false);
    fire(new BellNotificationAdapter(pipe));
    expect(pipe.bytes()).toBe('');
    expect(pipe.writes).toHaveLength(0);
  });

  // ── Twin of: "Never more than one bell for one moment" (AC-02.5 / M8-08) ──
  // 06-04: session.ts transitionPhase() pushes PHASE_CHANGED plus a SECOND
  // event into the SAME drain on every WORK→rest and every rest→OVERDUE
  // transition. SessionService.processEvents() fires both as back-to-back
  // synchronous calls for what the user experiences as ONE moment.
  const SAME_DRAIN_COLLISIONS: ReadonlyArray<{
    name: string;
    second: (a: BellNotificationAdapter) => void;
  }> = [
    {
      name: 'SESSION_COMPLETED (WORK→rest transition)',
      second: (a) => a.notifySessionComplete(25),
    },
    { name: 'OVERDUE_ACTIVATED (rest→OVERDUE transition)', second: (a) => a.notifyOverdue() },
  ];

  it.each(
    SAME_DRAIN_COLLISIONS,
  )('phase-change wins: same-drain $name right after notifyPhaseChange rings only once', ({
    second,
  }) => {
    const tty = new CapturingStdout(true);
    const adapter = new BellNotificationAdapter(tty);
    adapter.notifyPhaseChange('WORK', 'BREAK'); // fires first in the real event batch
    second(adapter); // same synchronous drain, same real-world moment
    expect(tty.writes).toEqual([BEL]); // one bell for the whole moment, not two
  });

  it('a same-drain collision consumes the flag — a later standalone notifyOverdue() still rings', () => {
    // The 60-second overdue follow-up reminder (AC-02.1) fires much later,
    // with no accompanying phase change, and must NOT be swallowed by a
    // flag left over from an earlier, unrelated drain.
    const tty = new CapturingStdout(true);
    const adapter = new BellNotificationAdapter(tty);

    adapter.notifyPhaseChange('BREAK', 'OVERDUE'); // rest→OVERDUE transition
    adapter.notifyOverdue(); // same-drain OVERDUE_ACTIVATED — suppressed
    expect(tty.writes).toEqual([BEL]); // 1 bell for the transition moment

    adapter.notifyOverdue(); // genuinely standalone, later — the 60s reminder
    expect(tty.writes).toEqual([BEL, BEL]); // rings again — not incorrectly suppressed
  });

  it('a full WORK→BREAK→OVERDUE session drain produces exactly 2 BELs, not 4', () => {
    // Mirrors SessionService.processEvents() draining session.ts's real event
    // batches: WORK ending pushes PHASE_CHANGED+SESSION_COMPLETED together;
    // BREAK timing out pushes PHASE_CHANGED(to OVERDUE)+OVERDUE_ACTIVATED
    // together. Two user-experienced moments must yield exactly two bells.
    const tty = new CapturingStdout(true);
    const adapter = new BellNotificationAdapter(tty);

    adapter.notifyPhaseChange('WORK', 'BREAK');
    adapter.notifySessionComplete(25);

    adapter.notifyPhaseChange('BREAK', 'OVERDUE');
    adapter.notifyOverdue();

    expect(tty.writes).toEqual([BEL, BEL]);
  });

  // ── Twin of: "The ding survives colour suppression" (AC-02.3 / SC-3) ──────
  describe('with NO_COLOR set', () => {
    let origNoColor: string | undefined;
    beforeEach(() => {
      origNoColor = process.env['NO_COLOR'];
      process.env['NO_COLOR'] = '1';
    });
    afterEach(() => {
      if (origNoColor === undefined) {
        delete process.env['NO_COLOR'];
      } else {
        process.env['NO_COLOR'] = origNoColor;
      }
    });

    it('the bell is emitted exactly as in a colour session (byte-identical)', () => {
      const tty = new CapturingStdout(true);
      new BellNotificationAdapter(tty).notifyPhaseChange('WORK', 'BREAK');
      expect(tty.bytes()).toBe(BEL); // same single byte a colour session emits
    });
  });

  // ── Twin of: "The ding never disturbs the timer frame" (AC-02.2 / SC-1) ───
  it('the bell arrives as a single bare control character — no cursor movement attached', () => {
    const tty = new CapturingStdout(true);
    new BellNotificationAdapter(tty).notifyPhaseChange('WORK', 'BREAK');
    expect(tty.writes).toHaveLength(1); // one write, nothing else attached
    const payload = tty.writes[0]!;
    expect(payload).toHaveLength(1); // a single byte…
    expect(payload.charCodeAt(0)).toBe(0x07); // …which IS the BEL control character
    expect(payload).not.toContain('\x1b'); // no escape / cursor-movement sequence rides along
  });
});
