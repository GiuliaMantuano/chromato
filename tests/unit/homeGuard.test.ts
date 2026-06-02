/**
 * Unit tests for the returning-home launch guard (pure function).
 * Traceability: US-RH-05, AC-RH-01.*, SC-02, R3, K4 (0 false positives).
 *
 * The guard is its own driving port (pure function — its signature IS the
 * public interface). We enumerate the full 5-input truth table: the single
 * TRUE branch and every suppressing FALSE branch (non-TTY, NO_COLOR env,
 * --no-color flag, CI, no-config). RED until shouldShowHome is implemented
 * (scaffold throws).
 */

import { describe, it, expect } from 'vitest';
import { shouldShowHome, normalizeGuardEnv } from '../../src/homeGuard.js';
import type { HomeGuardInput } from '../../src/homeGuard.js';

const baseEnv = {} as NodeJS.ProcessEnv;
const baseArgv: readonly string[] = ['node', 'chromato'];

/** A fully-interactive returning-user context: the ONLY true branch. */
const interactiveReturningUser: HomeGuardInput = {
  isTTY: true,
  env: baseEnv,
  argv: baseArgv,
  configExists: true,
};

describe('shouldShowHome (returning-home guard)', () => {
  it('shows the home when config exists AND interactive colour TTY AND no suppression', () => {
    expect(shouldShowHome(interactiveReturningUser)).toBe(true);
  });

  it.each<[string, HomeGuardInput]>([
    [
      'piped / non-TTY stdout',
      { ...interactiveReturningUser, isTTY: false },
    ],
    [
      'NO_COLOR is set in the environment',
      { ...interactiveReturningUser, env: { NO_COLOR: '1' } },
    ],
    [
      'the --no-color flag is present in argv',
      { ...interactiveReturningUser, argv: [...baseArgv, '--no-color'] },
    ],
    [
      'CI is set in the environment',
      { ...interactiveReturningUser, env: { CI: 'true' } },
    ],
    [
      'no config exists (brand-new user)',
      { ...interactiveReturningUser, configExists: false },
    ],
  ])('hides the home when %s', (_label, input) => {
    expect(shouldShowHome(input)).toBe(false);
  });
});

describe('normalizeGuardEnv (CI falsy-value normalisation)', () => {
  it.each<[string, string]>([
    ['false', 'false'],
    ['"0"', '0'],
    ['empty string', ''],
  ])('treats CI=%s as NOT-in-CI (deletes CI)', (_label, ciValue) => {
    const normalized = normalizeGuardEnv({ CI: ciValue, PATH: '/usr/bin' });
    expect(normalized['CI']).toBeUndefined();
    // The guard then reads it as not-in-CI; other env entries are preserved.
    expect(shouldShowHome({ isTTY: true, env: normalized, argv: [], configExists: true })).toBe(true);
    expect(normalized['PATH']).toBe('/usr/bin');
  });

  it.each<[string, NodeJS.ProcessEnv]>([
    ['CI="true"', { CI: 'true' }],
    ['CI="1"', { CI: '1' }],
    ['CI undefined', {}],
  ])('keeps %s unchanged', (_label, env) => {
    const normalized = normalizeGuardEnv(env);
    expect(normalized['CI']).toBe(env['CI']);
  });
});
