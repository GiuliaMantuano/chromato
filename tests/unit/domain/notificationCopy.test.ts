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
  stripNonAscii,
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
  it('WORK to short BREAK reads "Pomodoro complete 🍅" / "Time for a 5-minute break."', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      numbers({ breakMinutes: 5 }),
    );
    expect(copy.title).toBe('Pomodoro complete 🍅');
    expect(copy.body).toBe('Time for a 5-minute break.');
  });

  // AC-NB-02.2 — short BREAK → WORK (typographic apostrophe U+2019 in the title)
  it('short BREAK to WORK reads "Break’s over" / "Back to focus for a 25-minute block." (U+2019 apostrophe)', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
      numbers({ workMinutes: 25 }),
    );
    expect(copy.title).toBe('Break’s over');
    expect(copy.title).not.toContain("'"); // must NOT be the ASCII apostrophe U+0027
    expect(copy.body).toBe('Back to focus for a 25-minute block.');
  });

  // AC-NB-02.3 — WORK → LONG_BREAK, distinct from short-break copy
  it('WORK to LONG_BREAK reads "4 pomodoros done 🎉" / "Take a proper 15-minute break." and differs from short-break copy', () => {
    const longCopy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'LONG_BREAK' },
      numbers({ cycleCount: 4, longBreakMinutes: 15 }),
    );
    const shortCopy = resolveCopy({ kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' }, numbers());
    expect(longCopy.title).toBe('4 pomodoros done 🎉');
    expect(longCopy.body).toBe('Take a proper 15-minute break.');
    expect(longCopy.title).not.toBe(shortCopy.title);
  });

  // AC-NB-02.4 — OVERDUE
  it('OVERDUE reads "Break ran over" / "Ready to focus again?"', () => {
    const copy = resolveCopy({ kind: 'OVERDUE' }, numbers());
    expect(copy.title).toBe('Break ran over');
    expect(copy.body).toBe('Ready to focus again?');
  });

  // REGRESSION GUARD (Upstream Issue 3, step 06-05) — PHASE_CHANGE to='OVERDUE'
  // must resolve to the SAME copy as the standalone OVERDUE moment kind, not
  // fall through to resolvePhaseChangeCopy's BREAK default ("Pomodoro complete
  // 🍅 — Time for a 0-minute break."). Parametrized over both break-family
  // origins (BREAK and LONG_BREAK both time out into OVERDUE).
  it.each([
    'BREAK',
    'LONG_BREAK',
  ] as const)('PHASE_CHANGE to=OVERDUE from %s reads "Break ran over" / "Ready to focus again?" (matches standalone OVERDUE, not the BREAK default)', (from) => {
    const copy = resolveCopy({ kind: 'PHASE_CHANGE', from, to: 'OVERDUE' }, numbers());
    expect(copy.title).toBe('Break ran over');
    expect(copy.body).toBe('Ready to focus again?');
  });

  // AC-NB-02.5 — numbers are dynamic (work duration of 50 → "Back to focus for a 50-minute block.")
  it('short BREAK to WORK reflects a custom 50-minute work duration', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
      numbers({ workMinutes: 50 }),
    );
    expect(copy.body).toBe('Back to focus for a 50-minute block.');
  });

  // AC-NB-02.5 (edge) — break minutes are dynamic on the short-break body too
  it('WORK to short BREAK reflects a custom 10-minute short break', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      numbers({ breakMinutes: 10 }),
    );
    expect(copy.body).toBe('Time for a 10-minute break.');
  });

  // AC-NB-02.3 (edge) — long-break cycle count + minutes are dynamic
  it('WORK to LONG_BREAK reflects a 6-cycle / 20-minute config', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'LONG_BREAK' },
      numbers({ cycleCount: 6, longBreakMinutes: 20 }),
    );
    expect(copy.title).toBe('6 pomodoros done 🎉');
    expect(copy.body).toBe('Take a proper 20-minute break.');
  });

  // REGRESSION GUARD (the primary bugfix deliverable) — at breakMinutes = 1 the
  // work→break body MUST read "Time for a 1-minute break." (NOT the ambiguous
  // "Take 1."). The hyphenated-adjective form is grammatical at any duration —
  // it never produces "1 minutes". This case FAILS against the old terse copy
  // and PASSES after the fix, pinning the bug against recurrence.
  it('WORK to short BREAK at 1 minute reads "Time for a 1-minute break." (no "1 minutes" plural bug)', () => {
    const copy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'BREAK' },
      numbers({ breakMinutes: 1 }),
    );
    expect(copy.body).toBe('Time for a 1-minute break.');
  });

  // REGRESSION GUARD (siblings) — a 1-minute long break and a 1-minute work block
  // also read grammatically via the hyphenated form ("1-minute", never "1 minutes").
  it('reads "1-minute" (never "1 minutes") for a 1-minute long break and a 1-minute work block', () => {
    const longCopy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'WORK', to: 'LONG_BREAK' },
      numbers({ longBreakMinutes: 1 }),
    );
    const workCopy = resolveCopy(
      { kind: 'PHASE_CHANGE', from: 'BREAK', to: 'WORK' },
      numbers({ workMinutes: 1 }),
    );
    expect(longCopy.body).toBe('Take a proper 1-minute break.');
    expect(workCopy.body).toBe('Back to focus for a 1-minute block.');
    expect(longCopy.body).not.toContain('1 minutes');
    expect(workCopy.body).not.toContain('1 minutes');
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
    expect(fromLong.body).toBe('Back to focus for a 25-minute block.');
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

/**
 * stripNonAscii — single ASCII-degradation source (DDD-8, step 06-02). Shared
 * by the copy renderers (this file) AND src/domain/windowTitle.ts (behavior-
 * preserving refactor of its former LOCAL ASCII_TITLES map, step 03-01's
 * interim implementation) — one stripping rule, no second implementation.
 *
 * TEST PARADIGM: property-viable — fast-check is NOT a project dependency
 * (established precedent, windowTitle.test.ts / notificationMode.test.ts): a
 * representative table of ASCII / emoji / combining-mark / mixed inputs
 * stands in for the fast-check string arbitrary, exercising the same
 * equivalence classes a generator would explore.
 *
 * Test budget: 4 behaviors (ASCII-only output / idempotent / identity on
 * ASCII-only input / exact D11 grammatical degradation) x 2 = 8 max;
 * 4 it.each blocks written (parametrized, Mandate 5).
 */
function isAsciiOnly(text: string): boolean {
  return [...text].every((ch) => (ch.codePointAt(0) ?? 0) <= 0x7f);
}

// Representative equivalence classes standing in for a fast-check string
// arbitrary: pure ASCII, trailing/leading emoji, mid-string emoji, combining
// diacritics, CJK, surrogate-pair emoji runs, empty string, whitespace-only.
const REPRESENTATIVE_INPUTS: ReadonlyArray<{ label: string; input: string }> = [
  { label: 'pure ASCII sentence', input: 'Back to focus for a 25-minute block.' },
  { label: 'trailing emoji (D3 copy shape)', input: 'Pomodoro complete 🍅' },
  { label: 'leading emoji + em dash (window-title shape)', input: '🍅 WORK — chromato' },
  { label: 'mid-string emoji flanked by spaces', input: 'a 🍅 b' },
  { label: 'combining diacritic (e + U+0301 acute)', input: 'caf́e' },
  { label: 'CJK characters', input: '日本語' },
  { label: 'consecutive surrogate-pair emoji, no spaces', input: '🍅🎉' },
  { label: 'empty string', input: '' },
  { label: 'whitespace-only', input: '   ' },
];

describe('notificationCopy — stripNonAscii (DDD-8 single-sourced ASCII degradation)', () => {
  // Behavior 1: output contains ONLY ASCII code points, for any input.
  it.each(REPRESENTATIVE_INPUTS)('$label -> ASCII-only output', ({ input }) => {
    expect(isAsciiOnly(stripNonAscii(input))).toBe(true);
  });

  // Behavior 2: idempotent — stripping an already-stripped string is a no-op.
  it.each(REPRESENTATIVE_INPUTS)('$label -> idempotent (strip(strip(x)) === strip(x))', ({
    input,
  }) => {
    const once = stripNonAscii(input);
    expect(stripNonAscii(once)).toBe(once);
  });

  // Behavior 3: identity on ASCII-only input — including irregular whitespace,
  // which proves the degradation logic never touches text it has no reason to.
  it.each([
    'Back to focus for a 25-minute block.',
    'double  spaces stay double',
    '  leading and trailing spaces stay  ',
    'hyphen-already-ascii',
    '',
  ])('ASCII-only input %j is returned unchanged', (input) => {
    expect(stripNonAscii(input)).toBe(input);
  });

  // Behavior 4: exact D11 grammatical degradation — emoji (+ its adjacent
  // whitespace) removed, em dash normalized to an ASCII hyphen, single-sourced
  // with windowTitle.ts's phaseTitle(phase, true) expectations.
  it.each([
    { input: 'Pomodoro complete 🍅', expected: 'Pomodoro complete' },
    { input: '4 pomodoros done 🎉', expected: '4 pomodoros done' },
    { input: '🍅 WORK — chromato', expected: 'WORK - chromato' },
    { input: 'a — b', expected: 'a - b' },
  ])('$input -> $expected (grammatical, no double spaces)', ({ input, expected }) => {
    expect(stripNonAscii(input)).toBe(expected);
  });
});
