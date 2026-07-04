/**
 * Unit tests for the first-run launch guard (pure function). RED scaffold stage.
 * Traceability: US-07, US-01, ADR-012 DD-2/DD-3.
 *
 * These run NOW and are RED (shouldRunWizard throws the RED-scaffold error).
 * DELIVER implements the function; these go green.
 */

import { describe, it, expect } from 'vitest';
import { shouldRunWizard } from '../../src/firstRun.js';

const baseEnv = {} as NodeJS.ProcessEnv;

describe('shouldRunWizard (first-run guard)', () => {
  it('launches when config absent AND interactive TTY AND not NO_COLOR/CI', () => {
    expect(shouldRunWizard({ isTTY: true, env: baseEnv, configExists: false })).toBe(true);
  });

  it('skips when stdin is not a TTY', () => {
    expect(shouldRunWizard({ isTTY: false, env: baseEnv, configExists: false })).toBe(false);
  });

  it('skips when NO_COLOR is set', () => {
    expect(shouldRunWizard({ isTTY: true, env: { NO_COLOR: '1' }, configExists: false })).toBe(
      false,
    );
  });

  it('skips when CI is set', () => {
    expect(shouldRunWizard({ isTTY: true, env: { CI: 'true' }, configExists: false })).toBe(false);
  });

  it('skips when a config file already exists', () => {
    expect(shouldRunWizard({ isTTY: true, env: baseEnv, configExists: true })).toBe(false);
  });
});
