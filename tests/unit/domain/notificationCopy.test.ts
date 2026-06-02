/**
 * Unit tests: notificationCopy (pure copy mapping) — notification-branding US-NB-02 / US-NB-04.
 *
 * `resolveCopy` is a PURE function (Mandate 4 — pure-function extraction): moment +
 * resolved numbers → { title, body }, single-sourcing the D3 warm-voice matrix (SC-03).
 * No I/O, no fixtures, no platform mocking. The driving port here IS the function
 * signature (port-to-port at domain/presentation scope).
 *
 * TEST PARADIGM: EXEMPT — exact-string golden copy (the D3 matrix is the authoritative
 * literal, D11). Property-framing cannot express "the string is exactly this"; these are
 * single-example golden assertions. No Hypothesis/fast-check in the chromato stack.
 *
 * D3 literal hazards (assert exactly):
 *   - "Break’s over" uses the typographic apostrophe U+2019 (’), NOT ASCII U+0027 (').
 *   - Emoji 🍅 (U+1F345) and 🎉 (U+1F389) are part of the copy.
 *   - Numbers ({brk}/{work}/{long}/{cycles}/{minutes}) come from the injected
 *     NotificationCopyNumbers / focusedMinutes argument — never hardcoded (SC-07).
 *
 * RED classification: resolveCopy throws "Not yet implemented -- RED scaffold"
 *   → MISSING_FUNCTIONALITY for every assertion below (genuine RED).
 *
 * These specs run RED against the scaffold (Mandate-7 RED-against-scaffold preferred
 * over it.skip for vitest). DELIVER implements resolveCopy to GREEN.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCopy,
  type NotificationCopyNumbers,
} from '../../../src/domain/notificationCopy.js';

// Resolved numbers fixture — these are the PRECONDITION (input state), never the
// expected output. resolveCopy substitutes them into the D3 templates.
function numbers(overrides: Partial<NotificationCopyNumbers> = {}): NotificationCopyNumbers {
  return {
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    cycleCount: 4,
    ...overrides,
  };
}

describe('notificationCopy — warm-voice D3 matrix (US-NB-02)', () => {
  // AC-NB-02.1 — WORK → short BREAK
  it('WORK to short BREAK reads "Pomodoro complete 🍅" / "Nice focus. Take 5."', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      numbers({ breakMinutes: 5 }),
    );
    expect(copy.title).toBe('Pomodoro complete 🍅');
    expect(copy.body).toBe('Nice focus. Take 5.');
  });

  // AC-NB-02.2 — short BREAK → WORK (typographic apostrophe U+2019 in the title)
  it('short BREAK to WORK reads "Break’s over" / "Back to focus for 25." (U+2019 apostrophe)', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
      numbers({ workMinutes: 25 }),
    );
    expect(copy.title).toBe('Break’s over');
    expect(copy.title).not.toContain("'"); // must NOT be the ASCII apostrophe U+0027
    expect(copy.body).toBe('Back to focus for 25.');
  });

  // AC-NB-02.3 — WORK → LONG_BREAK, distinct from short-break copy
  it('WORK to LONG_BREAK reads "4 pomodoros done 🎉" / "Take a proper 15." and differs from short-break copy', () => {
    const longCopy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'LONG_BREAK' },
      numbers({ cycleCount: 4, longBreakMinutes: 15 }),
    );
    const shortCopy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      numbers(),
    );
    expect(longCopy.title).toBe('4 pomodoros done 🎉');
    expect(longCopy.body).toBe('Take a proper 15.');
    expect(longCopy.title).not.toBe(shortCopy.title);
  });

  // AC-NB-02.4 — OVERDUE
  it('OVERDUE reads "Break ran over" / "Ready to focus again?"', () => {
    const copy = resolveCopy({ kind: 'OVERDUE' }, numbers());
    expect(copy.title).toBe('Break ran over');
    expect(copy.body).toBe('Ready to focus again?');
  });

  // AC-NB-02.5 — numbers are dynamic (work duration of 50 → "Back to focus for 50.")
  it('short BREAK to WORK reflects a custom 50-minute work duration', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
      numbers({ workMinutes: 50 }),
    );
    expect(copy.body).toBe('Back to focus for 50.');
  });

  // AC-NB-02.5 (edge) — break minutes are dynamic on the short-break body too
  it('WORK to short BREAK reflects a custom 10-minute short break', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      numbers({ breakMinutes: 10 }),
    );
    expect(copy.body).toBe('Nice focus. Take 10.');
  });

  // AC-NB-02.3 (edge) — long-break cycle count + minutes are dynamic
  it('WORK to LONG_BREAK reflects a 6-cycle / 20-minute config', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'LONG_BREAK' },
      numbers({ cycleCount: 6, longBreakMinutes: 20 }),
    );
    expect(copy.title).toBe('6 pomodoros done 🎉');
    expect(copy.body).toBe('Take a proper 20.');
  });

  // AC-NB-02.2 (break-agnostic) — the D3 "Break → Work" moment covers BOTH break
  // types: LONG_BREAK→WORK yields the SAME "Break’s over" / "Back to focus for 25."
  // copy as SHORT_BREAK→WORK. Any break ending → back to work is one moment, so a
  // crafter must key resolveCopy so {SHORT_BREAK|LONG_BREAK}→WORK both map to it
  // (otherwise LONG_BREAK→WORK would throw → silent bell on a real transition).
  it('LONG_BREAK to WORK reads the same "Break’s over" copy as short BREAK to WORK', () => {
    const fromLong = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'LONG_BREAK', to: 'WORK' },
      numbers({ workMinutes: 25 }),
    );
    const fromShort = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
      numbers({ workMinutes: 25 }),
    );
    expect(fromLong.title).toBe('Break’s over');
    expect(fromLong.body).toBe('Back to focus for 25.');
    // break-agnostic: long-break and short-break endings produce identical copy
    expect(fromLong.title).toBe(fromShort.title);
    expect(fromLong.body).toBe(fromShort.body);
  });
});

describe('notificationCopy — session-complete (US-NB-04)', () => {
  // AC-NB-04.1 — fired with focused minutes
  it('SESSION_COMPLETE reads "Session complete" / "100 min focused. Well done."', () => {
    const copy = resolveCopy({ kind: 'SESSION_COMPLETE', focusedMinutes: 100 }, numbers());
    expect(copy.title).toBe('Session complete');
    expect(copy.body).toBe('100 min focused. Well done.');
  });

  // AC-NB-04.2 — focused minutes are dynamic
  it('SESSION_COMPLETE reflects a 50-minute session', () => {
    const copy = resolveCopy({ kind: 'SESSION_COMPLETE', focusedMinutes: 50 }, numbers());
    expect(copy.body).toBe('50 min focused. Well done.');
  });
});
