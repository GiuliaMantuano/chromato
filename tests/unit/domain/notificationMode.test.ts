/**
 * notificationMode domain unit tests — in-terminal-notifications slice-03
 * (step 04-01).
 *
 * Traceability: US-03 (AC-03.1..AC-03.4), [D6], [D10], DDD-1.
 *
 * TEST PARADIGM: fast-check is not a project dependency (established
 * precedent — see tests/unit/domain/windowTitle.test.ts). parseNotificationMode
 * is TOTAL over any string/boolean/absent input: the property is exercised via
 * a representative table of arbitrary strings (empty, whitespace, unicode,
 * numeric-looking, near-miss casing, very long) standing in for the fast-check
 * string arbitrary. Predicates and MODE_LABELS are exhaustive over the FULL
 * mode universe (VALID_NOTIFICATION_MODES) — a genuine property test, not a
 * hand-picked example set.
 *
 * Port boundary (Mandate 2): pure domain functions ARE their own driving ports.
 *
 * Test budget: 4 behaviors (legacy boolean mapping / unknown-string fallback /
 * absent fallback / predicates+labels exhaustiveness) x 2 = 8 max; 6 written.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_MODE,
  MODE_LABELS,
  VALID_NOTIFICATION_MODES,
  modeIncludesBanner,
  modeIncludesBell,
  modeIsOff,
  modeLabel,
  parseNotificationMode,
  type NotificationMode,
} from '../../../src/domain/notificationMode.js';

// Representative arbitrary-string universe standing in for fast-check's string
// arbitrary (fast-check is not a project dependency — see windowTitle.test.ts).
const ARBITRARY_INVALID_STRINGS = [
  '',
  '   ',
  'loud',
  'LOUD',
  'Banner+Bell',
  '🍅🍅🍅',
  '123',
  'true',
  'false',
  'a'.repeat(500),
  'banner+bell ',
  ' bell',
];

describe('parseNotificationMode — legacy boolean mapping ([D6])', () => {
  it('true maps to "banner+bell", false maps to "off"', () => {
    expect(parseNotificationMode(true)).toEqual({ mode: 'banner+bell' });
    expect(parseNotificationMode(false)).toEqual({ mode: 'off' });
  });
});

describe('parseNotificationMode — absent/nullish input ([D10] default)', () => {
  it.each([undefined, null])('%s falls back to the default mode with no invalid marker', (raw) => {
    const result = parseNotificationMode(raw);
    expect(result.mode).toBe(DEFAULT_NOTIFICATION_MODE);
    expect(result.invalid).toBeUndefined();
  });
});

describe('parseNotificationMode — valid mode strings pass through unchanged', () => {
  it.each(VALID_NOTIFICATION_MODES)('%s parses to itself with no invalid marker', (mode) => {
    const result = parseNotificationMode(mode);
    expect(result).toEqual({ mode });
  });
});

describe('parseNotificationMode — totality over arbitrary invalid input ([D10])', () => {
  // Property: for ANY string that is not one of the 4 valid modes, parsing
  // NEVER throws, ALWAYS yields the default mode, and ALWAYS records the raw
  // value as `invalid` — the at-most-one-warning contract's data source.
  it.each(
    ARBITRARY_INVALID_STRINGS,
  )('%j always falls back to the default mode and records itself as invalid', (raw) => {
    expect(() => parseNotificationMode(raw)).not.toThrow();
    const result = parseNotificationMode(raw);
    expect(result.mode).toBe(DEFAULT_NOTIFICATION_MODE);
    expect(result.invalid).toBe(raw);
  });

  it('non-string, non-boolean, non-nullish input also falls back safely (total function)', () => {
    for (const raw of [42, {}, [], Symbol('x')]) {
      expect(() => parseNotificationMode(raw)).not.toThrow();
      expect(parseNotificationMode(raw).mode).toBe(DEFAULT_NOTIFICATION_MODE);
    }
  });
});

describe('MODE_LABELS and predicates — exhaustive over the full mode universe (DDD-1)', () => {
  // Property: every mode in the universe has a label, and the three
  // predicates partition the universe consistently (banner+bell has both
  // signals; banner/bell have exactly one; off has neither).
  it.each(
    VALID_NOTIFICATION_MODES,
  )('%s has a defined label via MODE_LABELS and modeLabel()', (mode) => {
    expect(MODE_LABELS[mode]).toEqual(expect.any(String));
    expect(MODE_LABELS[mode].length).toBeGreaterThan(0);
    expect(modeLabel(mode)).toBe(MODE_LABELS[mode]);
  });

  const EXPECTED: Record<NotificationMode, { banner: boolean; bell: boolean; off: boolean }> = {
    'banner+bell': { banner: true, bell: true, off: false },
    banner: { banner: true, bell: false, off: false },
    bell: { banner: false, bell: true, off: false },
    off: { banner: false, bell: false, off: true },
  };

  it.each(
    VALID_NOTIFICATION_MODES,
  )('%s satisfies the exact predicate signature for its mode', (mode) => {
    expect(modeIncludesBanner(mode)).toBe(EXPECTED[mode].banner);
    expect(modeIncludesBell(mode)).toBe(EXPECTED[mode].bell);
    expect(modeIsOff(mode)).toBe(EXPECTED[mode].off);
  });
});
