/**
 * notificationCopy: pure mapping of (notification moment + resolved numbers) →
 * { title, body }, single-sourcing the D3 warm-voice copy matrix (SC-03).
 *
 * Domain-pure presentation concern: imports only the domain PomodoroPhase type
 * and is consumed by NotificationAdapter via the legal adapter→domain direction
 * (dependency-cruiser Rule 4 satisfied — no adapter→adapter import).
 *
 * D3 copy matrix (authoritative — unit-bearing hyphenated-adjective form, grammatical
 * at ANY duration; restores time units omitted by D11, NOT the prototype EVENTS array):
 *   WORK → short BREAK   title "Pomodoro complete 🍅"        body "Time for a {brk}-minute break."
 *   short BREAK → WORK    title "Break’s over" (U+2019)        body "Back to focus for a {work}-minute block."
 *   WORK → LONG_BREAK     title "{cycles} pomodoros done 🎉"   body "Take a proper {long}-minute break."
 *   OVERDUE               title "Break ran over"               body "Ready to focus again?"
 *   SESSION_COMPLETED     title "Session complete"             body "{minutes} min focused. Well done."
 */

import type { PomodoroPhase } from './phase.js';

/**
 * Resolved copy numbers, derived once at the composition root from
 * ConfigResult.config (seconds ÷ 60 → minutes). Injected into NotificationAdapter
 * via constructor (decision 7, mirrors TuiAdapter(resolvedPalette)).
 */
export interface NotificationCopyNumbers {
  readonly workMinutes: number;
  readonly breakMinutes: number;
  readonly longBreakMinutes: number;
  readonly cycleCount: number;
}

/** The five notification moments. */
export type NotificationMoment =
  | { readonly kind: 'PHASE_CHANGE'; readonly from: PomodoroPhase; readonly to: PomodoroPhase }
  | { readonly kind: 'OVERDUE' }
  | { readonly kind: 'SESSION_COMPLETE'; readonly focusedMinutes: number };

/** Resolved notification copy: title + body strings, fully substituted. */
export interface NotificationCopy {
  readonly title: string;
  readonly body: string;
}

/**
 * Map a moment + resolved numbers to the D3 warm-voice copy.
 *
 * PHASE_CHANGE is keyed on the destination phase (`to`):
 *   - to === 'WORK'       → break-agnostic "Break’s over" (any BREAK|LONG_BREAK → WORK)
 *   - to === 'BREAK'      → "Pomodoro complete 🍅"
 *   - to === 'LONG_BREAK' → "{cycles} pomodoros done 🎉"
 * Keying on `to` (not `from`) is what makes the Break→Work moment break-agnostic:
 * LONG_BREAK→WORK reuses the same copy as SHORT_BREAK→WORK and never throws.
 */
export function resolveCopy(
  moment: NotificationMoment,
  numbers: NotificationCopyNumbers,
): NotificationCopy {
  if (moment.kind === 'OVERDUE') {
    return { title: 'Break ran over', body: 'Ready to focus again?' };
  }
  if (moment.kind === 'SESSION_COMPLETE') {
    return {
      title: 'Session complete',
      body: `${moment.focusedMinutes} min focused. Well done.`,
    };
  }
  return resolvePhaseChangeCopy(moment.to, numbers);
}

function resolvePhaseChangeCopy(
  to: PomodoroPhase,
  numbers: NotificationCopyNumbers,
): NotificationCopy {
  if (to === 'WORK') {
    return {
      title: 'Break’s over',
      body: `Back to focus for a ${numbers.workMinutes}-minute block.`,
    };
  }
  if (to === 'LONG_BREAK') {
    return {
      title: `${numbers.cycleCount} pomodoros done 🎉`,
      body: `Take a proper ${numbers.longBreakMinutes}-minute break.`,
    };
  }
  return {
    title: 'Pomodoro complete 🍅',
    body: `Time for a ${numbers.breakMinutes}-minute break.`,
  };
}
