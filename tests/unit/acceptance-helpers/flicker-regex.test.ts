import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const TUI_ADAPTER_PATH = resolve(__dirname, '../../../src/adapters/tuiAdapter.tsx');
const tuiAdapterSource = readFileSync(TUI_ADAPTER_PATH, 'utf-8');

/**
 * Regression tests for the flicker-detection regex used in acceptance helpers.
 *
 * The acceptance helper must distinguish between legitimate alternate-screen
 * writes (enter/exit alternate screen buffer -- not flicker) and actual
 * mid-render stdout.write calls (flicker).
 *
 * The broken regex uses a negative lookahead on "unmount" which does NOT match
 * the literal write argument strings (\x1b[?1049h... and \x1b[?1049l).
 * This causes a false positive: the regex incorrectly flags the legitimate
 * alternate-screen writes as flicker.
 *
 * The fix names these writes via ALTERNATE_SCREEN_ENTER / ALTERNATE_SCREEN_EXIT
 * constants, allowing the corrected regex to use a lookahead on "ALTERNATE_SCREEN".
 */
describe('flicker-detection regex correctness', () => {
  it('broken regex matches tuiAdapter source -- confirms false positive', () => {
    // The broken regex: negative lookahead on "unmount" does not exempt the
    // raw ANSI alternate-screen write calls, so it matches them incorrectly.
    const brokenRegex = /process\.stdout\.write\s*\((?![^)]*unmount)/;
    expect(brokenRegex.test(tuiAdapterSource)).toBe(true);
  });

  it('fixed regex does NOT match tuiAdapter source -- RED until step 01-02 names constants', () => {
    // The fixed regex: negative lookahead on "ALTERNATE_SCREEN" exempts writes
    // that use the named constants ALTERNATE_SCREEN_ENTER / ALTERNATE_SCREEN_EXIT.
    // This assertion FAILS now because the raw ANSI strings are not yet replaced
    // with named constants. It turns GREEN after step 01-02.
    const fixedRegex = /process\.stdout\.write\s*\((?![^)]*ALTERNATE_SCREEN)/;
    expect(fixedRegex.test(tuiAdapterSource)).toBe(false);
  });
});
