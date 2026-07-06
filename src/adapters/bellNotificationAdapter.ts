/**
 * BellNotificationAdapter: exactly one BEL (\x07) to stdout per notification
 * moment, emitted only when stdout is a TTY ([D8], M8-08 invariant, DDD-3).
 * Shared verbatim by the TUI and minimal paths. Control character only —
 * no cursor movement, alternate-screen safe (SC-1).
 *
 * A NEW first-class stdout contract (NOT the old NotificationAdapter stderr
 * fallback). No mode flags in here — mode wiring is the composite's job
 * (slice-03); this adapter rings unconditionally per moment when interactive.
 *
 * The stdout seam is injectable for the @tty-sim twins
 * (tests/unit/adapters/bellNotificationAdapter.test.ts); production uses the
 * process.stdout default.
 *
 * 06-04 fix (DDD-13 extended, Upstream Issue 2): session.ts transitionPhase()
 * pushes PHASE_CHANGED together with a SECOND event in the SAME drain on
 * every WORK→rest transition (+SESSION_COMPLETED) and every rest→OVERDUE
 * transition (+OVERDUE_ACTIVATED). SessionService.processEvents() drains
 * both as back-to-back synchronous calls on this adapter, so without
 * same-drain awareness both calls ring — doubling the bell for what the
 * user experiences as one moment. Mirrors WindowTitleAdapter's
 * `phaseChangedThisDrain` fix (step 03-05), but the bell must clear the
 * flag in BOTH notifySessionComplete() AND notifyOverdue() (two collision
 * pairs, not one) so a later, genuinely standalone call (e.g. the 60-second
 * overdue follow-up reminder) is never incorrectly suppressed.
 *
 * CRITICAL: must NOT import ink/react (rides the minimal path, Rule 3 family).
 */

import type { NotificationPort } from '../domain/ports.js';
import type { PomodoroPhase } from '../domain/phase.js';

/** The minimal stdout surface the bell needs: TTY detection + byte writes. */
export interface BellStdout {
  readonly isTTY?: boolean | undefined;
  write(chunk: string): boolean;
}

const BEL = '\x07';

export class BellNotificationAdapter implements NotificationPort {
  /** Consumed by notifySessionComplete()/notifyOverdue() to arbitrate the same-drain collision (06-04). */
  private phaseChangedThisDrain = false;

  constructor(private readonly stdout: BellStdout = process.stdout) {}

  notifyPhaseChange(_from: PomodoroPhase, _to: PomodoroPhase): void {
    this.phaseChangedThisDrain = true;
    this.ring();
  }

  /**
   * Rings unless a same-drain PHASE_CHANGED just fired (rest→OVERDUE
   * transitionPhase() pushes both events together — the phase-change ring
   * already covered this moment). Consumes the flag either way, so a later
   * standalone call (the 60-second overdue follow-up reminder) still rings.
   */
  notifyOverdue(): void {
    if (this.phaseChangedThisDrain) {
      this.phaseChangedThisDrain = false;
      return;
    }
    this.ring();
  }

  /**
   * Rings unless a same-drain PHASE_CHANGED just fired (WORK→rest
   * transitionPhase() pushes both events together — the phase-change ring
   * already covered this moment). Consumes the flag either way, so a later
   * standalone session-complete still rings.
   */
  notifySessionComplete(_focusedMinutes: number): void {
    if (this.phaseChangedThisDrain) {
      this.phaseChangedThisDrain = false;
      return;
    }
    this.ring();
  }

  /** One bare BEL per moment — only when stdout is an interactive terminal ([D8]). */
  private ring(): void {
    if (!this.stdout.isTTY) {
      return;
    }
    this.stdout.write(BEL);
  }
}
