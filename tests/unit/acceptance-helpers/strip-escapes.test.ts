/**
 * Regression tests for ANSI escape-stripping helpers.
 *
 * Documents the known gap in stripAnsi: DEC private mode sequences such as
 * \x1b[?1049h (alternate-screen enter) and \x1b[?1049l (alternate-screen exit)
 * are NOT matched by the current regex /\x1b\[[0-9;]*[A-Za-z]/g because '?'
 * (0x3F) falls outside the character class [0-9;].
 *
 * This test FAILS before helpers.ts is modified (step 01-01, intentionally RED).
 * It becomes GREEN in step 01-02 when stripAllEscapes is added.
 *
 * No imports from src/ production code -- only from the test helper module.
 */

import { describe, test, expect } from 'vitest';
import { stripAnsi, stripAllEscapes } from '../../acceptance/pomodoro-timer-cli/steps/helpers.js';

describe('stripAnsi', () => {
  test('does not strip DEC private mode alternate-screen sequences', () => {
    const input = '\x1b[?1049htext\x1b[?1049l';
    // Known limitation: stripAnsi leaves \x1b[?1049h and \x1b[?1049l intact
    // because '?' is not in [0-9;] -- see regex in helpers.ts
    // Use stripAllEscapes for full ECMA-48 CSI coverage instead.
    expect(stripAnsi(input)).not.toBe('text');
  });
});

describe('stripAllEscapes', () => {
  test('strips DEC private mode alternate-screen sequences', () => {
    const input = '\x1b[?1049htext\x1b[?1049l';
    expect(stripAllEscapes(input)).toBe('text');
  });

  test('strips standard SGR sequences (superset of stripAnsi)', () => {
    const input = '\x1b[32mgreen\x1b[0m';
    expect(stripAllEscapes(input)).toBe('green');
  });
});
