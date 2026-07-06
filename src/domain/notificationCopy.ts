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
 * Single-sourced OVERDUE copy (Upstream Issue 3, step 06-05): both the
 * standalone OVERDUE moment kind AND PHASE_CHANGE(to='OVERDUE') resolve to
 * this SAME literal, so there is exactly one place that owns the text.
 */
const OVERDUE_COPY: NotificationCopy = {
  title: 'Break ran over',
  body: 'Ready to focus again?',
};

/**
 * Map a moment + resolved numbers to the D3 warm-voice copy.
 *
 * PHASE_CHANGE is keyed on the destination phase (`to`):
 *   - to === 'WORK'       → break-agnostic "Break’s over" (any BREAK|LONG_BREAK → WORK)
 *   - to === 'BREAK'      → "Pomodoro complete 🍅"
 *   - to === 'LONG_BREAK' → "{cycles} pomodoros done 🎉"
 *   - to === 'OVERDUE'    → "Break ran over" (OVERDUE_COPY, same as the standalone
 *                           OVERDUE moment kind — a break timing out into OVERDUE
 *                           fires this destination alongside OVERDUE_ACTIVATED)
 * Keying on `to` (not `from`) is what makes the Break→Work moment break-agnostic:
 * LONG_BREAK→WORK reuses the same copy as SHORT_BREAK→WORK and never throws.
 */
export function resolveCopy(
  moment: NotificationMoment,
  numbers: NotificationCopyNumbers,
): NotificationCopy {
  if (moment.kind === 'OVERDUE') {
    return OVERDUE_COPY;
  }
  if (moment.kind === 'SESSION_COMPLETE') {
    return {
      title: 'Session complete',
      body: `${moment.focusedMinutes} min focused. Well done.`,
    };
  }
  return resolvePhaseChangeCopy(moment.to, numbers);
}

/** Typographic em dash (U+2014) — degrades to a plain ASCII hyphen, not deleted. */
const EM_DASH = '—';

/**
 * Matches a run of one-or-more non-printable-ASCII code points (anything
 * outside the printable range 0x20-0x7e — mirrors the acceptance suite's own
 * ASCII-only check) with any immediately adjacent spaces/tabs, so the
 * surrounding whitespace can be collapsed correctly when the run is removed:
 * dropped entirely at a word boundary (leading-only or trailing-only
 * whitespace), collapsed to a single space when it sat between two words
 * (both sides had whitespace). The `u` flag makes `[^\x20-\x7e]` match whole
 * Unicode code points, so surrogate-pair emoji are removed as one unit rather
 * than leaving an orphan half.
 */
const NON_ASCII_RUN = /[ \t]*[^\x20-\x7e]+[ \t]*/gu;

/**
 * Single-sourced ASCII-degradation helper (DDD-8): strips emoji/non-ASCII
 * code points and normalizes the typographic em dash to a plain hyphen, while
 * staying grammatical (no doubled or orphaned whitespace at the removal
 * site). Consumed by resolveCopy's callers (copy renderers) AND
 * windowTitle.ts's ASCII title variant — one stripping rule, no second
 * implementation ([D11], step 06-02).
 *
 * Because the removal regex only ever matches where a non-ASCII code point
 * is actually present, a purely-ASCII input is returned byte-for-byte
 * unchanged (including any existing double spaces) — this is what makes the
 * helper idempotent and identity-preserving on ASCII-only input.
 */
export function stripNonAscii(text: string): string {
  return text
    .split(EM_DASH)
    .join('-')
    .replace(NON_ASCII_RUN, (run) => {
      const hasLeadingSpace = /^[ \t]/.test(run);
      const hasTrailingSpace = /[ \t]$/.test(run);
      return hasLeadingSpace && hasTrailingSpace ? ' ' : '';
    });
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
  if (to === 'OVERDUE') {
    return OVERDUE_COPY;
  }
  return {
    title: 'Pomodoro complete 🍅',
    body: `Time for a ${numbers.breakMinutes}-minute break.`,
  };
}
