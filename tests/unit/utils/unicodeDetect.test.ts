/**
 * Test Budget: 4 distinct behaviors x 2 = 8 max unit tests
 * Behaviors:
 *   1. TERM=dumb → returns true
 *   2. LANG/LC_ALL missing UTF-8 → returns true
 *   3. LANG contains UTF-8 → returns false
 *   4. empty LANG → returns true
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectNonUnicode } from '../../../src/utils/unicodeDetect.js';

describe('detectNonUnicode', () => {
  let originalTerm: string | undefined;
  let originalLang: string | undefined;
  let originalLcAll: string | undefined;

  beforeEach(() => {
    originalTerm = process.env['TERM'];
    originalLang = process.env['LANG'];
    originalLcAll = process.env['LC_ALL'];
  });

  afterEach(() => {
    if (originalTerm === undefined) {
      delete process.env['TERM'];
    } else {
      process.env['TERM'] = originalTerm;
    }
    if (originalLang === undefined) {
      delete process.env['LANG'];
    } else {
      process.env['LANG'] = originalLang;
    }
    if (originalLcAll === undefined) {
      delete process.env['LC_ALL'];
    } else {
      process.env['LC_ALL'] = originalLcAll;
    }
  });

  it('returns true when TERM=dumb', () => {
    process.env['TERM'] = 'dumb';
    delete process.env['LC_ALL'];
    process.env['LANG'] = 'en_US.UTF-8';

    expect(detectNonUnicode()).toBe(true);
  });

  it('returns true when LANG does not contain UTF-8', () => {
    delete process.env['TERM'];
    delete process.env['LC_ALL'];
    process.env['LANG'] = 'en_US.ISO-8859-1';

    expect(detectNonUnicode()).toBe(true);
  });

  it('returns false when LANG contains UTF-8', () => {
    process.env['TERM'] = 'xterm-256color';
    delete process.env['LC_ALL'];
    process.env['LANG'] = 'en_US.UTF-8';

    expect(detectNonUnicode()).toBe(false);
  });

  it('returns true when LANG is empty string', () => {
    delete process.env['TERM'];
    delete process.env['LC_ALL'];
    process.env['LANG'] = '';

    expect(detectNonUnicode()).toBe(true);
  });
});
